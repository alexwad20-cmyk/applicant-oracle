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
    const trimmedComment = String(comment || "").trim();
    const trimmedEmail = String(author_email || "").trim();
    const trimmedName = String(author_name || "").trim();

    if (!token || !trimmedComment) throw new Error("Token and comment required");
    if (trimmedComment.length > 4000) throw new Error("Comment is too long");
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new Error("Invalid email address");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
      return json({ error: "Invalid or expired link" }, 401);
    }

    const displayEmail = trimmedEmail || share.recipient_email;
    const displayName = trimmedName ? `${trimmedName} (${displayEmail})` : displayEmail;

    await supabase.from("candidate_comments").insert({
      candidate_id: share.candidate_id,
      author_email: displayName,
      body: trimmedComment,
      source: "link",
      visibility: "internal_only",
    });

    await supabase.from("candidate_events").insert({
      candidate_id: share.candidate_id,
      action_type: "comment_added",
      notes: `Comment submitted via share link from ${displayEmail}`,
    });

    await logNotificationRecipients(supabase, share.candidate_id, displayEmail, share.created_by);

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logNotificationRecipients(
  supabase: any,
  candidateId: string,
  commenterEmail: string,
  senderId: string
) {
  try {
    const { data: candidate } = await supabase
      .from("candidates")
      .select("jobs!candidates_job_id_fkey(hiring_manager_user_id)")
      .eq("id", candidateId)
      .single();

    const { data: adminHrRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "hr"]);

    const notifyUserIds = new Set<string>();
    (adminHrRoles || []).forEach((r: any) => notifyUserIds.add(r.user_id));
    if (senderId) notifyUserIds.add(senderId);

    const job = (candidate as any)?.jobs;
    if (job?.hiring_manager_user_id) notifyUserIds.add(job.hiring_manager_user_id);

    await supabase.from("candidate_events").insert({
      candidate_id: candidateId,
      action_type: "comment_notification_pending",
      notes: `Comment from ${commenterEmail}; ${notifyUserIds.size} internal recipient(s) identified for notification`,
    });
  } catch (e) {
    console.error("Notification recipient logging failed:", e);
  }
}
