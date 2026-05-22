import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) return json({ error: "Token required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const { data: share } = await supabase
      .from("candidate_email_shares")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!share) return json({ error: "Link expired or revoked" }, 401);

    const { data: candidate } = await supabase
      .from("candidates")
      .select("full_name, source, visa_required, cv_file_path, jobs!candidates_job_id_fkey(title, department)")
      .eq("id", share.candidate_id)
      .single();

    if (!candidate) return json({ error: "Candidate not found" }, 404);

    let cvUrl: string | null = null;
    if (share.attach_cv === true && candidate.cv_file_path) {
      const { data: signedData } = await supabase.storage
        .from("candidate-cvs")
        .createSignedUrl(candidate.cv_file_path, 3600);
      if (signedData?.signedUrl) cvUrl = signedData.signedUrl;
    }

    await supabase
      .from("candidate_email_shares")
      .update({ last_viewed_at: new Date().toISOString() })
      .eq("id", share.id);

    const job = (candidate as any).jobs;

    return json({
      full_name: candidate.full_name,
      job_title: job?.title || "Position",
      department: job?.department || "",
      source: candidate.source,
      visa_required: candidate.visa_required,
      cv_url: cvUrl,
      comments: [],
    });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
