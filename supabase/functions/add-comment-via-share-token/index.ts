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
    const { token, comment, author_email, author_name } = await req.json();
    if (!token || !comment) throw new Error("Token and comment required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Hash and validate token
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    const { data: share } = await supabase
      .from("candidate_email_shares")
      .select("*")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!share) {
      return new Response(JSON.stringify({ error: "Invalid or expired link" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const displayEmail = author_email || share.recipient_email;
    const displayName = author_name ? `${author_name} (${displayEmail})` : displayEmail;

    // Insert comment
    await supabase.from("candidate_comments").insert({
      candidate_id: share.candidate_id,
      author_email: displayName,
      body: comment,
      source: "link",
      visibility: "internal_only",
    });

    // Log event
    await supabase.from("candidate_events").insert({
      candidate_id: share.candidate_id,
      action_type: "comment_added",
      notes: `Comment via share link from ${displayEmail}`,
    });

    // Notify admins, HR, and sender
    await notifyOnComment(supabase, share.candidate_id, comment, displayEmail, share.created_by);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function notifyOnComment(
  supabase: any,
  candidateId: string,
  commentBody: string,
  commenterEmail: string,
  senderId: string
) {
  try {
    // Get candidate info
    const { data: candidate } = await supabase
      .from("candidates")
      .select("full_name, jobs!candidates_job_id_fkey(title, department, hiring_manager_user_id)")
      .eq("id", candidateId)
      .single();

    // Get all admin + HR user IDs
    const { data: adminHrRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "hr"]);

    const notifyUserIds = new Set<string>();
    (adminHrRoles || []).forEach((r: any) => notifyUserIds.add(r.user_id));
    notifyUserIds.add(senderId); // Always notify sender
    
    // Add HM if different
    const job = (candidate as any)?.jobs;
    if (job?.hiring_manager_user_id) {
      notifyUserIds.add(job.hiring_manager_user_id);
    }

    // Get emails
    const { data: profiles } = await supabase
      .from("profiles")
      .select("email")
      .in("user_id", Array.from(notifyUserIds));

    const recipientEmails = (profiles || []).map((p: any) => p.email).filter(Boolean);

    console.log(`Notification would be sent to: ${recipientEmails.join(", ")}`);
    console.log(`New comment on ${candidate?.full_name} from ${commenterEmail}: ${commentBody.substring(0, 100)}`);

    // Log notification event
    await supabase.from("candidate_events").insert({
      candidate_id: candidateId,
      action_type: "comment_notified",
      notes: `Notified ${recipientEmails.length} users about comment from ${commenterEmail}`,
    });
  } catch (e) {
    console.error("Notification failed:", e);
  }
}
