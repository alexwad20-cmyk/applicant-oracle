import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Find overdue candidates in hm_review with reminder_count < 5
    const { data: candidates, error } = await supabase
      .from("candidates")
      .select("id, full_name, email, phone, source, agency_name, visa_required, cv_file_path, job_id, created_at, hm_review_due_at, last_reminder_sent_at, reminder_count")
      .eq("stage", "hm_review")
      .lt("reminder_count", 5);

    if (error) throw error;

    const now = new Date();
    const hmGroups = new Map<string, { hmUserId: string; candidates: any[] }>();

    for (const c of candidates || []) {
      const isOverdue = c.hm_review_due_at && new Date(c.hm_review_due_at) < now;
      const lastReminder = c.last_reminder_sent_at ? new Date(c.last_reminder_sent_at) : null;
      const reminderDue = !lastReminder || (now.getTime() - lastReminder.getTime()) > 24 * 60 * 60 * 1000;
      if (!isOverdue || !reminderDue) continue;

      const { data: job } = await supabase
        .from("jobs")
        .select("title, department, location, hiring_manager_user_id")
        .eq("id", c.job_id)
        .single();

      if (!job?.hiring_manager_user_id) continue;

      const hmId = job.hiring_manager_user_id;
      if (!hmGroups.has(hmId)) {
        hmGroups.set(hmId, { hmUserId: hmId, candidates: [] });
      }
      hmGroups.get(hmId)!.candidates.push({ ...c, job });
    }

    let sent = 0;

    // Get bulk reminder template
    const { data: tmpl } = await supabase
      .from("email_templates")
      .select("subject_template, html_template")
      .eq("key", "hm_review_reminder_bulk")
      .eq("is_active", true)
      .single();

    for (const [hmId, group] of hmGroups) {
      const { data: hmProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", hmId)
        .single();

      if (!hmProfile) continue;

      // Build candidate list HTML with YES/NO per candidate
      let listHtml = "";
      for (const c of group.candidates) {
        // Generate new token for reminder
        const token = crypto.randomUUID();
        await supabase.from("review_tokens").insert({
          candidate_id: c.id,
          token_hash: token,
          expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        });

        const baseUrl = `${supabaseUrl}/functions/v1/review-action`;
        const yesUrl = `${baseUrl}?token=${token}&action=yes`;
        const noUrl = `${baseUrl}?token=${token}&action=no`;

        let cvUrl = "#";
        if (c.cv_file_path) {
          const { data: signed } = await supabase.storage
            .from("candidate-cvs")
            .createSignedUrl(c.cv_file_path, 7 * 24 * 3600);
          if (signed?.signedUrl) cvUrl = signed.signedUrl;
        }

        listHtml += `<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
          <h3 style="margin:0 0 12px 0;">${c.full_name}</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:4px 8px;font-weight:bold;">Job</td><td>${c.job?.title || "—"} — ${c.job?.department || ""}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:bold;">Email</td><td>${c.email || ""}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:bold;">Phone</td><td>${c.phone || ""}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:bold;">Visa</td><td>${c.visa_required ? "Yes" : "No"}</td></tr>
            <tr><td style="padding:4px 8px;font-weight:bold;">CV</td><td><a href="${cvUrl}">Download CV</a></td></tr>
          </table>
          <div style="text-align:center;margin:16px 0 8px 0;">
            <a href="${yesUrl}" style="display:inline-block;padding:10px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">YES</a>
            <a href="${noUrl}" style="display:inline-block;padding:10px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">NO</a>
          </div>
        </div>`;

        // Update candidate reminder tracking
        await supabase.from("candidates").update({
          last_reminder_sent_at: now.toISOString(),
          reminder_count: c.reminder_count + 1,
        }).eq("id", c.id);

        await supabase.from("candidate_events").insert({
          candidate_id: c.id,
          action_type: "reminder_sent",
          notes: `Reminder #${c.reminder_count + 1} sent to ${hmProfile.full_name || hmProfile.email}`,
        });
      }

      // Render template
      let subj = tmpl?.subject_template || `Reminder: ${group.candidates.length} candidates need your review`;
      let html = tmpl?.html_template || `<p>Hi {{hm_name}},</p><p>Please review these candidates:</p>{{candidate_list_html}}`;

      const placeholders: Record<string, string> = {
        "{{hm_name}}": hmProfile.full_name || hmProfile.email,
        "{{hm_email}}": hmProfile.email,
        "{{candidate_count}}": String(group.candidates.length),
        "{{candidate_list_html}}": listHtml,
      };

      for (const [k, v] of Object.entries(placeholders)) {
        subj = subj.split(k).join(v);
        html = html.split(k).join(v);
      }

      console.log(`[REMINDER] To: ${hmProfile.email}, Subject: ${subj}, Candidates: ${group.candidates.length}`);
      sent++;
    }

    return new Response(JSON.stringify({ success: true, hm_groups_reminded: sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
