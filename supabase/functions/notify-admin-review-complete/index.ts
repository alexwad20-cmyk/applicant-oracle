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
    const { candidate_id, decision, reason, notes } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get candidate + job info
    const { data: candidate } = await supabase
      .from("candidates")
      .select("full_name, job_id")
      .eq("id", candidate_id)
      .single();

    if (!candidate) throw new Error("Candidate not found");

    const { data: job } = await supabase
      .from("jobs")
      .select("title")
      .eq("id", candidate.job_id)
      .single();

    // Get all admin/hr users
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "hr"]);

    const adminUserIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];

    if (adminUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email")
        .in("user_id", adminUserIds);

      // In production, send emails. For now, log.
      for (const p of profiles || []) {
        console.log(`[NOTIFY] Admin ${p.email}: ${candidate.full_name} ${decision} for ${job?.title}. Reason: ${reason || "N/A"}`);
      }
    }

    // Log event
    await supabase.from("candidate_events").insert({
      candidate_id,
      action_type: "admin_notified",
      notes: `Admin notified of ${decision}${reason ? `: ${reason}` : ""}`,
    });

    return new Response(JSON.stringify({ success: true, notified: adminUserIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
