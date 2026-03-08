import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useJobs } from "@/contexts/JobsContext";
import { useToast } from "@/hooks/use-toast";
import { DbCandidate, DbJob } from "@/types/database";
import { EmailComposer } from "@/components/email/EmailComposer";
import { buildCandidatePlaceholders, PlaceholderValues } from "@/lib/emailPlaceholders";

interface Props {
  candidate: DbCandidate;
  job: DbJob | undefined;
  onSent: () => void;
}

interface UserOption {
  user_id: string;
  email: string;
  full_name: string;
}

export const SendForReviewDialog = ({ candidate, job, onSent }: Props) => {
  const { user } = useAuth();
  const { updateCandidateStage, updateJob } = useJobs();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [hiringManagers, setHiringManagers] = useState<UserOption[]>([]);
  const [reviewers, setReviewers] = useState<UserOption[]>([]);
  const [selectedHM, setSelectedHM] = useState("");
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [defaultSubject, setDefaultSubject] = useState("");
  const [defaultHtml, setDefaultHtml] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchUsers = async () => {
      const { data: hmRoles } = await supabase
        .from("user_roles").select("user_id").eq("role", "hiring_manager");
      const { data: revRoles } = await supabase
        .from("user_roles").select("user_id").eq("role", "reviewer");

      const allUserIds = [
        ...(hmRoles || []).map((r: any) => r.user_id),
        ...(revRoles || []).map((r: any) => r.user_id),
      ];

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles").select("user_id, email, full_name")
          .in("user_id", [...new Set(allUserIds)]);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        setHiringManagers((hmRoles || []).map((r: any) => profileMap.get(r.user_id)).filter(Boolean) as UserOption[]);
        setReviewers((revRoles || []).map((r: any) => profileMap.get(r.user_id)).filter(Boolean) as UserOption[]);
      }
      if (job?.hiring_manager_user_id) setSelectedHM(job.hiring_manager_user_id);
    };

    const fetchTemplate = async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("subject_template, html_template")
        .eq("key", "hm_review_request_single")
        .eq("is_active", true)
        .single();

      if (data) {
        setSubject((data as any).subject_template);
        setHtmlBody((data as any).html_template);
        setDefaultSubject((data as any).subject_template);
        setDefaultHtml((data as any).html_template);
      } else {
        const fallbackSubject = `Review Required: ${candidate.full_name} for ${job?.title || "Position"}`;
        const fallbackHtml = `<p>Hi,</p><p>Please review <strong>${candidate.full_name}</strong> for <strong>${job?.title || "Position"}</strong>.</p>`;
        setSubject(fallbackSubject);
        setHtmlBody(fallbackHtml);
        setDefaultSubject(fallbackSubject);
        setDefaultHtml(fallbackHtml);
      }
    };

    fetchUsers();
    fetchTemplate();
  }, [open, candidate, job]);

  const selectedHMProfile = hiringManagers.find(h => h.user_id === selectedHM);
  const hmName = selectedHMProfile?.full_name || selectedHMProfile?.email || "Hiring Manager";

  const previewValues: PlaceholderValues = useMemo(() => ({
    ...buildCandidatePlaceholders(candidate, job),
    "{{hm_name}}": hmName,
    "{{hm_email}}": selectedHMProfile?.email || "",
  }), [candidate, job, hmName, selectedHMProfile]);

  const toggleReviewer = (userId: string) => {
    setSelectedReviewers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSend = async () => {
    if (!selectedHM) {
      toast({ title: "Please select a hiring manager", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      if (job && job.hiring_manager_user_id !== selectedHM) {
        await updateJob(job.id, { hiring_manager_user_id: selectedHM } as any);
      }
      for (const revId of selectedReviewers) {
        await supabase.from("candidate_reviewer_access").insert({
          candidate_id: candidate.id,
          reviewer_user_id: revId,
          granted_by: user?.id,
        } as any).select();
      }

      // Send via edge function
      await supabase.functions.invoke("send-review-emails", {
        body: {
          mode: "single",
          candidate_id: candidate.id,
          hm_user_id: selectedHM,
          subject_override: subject !== defaultSubject ? subject : null,
          html_override: htmlBody !== defaultHtml ? htmlBody : null,
        },
      });

      await updateCandidateStage(candidate.id, "hm_review", "Sent to hiring manager for review");

      toast({
        title: "Sent for Review",
        description: `Email sent to ${hmName}. Candidate moved to HM Review.`,
      });
      setOpen(false);
      onSent();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to send", variant: "destructive" });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <Mail className="h-4 w-4 mr-2" />
          Send for HM Review
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send for Hiring Manager Review</DialogTitle>
          <DialogDescription>
            Choose recipients, review and edit the email before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Recipient Selection */}
          <div className="space-y-4 border-b pb-4">
            <div className="space-y-2">
              <Label className="font-medium">Hiring Manager *</Label>
              <Select value={selectedHM} onValueChange={setSelectedHM}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hiring manager" />
                </SelectTrigger>
                <SelectContent>
                  {hiringManagers.map(hm => (
                    <SelectItem key={hm.user_id} value={hm.user_id}>
                      {hm.full_name || hm.email} {hm.full_name ? `(${hm.email})` : ""}
                    </SelectItem>
                  ))}
                  {hiringManagers.length === 0 && (
                    <SelectItem value="none" disabled>
                      No hiring managers found — invite one first
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {reviewers.length > 0 && (
              <div className="space-y-2">
                <Label className="font-medium">Also share with reviewers (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {reviewers.map(rev => (
                    <Button
                      key={rev.user_id}
                      type="button"
                      variant={selectedReviewers.includes(rev.user_id) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleReviewer(rev.user_id)}
                      className="text-xs"
                    >
                      {rev.full_name || rev.email}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Email Composer */}
          <EmailComposer
            templateKey="hm_review_request_single"
            defaultSubject={defaultSubject}
            defaultHtml={defaultHtml}
            subject={subject}
            htmlBody={htmlBody}
            onSubjectChange={setSubject}
            onHtmlChange={setHtmlBody}
            previewValues={previewValues}
            candidateId={candidate.id}
            hmUserId={selectedHM}
          />

          {/* Send Button */}
          <Button className="w-full" onClick={handleSend} disabled={submitting || !selectedHM}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Sending..." : "Send for Review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
