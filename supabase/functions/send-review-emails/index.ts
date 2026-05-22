// Authenticated. HR/Admin only. Sends review-request emails to a Hiring Manager
// with secure (hashed) per-candidate YES/NO links. SLA deadline uses 3 business days.

import { requireAuth, requireRole } from "../_shared/auth.ts";
import { generateToken, hashToken } from "../_shared/tokens.ts";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";
import { addBusinessDays } from "../_shared/business-days.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_.]/g, "").trim();
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function buildCandidateDetailsHtml(c: Record<string, unknown>, job: Record<string, unknown> | undefined, cvUrl: string, yesUrl: string, noUrl: string): string {
  return `<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
    <h3 style="margin:0 0 12px 0;">${escapeHtml(String(c.full_name ?? ""))}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:4px 8px;font-weight:bold;">Job</td><td>${escapeHtml(String(job?.title ?? "—"))} — ${escapeHtml(String(job?.department ?? ""))}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Email</td><td>${escapeHtml(String(c.email ?? ""))}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Phone</td><td>${escapeHtml(String(c.phone ?? ""))}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Visa Required</td><td>${c.visa_required ? "Yes" : "No"}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">CV</td><td><a href="${cvUrl}">Download CV</a></td></tr>
    </table>
    <div style="text-align:center;margin:16px 0 8px 0;">
      <a href="${yesUrl}" style="display:inline-block;padding:10px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">YES</a>
      <a href="${noUrl}" style="display:inline-block;padding:10px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">NO</a>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await requireAuth(req);
    requireRole(ctx, "hr_admin");

    const body = await req.json();
    const { mode, candidate_id, candidate_ids, hm_user_id, subject_override, html_override } = body;
    const supabase = ctx.admin;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const { data: hmProfile } = await supabase
      .from("profiles").select("full_name, email").eq("user_id", hm_user_id).single();
    if (!hmProfile) throw new Error("Hiring manager profile not found");

    const hmName = hmProfile.full_name || hmProfile.email;
    const hmEmail = hmProfile.email;
    const templateKey = mode === "bulk" ? "hm_review_request_bulk" : "hm_review_request_single";

    const { data: tmpl } = await supabase
      .from("email_templates")
      .select("subject_template, html_template")
      .eq("key", templateKey).eq("is_active", true).maybeSingle();

    let subjectTmpl: string = subject_override || tmpl?.subject_template || "Review required";
    let htmlTmpl: string = html_override || tmpl?.html_template || "<p>Please review.</p>";

    const ids: string[] = mode === "bulk" ? candidate_ids : [candidate_id];
    const { data: candidates } = await supabase.from("candidates").select("*").in("id", ids);
    if (!candidates?.length) throw new Error("No candidates found");

    const jobIds = [...new Set(candidates.map((c) => c.job_id))];
    const { data: jobsData } = await supabase.from("jobs").select("*").in("id", jobIds);
    const jobMap = new Map((jobsData || []).map((j) => [j.id, j]));

    const attachments: { filename: string; content: string; type: string }[] = [];
    let candidateListHtml = "";

    for (const c of candidates) {
      const job = jobMap.get(c.job_id);
      const rawToken = generateToken();
      const tokenHash = await hashToken(rawToken);
      await supabase.from("review_tokens").insert({
        candidate_id: c.id, token_hash: tokenHash,
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      });

      const base = `${supabaseUrl}/functions/v1/review-action`;
      const yesUrl = `${base}?token=${rawToken}&action=yes`;
      const noUrl = `${base}?token=${rawToken}&action=no`;

      let cvUrl = "#";
      if (c.cv_file_path) {
        const { data: signed } = await supabase.storage
          .from("candidate-cvs").createSignedUrl(c.cv_file_path, 7 * 86400);
        if (signed?.signedUrl) cvUrl = signed.signedUrl;
        try {
          const { data: file } = await supabase.storage.from("candidate-cvs").download(c.cv_file_path);
          if (file) {
            const ab = await file.arrayBuffer();
            const bytes = new Uint8Array(ab);
            let bin = "";
            for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
            attachments.push({
              filename: `${sanitizeFilename(c.full_name)} - CV.pdf`,
              content: btoa(bin),
              type: "application/pdf",
            });
          }
        } catch (e) { console.warn(`CV attach failed for ${c.full_name}:`, e); }
      }

      await supabase.from("candidate_events").insert([
        { candidate_id: c.id, actor_user_id: ctx.userId, action_type: "review_token_created", notes: `For HM ${hmName}` },
        { candidate_id: c.id, actor_user_id: ctx.userId, action_type: "review_email_sent", notes: `To ${hmName} (${hmEmail})` },
      ]);

      // 3 business-day SLA
      const due = addBusinessDays(new Date(), 3).toISOString();
      await supabase.from("candidates").update({ hm_review_due_at: due }).eq("id", c.id);

      if (mode === "single") {
        const placeholders: Record<string, string> = {
          "{{candidate_name}}": c.full_name,
          "{{candidate_email}}": c.email || "",
          "{{candidate_phone}}": c.phone || "",
          "{{job_title}}": job?.title || "Position",
          "{{department}}": job?.department || "",
          "{{location}}": job?.location || "",
          "{{visa_required}}": c.visa_required ? "Yes" : "No",
          "{{source}}": c.source || "",
          "{{agency_name}}": c.agency_name ? ` (${c.agency_name})` : "",
          "{{applied_date}}": new Date(c.created_at).toLocaleDateString(),
          "{{cv_url}}": cvUrl,
          "{{yes_url}}": yesUrl,
          "{{no_url}}": noUrl,
          "{{hm_name}}": hmName,
          "{{hm_email}}": hmEmail,
        };
        for (const [k, v] of Object.entries(placeholders)) {
          subjectTmpl = subjectTmpl.split(k).join(v);
          htmlTmpl = htmlTmpl.split(k).join(v);
        }
      } else {
        candidateListHtml += buildCandidateDetailsHtml(c, job, cvUrl, yesUrl, noUrl);
      }
    }

    if (mode === "bulk") {
      const bulk: Record<string, string> = {
        "{{hm_name}}": hmName,
        "{{hm_email}}": hmEmail,
        "{{candidate_count}}": String(candidates.length),
        "{{candidate_list_html}}": candidateListHtml,
        "{{candidate_list_text}}": candidates.map((c) => `- ${c.full_name}`).join("\n"),
      };
      for (const [k, v] of Object.entries(bulk)) {
        subjectTmpl = subjectTmpl.split(k).join(v);
        htmlTmpl = htmlTmpl.split(k).join(v);
      }
    }

    let emailed = false;
    let emailError: string | null = null;
    if (isEmailConfigured()) {
      try {
        await sendEmail({ to: hmEmail, subject: subjectTmpl, html: htmlTmpl, attachments });
        emailed = true;
      } catch (e) { emailError = (e as Error).message; }
    } else {
      emailError = "email_not_configured";
    }

    return new Response(JSON.stringify({
      success: true, emailed, email_error: emailError,
      to: hmEmail, subject: subjectTmpl,
      candidates_count: candidates.length, attachments_count: attachments.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
