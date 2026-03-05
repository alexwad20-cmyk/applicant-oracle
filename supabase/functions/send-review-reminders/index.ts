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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find overdue candidates in hm_review with reminder_count < 5
    const { data: candidates, error } = await supabase
      .from("candidates")
      .select("id, full_name, email, job_id, hm_review_due_at, last_reminder_sent_at, reminder_count")
      .eq("stage", "hm_review")
      .lt("reminder_count", 5);

    if (error) throw error;

    const now = new Date();
    let sent = 0;

    for (const c of candidates || []) {
      // Only send if overdue or last reminder > 24h ago
      const isOverdue = c.hm_review_due_at && new Date(c.hm_review_due_at) < now;
      const lastReminder = c.last_reminder_sent_at ? new Date(c.last_reminder_sent_at) : null;
      const reminderDue = !lastReminder || (now.getTime() - lastReminder.getTime()) > 24 * 60 * 60 * 1000;

      if (!isOverdue || !reminderDue) continue;

      // Get hiring manager info
      const { data: job } = await supabase
        .from("jobs")
        .select("title, hiring_manager_user_id")
        .eq("id", c.job_id)
        .single();

      if (!job?.hiring_manager_user_id) continue;

      // Log the reminder (in production, this would send an email)
      console.log(`[REMINDER] Candidate: ${c.full_name}, Job: ${job.title}, HM: ${job.hiring_manager_user_id}, Reminder #${c.reminder_count + 1}`);

      // Update candidate
      await supabase
        .from("candidates")
        .update({
          last_reminder_sent_at: now.toISOString(),
          reminder_count: c.reminder_count + 1,
        })
        .eq("id", c.id);

      // Log event
      await supabase.from("candidate_events").insert({
        candidate_id: c.id,
        action_type: "reminder_sent",
        notes: `Reminder #${c.reminder_count + 1} sent to hiring manager`,
      });

      sent++;
    }

    return new Response(JSON.stringify({ success: true, reminders_sent: sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
