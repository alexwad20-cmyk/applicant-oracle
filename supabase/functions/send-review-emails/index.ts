import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_.]/g, "").trim();
}

async function generateToken(supabase: any, candidateId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("review_tokens").insert({
    candidate_id: candidateId,
    token_hash: token,
    expires_at: expires,
  });
  return token;
}

function buildCandidateDetailsHtml(c: any, job: any, cvUrl: string, yesUrl: string, noUrl: string): string {
  return `<div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #e5e7eb;">
    <h3 style="margin:0 0 12px 0;">${c.full_name}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:4px 8px;font-weight:bold;">Job</td><td>${job?.title || "—"} — ${job?.department || ""}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Email</td><td>${c.email || ""}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Phone</td><td>${c.phone || ""}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Visa Required</td><td>${c.visa_required ? "Yes" : "No"}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Source</td><td>${c.source || ""}${c.agency_name ? ` (${c.agency_name})` : ""}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">Applied</td><td>${new Date(c.created_at).toLocaleDateString()}</td></tr>
      <tr><td style="padding:4px 8px;font-weight:bold;">CV</td><td><a href="${cvUrl}">Download CV</a></td></tr>
    </table>
    <div style="text-align:center;margin:16px 0 8px 0;">
      <a href="${yesUrl}" style="display:inline-block;padding:10px 28px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">YES</a>
      <a href="${noUrl}" style="display:inline-block;padding:10px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">NO</a>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { mode, candidate_id, candidate_ids, hm_user_id, subject_override, html_override } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get HM profile
    const { data: hmProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", hm_user_id)
      .single();

    if (!hmProfile) throw new Error("Hiring manager profile not found");

    const hmName = hmProfile.full_name || hmProfile.email;
    const hmEmail = hmProfile.email;

    // Determine template key
    const templateKey = mode === "bulk" ? "hm_review_request_bulk" : "hm_review_request_single";

    // Get template
    const { data: tmpl } = await supabase
      .from("email_templates")
      .select("subject_template, html_template")
      .eq("key", templateKey)
      .eq("is_active", true)
      .single();

    let subjectTmpl = subject_override || tmpl?.subject_template || "Review Required";
    let htmlTmpl = html_override || tmpl?.html_template || "<p>Please review.</p>";

    // Get candidates
    const ids = mode === "bulk" ? candidate_ids : [candidate_id];
    const { data: candidates } = await supabase
      .from("candidates")
      .select("*")
      .in("id", ids);

    if (!candidates || candidates.length === 0) throw new Error("No candidates found");

    // Get jobs
    const jobIds = [...new Set(candidates.map((c: any) => c.job_id))];
    const { data: jobsData } = await supabase.from("jobs").select("*").in("id", jobIds);
    const jobMap = new Map((jobsData || []).map((j: any) => [j.id, j]));

    // Generate tokens, CV URLs, and attachment data
    const attachments: any[] = [];
    let candidateListHtml = "";
    const origin = supabaseUrl.replace(/\/+$/, "").replace("supabase.co", "lovable.app"); // fallback

    for (const c of candidates) {
      const job = jobMap.get(c.job_id);
      const token = await generateToken(supabase, c.id);

      // Build action URLs
      const baseUrl = `${supabaseUrl}/functions/v1/review-action`;
      const yesUrl = `${baseUrl}?token=${token}&action=yes`;
      const noUrl = `${baseUrl}?token=${token}&action=no`;

      // CV
      let cvUrl = "#";
      if (c.cv_file_path) {
        const { data: signedData } = await supabase.storage
          .from("candidate-cvs")
          .createSignedUrl(c.cv_file_path, 7 * 24 * 3600);
        if (signedData?.signedUrl) cvUrl = signedData.signedUrl;

        // Try to download for attachment
        try {
          const { data: fileData } = await supabase.storage
            .from("candidate-cvs")
            .download(c.cv_file_path);
          if (fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            attachments.push({
              filename: `${sanitizeFilename(c.full_name)} - CV.pdf`,
              content: base64,
              type: "application/pdf",
            });
          }
        } catch (e) {
          console.warn(`Could not attach CV for ${c.full_name}:`, e);
        }
      }

      // Log events
      await supabase.from("candidate_events").insert({
        candidate_id: c.id,
        action_type: "review_token_created",
        notes: `Review token created for HM ${hmName}`,
      });

      await supabase.from("candidate_events").insert({
        candidate_id: c.id,
        action_type: "review_email_sent",
        notes: `Review email sent to ${hmName} (${hmEmail})`,
      });

      // Update candidate
      await supabase.from("candidates").update({
        hm_review_due_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      }).eq("id", c.id);

      if (mode === "single") {
        // Replace individual placeholders
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
          "{{candidate_link}}": `${supabaseUrl.replace('.supabase.co', '')}/candidates/${c.id}`,
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
        // Build candidate block for bulk
        candidateListHtml += buildCandidateDetailsHtml(c, job, cvUrl, yesUrl, noUrl);
      }
    }

    if (mode === "bulk") {
      const bulkPlaceholders: Record<string, string> = {
        "{{hm_name}}": hmName,
        "{{hm_email}}": hmEmail,
        "{{candidate_count}}": String(candidates.length),
        "{{candidate_list_html}}": candidateListHtml,
        "{{candidate_list_text}}": candidates.map((c: any) => `- ${c.full_name}`).join("\n"),
      };
      for (const [k, v] of Object.entries(bulkPlaceholders)) {
        subjectTmpl = subjectTmpl.split(k).join(v);
        htmlTmpl = htmlTmpl.split(k).join(v);
      }
    }

    // In production, send via Resend here. For now, log.
    console.log(`[EMAIL] To: ${hmEmail}`);
    console.log(`[EMAIL] Subject: ${subjectTmpl}`);
    console.log(`[EMAIL] Attachments: ${attachments.length}`);
    console.log(`[EMAIL] Body length: ${htmlTmpl.length}`);

    return new Response(JSON.stringify({
      success: true,
      to: hmEmail,
      subject: subjectTmpl,
      candidates_count: candidates.length,
      attachments_count: attachments.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
