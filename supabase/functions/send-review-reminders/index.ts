// Authenticated (HR/Admin or cron service-role). Sends reminder emails to HMs for
// overdue HM_REVIEW candidates. Skips weekends. Uses hashed reminder tokens.

import { requireAuth, requireRole } from "../_shared/auth.ts";
import { generateToken, hashToken } from "../_shared/tokens.ts";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";
import { isBusinessHourUtc } from "../_shared/business-days.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await requireAuth(req);
    requireRole(ctx, "hr_admin");

    // Don't pester HMs on weekends unless explicitly forced.
    const force = new URL(req.url).searchParams.get("force") === "1";
    if (!isBusinessHourUtc() && !force) {
      return new Response(JSON.stringify({ success: true, skipped: "weekend" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = ctx.admin;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const { data: candidates, error } = await supabase
      .from("candidates")
      .select("id, full_name, email, phone, visa_required, cv_file_path, job_id, created_at, hm_review_due_at, last_reminder_sent_at, reminder_count")
      .eq("stage", "hm_review").lt("reminder_count", 5);
    if (error) throw error;

    const now = new Date();
    const hmGroups = new Map<string, { hmUserId: string; candidates: Array<Record<string, unknown> & { job?: { title?: string; department?: string; hiring_manager_user_id?: string } }> }>();

    for (const c of candidates ?? []) {
      const overdue = c.hm_review_due_at && new Date(c.hm_review_due_at) < now;
      const last = c.last_reminder_sent_at ? new Date(c.last_reminder_sent_at) : null;
      const due = !last || now.getTime() - last.getTime() > 86_400_000;
      if (!overdue || !due) continue;

      const { data: job } = await supabase.from("jobs")
        .select("title, department, location, hiring_manager_user_id").eq("id", c.job_id).maybeSingle();
      if (!job?.hiring_manager_user_id) continue;

      const hmId = job.hiring_manager_user_id;
      if (!hmGroups.has(hmId)) hmGroups.set(hmId, { hmUserId: hmId, candidates: [] });
      hmGroups.get(hmId)!.candidates.push({ ...c, job });
    }

    let sent = 0;
    let emailError: string | null = isEmailConfigured() ? null : "email_not_configured";

    for (const [hmId, group] of hmGroups) {
      const { data: hmProfile } = await supabase
        .from("profiles").select("full_name, email").eq("user_id", hmId).maybeSingle();
      if (!hmProfile) continue;

      let listHtml = "";
      for (const c of group.candidates) {
        const rawToken = generateToken();
        const tokenHash = await hashToken(rawToken);
        await supabase.from("review_tokens").insert({
          candidate_id: c.id as string, token_hash: tokenHash,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        });

        const base = `${supabaseUrl}/functions/v1/review-action`;
        const yesUrl = `${base}?token=${rawToken}&action=yes`;
        const noUrl = `${base}?token=${rawToken}&action=no`;

        let cvUrl = "#";
        if (c.cv_file_path) {
          const { data: signed } = await supabase.storage
            .from("candidate-cvs").createSignedUrl(String(c.cv_file_path), 7 * 86400);
          if (signed?.signedUrl) cvUrl = signed.signedUrl;
        }

        listHtml += `<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
          <h3 style="margin:0 0 12px 0;">${c.full_name}</h3>
          <p>${c.job?.title ?? ""} — ${c.job?.department ?? ""}</p>
          <p><a href="${cvUrl}">Download CV</a></p>
          <p><a href="${yesUrl}" style="padding:8px 20px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;margin-right:8px;">YES</a>
             <a href="${noUrl}" style="padding:8px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;">NO</a></p>
        </div>`;

        await supabase.from("candidates").update({
          last_reminder_sent_at: now.toISOString(),
          reminder_count: (c.reminder_count as number) + 1,
        }).eq("id", c.id as string);

        await supabase.from("candidate_events").insert({
          candidate_id: c.id as string, action_type: "reminder_sent",
          notes: `Reminder #${(c.reminder_count as number) + 1} for ${hmProfile.full_name || hmProfile.email}`,
        });
      }

      const subject = `Reminder: ${group.candidates.length} candidate(s) awaiting your review`;
      const html = `<p>Hi ${hmProfile.full_name || hmProfile.email},</p>
        <p>These candidates are overdue for your review:</p>${listHtml}`;

      if (isEmailConfigured()) {
        try {
          await sendEmail({ to: hmProfile.email, subject, html });
          sent++;
        } catch (e) { emailError = (e as Error).message; }
      }
    }

    return new Response(JSON.stringify({ success: true, hm_groups: hmGroups.size, emails_sent: sent, email_error: emailError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
