// Authenticated. Called from the app after a stage change, OR from review-action
// (which forwards the service-role key). Sends a real email when configured.

import { requireAuth } from "../_shared/auth.ts";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await requireAuth(req);
    const { candidate_id, decision, reason, notes } = await req.json();
    if (!candidate_id || !decision) {
      return new Response(JSON.stringify({ error: "candidate_id and decision required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only HR/Admin (or service role) may broadcast admin notifications.
    if (!ctx.isHrOrAdmin && !ctx.isServiceRole) {
      // HMs trigger this implicitly via stage change — allow if they own the candidate
      const isHm = await ctx.isHm(candidate_id);
      if (!isHm) {
        return new Response(JSON.stringify({ error: "Permission denied" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: candidate } = await ctx.admin
      .from("candidates").select("full_name, job_id").eq("id", candidate_id).single();
    if (!candidate) throw new Error("Candidate not found");

    const { data: job } = await ctx.admin
      .from("jobs").select("title").eq("id", candidate.job_id).single();

    const { data: roles } = await ctx.admin
      .from("user_roles").select("user_id").in("role", ["admin", "hr"]);
    const userIds = [...new Set((roles || []).map(r => r.user_id))];

    let recipients: string[] = [];
    if (userIds.length) {
      const { data: profiles } = await ctx.admin
        .from("profiles").select("email").in("user_id", userIds);
      recipients = (profiles || []).map(p => p.email).filter(Boolean);
    }

    let emailed = 0;
    let emailError: string | null = null;
    if (isEmailConfigured() && recipients.length) {
      try {
        const html = `<p>HM review complete for <strong>${candidate.full_name}</strong> (${job?.title ?? ""}).</p>
          <p>Decision: <strong>${decision}</strong></p>
          ${reason ? `<p>Reason: ${reason}</p>` : ""}
          ${notes ? `<p>Notes: ${notes}</p>` : ""}`;
        await sendEmail({ to: recipients, subject: `Review complete: ${candidate.full_name} — ${decision}`, html });
        emailed = recipients.length;
      } catch (e) {
        emailError = (e as Error).message;
      }
    } else if (!isEmailConfigured()) {
      emailError = "email_not_configured";
    }

    await ctx.admin.from("candidate_events").insert({
      candidate_id,
      action_type: "admin_notified",
      notes: emailed
        ? `Emailed ${emailed} admin/HR users (${decision})`
        : `Admin notification queued but not sent (${emailError ?? "no recipients"})`,
    });

    return new Response(JSON.stringify({ success: true, emailed, email_error: emailError }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
