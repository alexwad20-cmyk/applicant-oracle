import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    .btn-yes{background:#16a34a;color:#fff;}.btn-no{background:#dc2626;color:#fff;}.btn-submit{background:#0a7e8c;color:#fff;width:100%;padding:12px;}
    select,textarea{width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;margin:8px 0;font-size:14px;box-sizing:border-box;}
    label{font-weight:600;font-size:14px;display:block;margin-top:12px;}
    .success{color:#16a34a;font-size:48px;margin-bottom:16px;}
    .error{color:#dc2626;}
    </style></head><body><div class="card">${body}</div></body></html>`,
    { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Handle POST (rejection reason form submission)
  if (req.method === "POST") {
    try {
      const formData = await req.formData();
      const token = formData.get("token") as string;
      const reason = formData.get("reason") as string;
      const notes = formData.get("notes") as string;

      if (!token || !reason) {
        return htmlPage("Error", '<h2 class="error">Missing required fields</h2>');
      }

      // Validate token
      const { data: tokenRecord } = await supabase
        .from("review_tokens")
        .select("*")
        .eq("token_hash", token)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!tokenRecord) {
        return htmlPage("Error", '<h2 class="error">Invalid or expired link</h2><p>This link may have already been used.</p>');
      }

      // Get candidate
      const { data: candidate } = await supabase
        .from("candidates")
        .select("*, jobs(title, department)")
        .eq("id", tokenRecord.candidate_id)
        .single();

      // Update candidate stage
      const fromStage = candidate?.stage;
      await supabase.from("candidates").update({
        stage: "hm_rejected",
        stage_updated_at: new Date().toISOString(),
      }).eq("id", tokenRecord.candidate_id);

      // Log events
      await supabase.from("candidate_events").insert({
        candidate_id: tokenRecord.candidate_id,
        action_type: "stage_change",
        from_stage: fromStage,
        to_stage: "hm_rejected",
        reason_code: reason,
        notes: notes || null,
      });

      await supabase.from("candidate_events").insert({
        candidate_id: tokenRecord.candidate_id,
        action_type: "hm_review_completed",
        notes: `HM declined candidate. Reason: ${reason}${notes ? `. Notes: ${notes}` : ""}`,
      });

      // Mark token used
      await supabase.from("review_tokens").update({
        used_at: new Date().toISOString(),
      }).eq("id", tokenRecord.id);

      // Notify admin/HR
      await notifyAdminHr(supabase, tokenRecord.candidate_id, "NO", reason, notes, candidate);

      return htmlPage("Decision Recorded", `
        <div class="success">✓</div>
        <h2>Thank you</h2>
        <p>Your decision has been recorded for <strong>${candidate?.full_name || "the candidate"}</strong>.</p>
        <p>Decision: <strong style="color:#dc2626;">NO</strong></p>
        <p>The recruitment team has been notified.</p>
      `);
    } catch (err) {
      console.error(err);
      return htmlPage("Error", `<h2 class="error">Something went wrong</h2><p>${err.message}</p>`);
    }
  }

  // Handle GET (YES action or NO reason form)
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");

  if (!token || !action) {
    return htmlPage("Error", '<h2 class="error">Invalid link</h2><p>Missing token or action.</p>');
  }

  // Validate token
  const { data: tokenRecord } = await supabase
    .from("review_tokens")
    .select("*")
    .eq("token_hash", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!tokenRecord) {
    return htmlPage("Link Expired", '<h2 class="error">Invalid or expired link</h2><p>This link may have already been used or expired.</p>');
  }

  // Get candidate info
  const { data: candidate } = await supabase
    .from("candidates")
    .select("*, jobs(title, department)")
    .eq("id", tokenRecord.candidate_id)
    .single();

  if (action === "yes") {
    // Directly approve
    const fromStage = candidate?.stage;
    await supabase.from("candidates").update({
      stage: "hm_approved",
      stage_updated_at: new Date().toISOString(),
    }).eq("id", tokenRecord.candidate_id);

    await supabase.from("candidate_events").insert({
      candidate_id: tokenRecord.candidate_id,
      action_type: "stage_change",
      from_stage: fromStage,
      to_stage: "hm_approved",
    });

    await supabase.from("candidate_events").insert({
      candidate_id: tokenRecord.candidate_id,
      action_type: "hm_review_completed",
      notes: "HM approved candidate via YES action",
    });

    await supabase.from("review_tokens").update({
      used_at: new Date().toISOString(),
    }).eq("id", tokenRecord.id);

    // Notify admin/HR
    await notifyAdminHr(supabase, tokenRecord.candidate_id, "YES", null, null, candidate);

    return htmlPage("Candidate Approved", `
      <div class="success">✓</div>
      <h2>Thank you</h2>
      <p>You have approved <strong>${candidate?.full_name || "the candidate"}</strong> for <strong>${(candidate as any)?.jobs?.title || "the position"}</strong>.</p>
      <p>Decision: <strong style="color:#16a34a;">YES</strong></p>
      <p>The recruitment team has been notified.</p>
    `);
  }

  if (action === "no") {
    // Show rejection reason form
    const reasons = [
      ["skills_mismatch", "Skills mismatch"],
      ["experience_level", "Experience level"],
      ["salary_mismatch", "Salary mismatch"],
      ["location_commute", "Location/commute"],
      ["notice_period", "Notice period"],
      ["right_to_work", "Right to work"],
      ["culture_values", "Culture/values"],
      ["declined_role", "Declined role"],
      ["counteroffer", "Counteroffer"],
      ["other", "Other"],
    ];

    const options = reasons.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
    const actionUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/review-action`;

    return htmlPage("Decline Candidate", `
      <h2>Decline Candidate</h2>
      <p>You are declining <strong>${candidate?.full_name || "the candidate"}</strong> for <strong>${(candidate as any)?.jobs?.title || "the position"}</strong>.</p>
      <form method="POST" action="${actionUrl}">
        <input type="hidden" name="token" value="${token}" />
        <label>Reason *</label>
        <select name="reason" required>${options}</select>
        <label>Notes (optional)</label>
        <textarea name="notes" rows="3" placeholder="Additional notes..."></textarea>
        <button type="submit" class="btn btn-submit" style="margin-top:16px;">Confirm Decision</button>
      </form>
    `);
  }

  return htmlPage("Error", '<h2 class="error">Invalid action</h2>');
});

async function notifyAdminHr(
  supabase: any,
  candidateId: string,
  outcome: string,
  reason: string | null,
  notes: string | null,
  candidate: any
) {
  try {
    // Get admin/hr users
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "hr"]);

    const userIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];
    if (userIds.length === 0) return;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("email, full_name")
      .in("user_id", userIds);

    const job = (candidate as any)?.jobs;

    for (const p of profiles || []) {
      console.log(`[NOTIFY] ${p.email}: ${candidate?.full_name} ${outcome} for ${job?.title}. Reason: ${reason || "N/A"}`);
    }

    // Log event
    await supabase.from("candidate_events").insert({
      candidate_id: candidateId,
      action_type: "admin_notified",
      notes: `Admin/HR notified: ${outcome}${reason ? ` — ${reason}` : ""}${notes ? ` — ${notes}` : ""}`,
    });
  } catch (e) {
    console.warn("Failed to notify admins:", e);
  }
}
