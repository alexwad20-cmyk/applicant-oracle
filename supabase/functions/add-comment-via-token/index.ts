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
    const { token, comment } = await req.json();
    if (!token || !comment) throw new Error("Token and comment required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate token
    const { data: tokenRecord } = await supabase
      .from("review_tokens")
      .select("*")
      .eq("token_hash", token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!tokenRecord) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Add comment
    await supabase.from("candidate_comments").insert({
      candidate_id: tokenRecord.candidate_id,
      author_email: "reviewer@email-link",
      body: comment,
      source: "email",
      visibility: "internal_only",
    });

    // Mark token as used
    await supabase
      .from("review_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
