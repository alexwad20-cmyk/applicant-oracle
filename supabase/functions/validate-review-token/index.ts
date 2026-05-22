// PUBLIC token-only. Hashes input token before lookup.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashToken } from "../_shared/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { token } = await req.json();
    if (!token) throw new Error("Token required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokenRecord } = await supabase
      .from("review_tokens")
      .select("*, candidates(full_name, job_id)")
      .eq("token_hash", await hashToken(token))
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!tokenRecord) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid or expired token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const candidate = (tokenRecord as { candidates?: { full_name?: string; job_id?: string } }).candidates;
    let jobTitle = "Unknown Position";
    if (candidate?.job_id) {
      const { data: job } = await supabase.from("jobs").select("title").eq("id", candidate.job_id).single();
      if (job) jobTitle = job.title;
    }

    return new Response(JSON.stringify({
      valid: true,
      candidate_name: candidate?.full_name,
      job_title: jobTitle,
      candidate_id: tokenRecord.candidate_id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ valid: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
