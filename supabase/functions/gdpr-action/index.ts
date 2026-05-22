// Authenticated. HR/Admin only. Performs anonymise / delete / remove-cv / expire-links
// for a candidate, handling both the storage object and the DB cascade.

import { requireAuth, requireRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await requireAuth(req);
    const { action, candidate_id } = await req.json();
    if (!action || !candidate_id) {
      return json({ error: "action and candidate_id required" }, 400);
    }

    // Expire-links is allowed for HR/Admin OR HM-for-candidate; everything else is HR/Admin only.
    if (action === "expire_links") {
      if (!ctx.isHrOrAdmin) {
        const isHm = await ctx.isHm(candidate_id);
        if (!isHm) return json({ error: "Permission denied" }, 403);
      }
    } else {
      requireRole(ctx, "hr_admin");
    }

    // Look up CV path before we mutate
    const { data: cand } = await ctx.admin
      .from("candidates").select("cv_file_path").eq("id", candidate_id).single();
    const cvPath = cand?.cv_file_path ?? null;

    if (action === "remove_cv" || action === "anonymize" || action === "delete") {
      if (cvPath) {
        await ctx.admin.storage.from("candidate-cvs").remove([cvPath]);
      }
    }

    if (action === "remove_cv") {
      await ctx.admin.from("candidates").update({ cv_file_path: null }).eq("id", candidate_id);
      await ctx.admin.from("candidate_events").insert({
        candidate_id, actor_user_id: ctx.userId, action_type: "cv_removed",
        notes: "CV file removed",
      });
      return json({ success: true });
    }

    if (action === "anonymize") {
      const { error } = await ctx.admin.rpc("anonymize_candidate", { _candidate_id: candidate_id });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "delete") {
      const { error } = await ctx.admin.rpc("delete_candidate_cascade", { _candidate_id: candidate_id });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "expire_links") {
      const { error } = await ctx.admin.rpc("expire_candidate_share_links", { _candidate_id: candidate_id });
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: (e as Error).message }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
