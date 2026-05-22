// PUBLIC token-only function. Validates a hashed token before any DB write.
// Handles GET (YES action / NO form) and POST (NO submission).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashToken } from "../_shared/tokens.ts";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8f9fa;}
    .card{background:#fff;border-radius:12px;padding:32px;max-width:480px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,0.08);}
    h2{color:#0a7e8c;margin:0 0 16px;}
    .btn{display:inline-block;padding:10px 24px;border-radius:6px;border:none;cursor:pointer;font-size:14px;font-weight:600;margin:4px;}
    .btn-submit{background:#0a7e8c;color:#fff;width:100%;padding:12px;}
    select,textarea{width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin:8px 0;font-size:14px;box-sizing:border-box;}
    label{font-weight:600;font-size:14px;display:block;margin-top:12px;}
    .success{color:#16a34a;font-size:48px;margin-bottom:16px;}
    .error{color:#dc2626;}
    </style></head><body><div class="card">${body}</div></body></html>`,
    { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);

  async function lookupToken(rawToken: string) {
    const h = await hashToken(rawToken);
    return supabase.from("review_tokens").select("*")
      .eq("token_hash", h)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
  }

  if (req.method === "POST") {
    try {
      const formData = await req.formData();
      const token = String(formData.get("token") || "");
      const reason = String(formData.get("reason") || "");
      const notes = String(formData.get("notes") || "");
      if (!token || !reason) return htmlPage("Error", '<h2 class="error">Missing required fields</h2>');

      const { data: tokenRecord } = await lookupToken(token);
      if (!tokenRecord) return htmlPage("Error", '<h2 class="error">Invalid or expired link</h2>');

      const { data: candidate } = await supabase.from("candidates")
        .select("*, jobs(title, department)").eq("id", tokenRecord.candidate_id).single();

      await supabase.from("candidates").update({
        stage: "hm_rejected", stage_updated_at: new Date().toISOString(),
      }).eq("id", tokenRecord.candidate_id);

      await supabase.from("candidate_events").insert([
        { candidate_id: tokenRecord.candidate_id, action_type: "stage_change",
          from_stage: candidate?.stage, to_stage: "hm_rejected", reason_code: reason, notes: notes || null },
        { candidate_id: tokenRecord.candidate_id, action_type: "hm_review_completed",
          notes: `HM declined. Reason: ${reason}${notes ? `. Notes: ${notes}` : ""}` },
      ]);

      await supabase.from("review_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRecord.id);
      await notifyAdmins(supabase, tokenRecord.candidate_id, "NO", reason, notes, candidate);

      return htmlPage("Decision Recorded", `<div class="success">✓</div><h2>Thank you</h2>
        <p>Your decision (<strong>NO</strong>) for <strong>${escapeHtml(candidate?.full_name ?? "")}</strong> is recorded.</p>`);
    } catch (e) {
      return htmlPage("Error", `<h2 class="error">Something went wrong</h2><p>${escapeHtml((e as Error).message)}</p>`);
    }
  }

  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");
  if (!token || !action) return htmlPage("Error", '<h2 class="error">Invalid link</h2>');

  const { data: tokenRecord } = await lookupToken(token);
  if (!tokenRecord) return htmlPage("Link Expired", '<h2 class="error">Invalid or expired link</h2>');

  const { data: candidate } = await supabase.from("candidates")
    .select("*, jobs(title, department)").eq("id", tokenRecord.candidate_id).single();

  if (action === "yes") {
    await supabase.from("candidates").update({
      stage: "hm_approved", stage_updated_at: new Date().toISOString(),
    }).eq("id", tokenRecord.candidate_id);
    await supabase.from("candidate_events").insert([
      { candidate_id: tokenRecord.candidate_id, action_type: "stage_change",
        from_stage: candidate?.stage, to_stage: "hm_approved" },
      { candidate_id: tokenRecord.candidate_id, action_type: "hm_review_completed",
        notes: "HM approved via YES action" },
    ]);
    await supabase.from("review_tokens").update({ used_at: new Date().toISOString() }).eq("id", tokenRecord.id);
    await notifyAdmins(supabase, tokenRecord.candidate_id, "YES", null, null, candidate);
    return htmlPage("Approved", `<div class="success">✓</div><h2>Thank you</h2>
      <p>You have approved <strong>${escapeHtml(candidate?.full_name ?? "")}</strong>.</p>`);
  }

  if (action === "no") {
    const reasons: [string, string][] = [
      ["skills_mismatch","Skills mismatch"],["experience_level","Experience level"],
      ["salary_mismatch","Salary mismatch"],["location_commute","Location/commute"],
      ["notice_period","Notice period"],["right_to_work","Right to work"],
      ["culture_values","Culture/values"],["declined_role","Declined role"],
      ["counteroffer","Counteroffer"],["other","Other"],
    ];
    const opts = reasons.map(([v,l]) => `<option value="${v}">${l}</option>`).join("");
    const actionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/review-action`;
    return htmlPage("Decline", `<h2>Decline candidate</h2>
      <p>Declining <strong>${escapeHtml(candidate?.full_name ?? "")}</strong>.</p>
      <form method="POST" action="${actionUrl}">
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <label>Reason *</label><select name="reason" required>${opts}</select>
        <label>Notes (optional)</label><textarea name="notes" rows="3"></textarea>
        <button type="submit" class="btn btn-submit" style="margin-top:16px;">Confirm</button>
      </form>`);
  }

  return htmlPage("Error", '<h2 class="error">Invalid action</h2>');
});

async function notifyAdmins(
  supabase: ReturnType<typeof createClient>,
  candidateId: string, outcome: string, reason: string | null, notes: string | null, candidate: { full_name?: string; jobs?: { title?: string } } | null
) {
  try {
    const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["admin","hr"]);
    const userIds = [...new Set((roles || []).map((r) => r.user_id))];
    if (!userIds.length) return;
    const { data: profiles } = await supabase.from("profiles").select("email").in("user_id", userIds);
    const recipients = (profiles || []).map((p) => p.email).filter(Boolean);

    let sent = false;
    let emailError: string | null = null;
    if (isEmailConfigured() && recipients.length) {
      try {
        await sendEmail({
          to: recipients,
          subject: `Review complete: ${candidate?.full_name ?? "candidate"} — ${outcome}`,
          html: `<p>HM review complete for <strong>${candidate?.full_name ?? ""}</strong> (${candidate?.jobs?.title ?? ""}).</p>
            <p>Decision: <strong>${outcome}</strong></p>${reason ? `<p>Reason: ${reason}</p>` : ""}${notes ? `<p>Notes: ${notes}</p>` : ""}`,
        });
        sent = true;
      } catch (e) { emailError = (e as Error).message; }
    } else if (!isEmailConfigured()) { emailError = "email_not_configured"; }

    await supabase.from("candidate_events").insert({
      candidate_id: candidateId, action_type: "admin_notified",
      notes: sent
        ? `Emailed ${recipients.length} admin/HR (${outcome})`
        : `Admin notification not sent (${emailError ?? "no recipients"})`,
    });
  } catch (e) { console.warn("notifyAdmins failed:", e); }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
