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
    const { token } = await req.json();
    if (!token) throw new Error("Token required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Hash the token
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    // Look up share
    const { data: share } = await supabase
      .from("candidate_email_shares")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!share) {
      return new Response(JSON.stringify({ error: "Link expired or revoked" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get candidate + job
    const { data: candidate } = await supabase
      .from("candidates")
      .select("full_name, source, visa_required, cv_file_path, jobs!candidates_job_id_fkey(title, department)")
      .eq("id", share.candidate_id)
      .single();

    if (!candidate) {
      return new Response(JSON.stringify({ error: "Candidate not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CV signed URL
    let cvUrl: string | null = null;
    if (candidate.cv_file_path) {
      const { data: signedData } = await supabase.storage
        .from("candidate-cvs")
        .createSignedUrl(candidate.cv_file_path, 3600);
      if (signedData?.signedUrl) cvUrl = signedData.signedUrl;
    }

    // Get comments for this candidate
    const { data: comments } = await supabase
      .from("candidate_comments")
      .select("body, author_email, created_at, source")
      .eq("candidate_id", share.candidate_id)
      .order("created_at", { ascending: true });

    // Update last_viewed_at
    await supabase
      .from("candidate_email_shares")
      .update({ last_viewed_at: new Date().toISOString() })
      .eq("id", share.id);

    const job = (candidate as any).jobs;

    return new Response(JSON.stringify({
      full_name: candidate.full_name,
      job_title: job?.title || "Position",
      department: job?.department || "",
      source: candidate.source,
      visa_required: candidate.visa_required,
      cv_url: cvUrl,
      comments: comments || [],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
