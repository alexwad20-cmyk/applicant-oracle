// Authenticated. HR/Admin or the HM-for-the-candidate may share.
// Creates a hashed share token, optionally emails it via Resend, and ALWAYS
// returns { share_url, emailed } so the UI can show accurate copy.

import { requireAuth } from "../_shared/auth.ts";
import { generateToken, hashToken } from "../_shared/tokens.ts";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await requireAuth(req);
    const body = await req.json();
    const { candidate_id, recipient_email, expiry_days, message, attach_cv } = body;
    const includeCv = attach_cv === true;

    if (!candidate_id || !recipient_email) {
      return json({ error: "candidate_id and recipient_email required" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient_email)) {
      return json({ error: "Invalid recipient email" }, 400);
    }

    if (!ctx.isHrOrAdmin) {
      const isHm = await ctx.isHm(candidate_id);
      if (!isHm) return json({ error: "Permission denied" }, 403);
    }

    const { data: candidate } = await ctx.admin
      .from("candidates")
      .select("full_name, source, visa_required, cv_file_path, jobs!candidates_job_id_fkey(title, department)")
      .eq("id", candidate_id)
      .single();
    if (!candidate) return json({ error: "Candidate not found" }, 404);

    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + (Number(expiry_days) || 7) * 86400000).toISOString();

    const { error: insertErr } = await ctx.admin.from("candidate_email_shares").insert({
      candidate_id,
      recipient_email: recipient_email.toLowerCase().trim(),
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: ctx.userId,
      message: message || null,
      attach_cv: includeCv,
    });
    if (insertErr) return json({ error: insertErr.message }, 500);

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/+$/, "") || "";
    const shareUrl = `${origin}/shared-review/${rawToken}`;

    let emailed = false;
    let emailError: string | null = null;
    if (isEmailConfigured()) {
      try {
        let cvSignedUrl: string | null = null;
        if (includeCv && candidate.cv_file_path) {
          const { data: signed } = await ctx.admin.storage
            .from("candidate-cvs")
            .createSignedUrl(candidate.cv_file_path, 3600);
          cvSignedUrl = signed?.signedUrl ?? null;
        }

        const job = (candidate as { jobs?: { title?: string; department?: string } }).jobs;
        const html = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2>Candidate review request</h2>
            <p>You've been asked to review a candidate.</p>
            <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
              <h3 style="margin:0 0 8px;">${escapeHtml(candidate.full_name)}</h3>
              <p style="margin:4px 0;color:#666;">${escapeHtml(job?.title ?? "")} ${job?.department ? "• " + escapeHtml(job.department) : ""}</p>
            </div>
            ${message ? `<blockquote style="border-left:3px solid #2563eb;padding:8px 12px;color:#555;">${escapeHtml(message)}</blockquote>` : ""}
            <p><a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">View &amp; comment</a></p>
            ${cvSignedUrl ? `<p style="font-size:13px;color:#666;">Or <a href="${escapeHtml(cvSignedUrl)}">download the CV directly</a> (link expires in 1 hour).</p>` : ""}
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
            <p style="font-size:12px;color:#999;">Secure, time-limited link — expires ${new Date(expiresAt).toLocaleDateString()}. Do not forward.</p>
          </div>`;
        await sendEmail({ to: recipient_email, subject: `Review request: ${candidate.full_name}`, html });
        emailed = true;
      } catch (e) {
        emailError = (e as Error).message;
      }
    }

    await ctx.admin.from("candidate_events").insert({
      candidate_id,
      actor_user_id: ctx.userId,
      action_type: emailed ? "share_sent" : "share_link_created",
      notes: emailed
        ? `Shared with ${recipient_email}, link emailed${includeCv ? ", CV included" : ", CV not included"}`
        : `Share link created for ${recipient_email} (${includeCv ? "CV included" : "CV not included"}; email not sent: ${emailError ?? "no email provider configured"})`,
    });

    return json({ success: true, share_url: shareUrl, emailed, email_error: emailError });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
