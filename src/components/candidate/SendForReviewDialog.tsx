import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Send, Eye, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useJobs } from "@/contexts/JobsContext";
import { useToast } from "@/hooks/use-toast";
import { DbCandidate, DbJob } from "@/types/database";

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
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<string>("edit");

  // Fetch HMs, reviewers, and template when dialog opens
  useEffect(() => {
    if (!open) return;

    const fetchUsers = async () => {
      // Fetch hiring managers
      const { data: hmRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "hiring_manager");

      // Fetch reviewers
      const { data: revRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "reviewer");

      const allUserIds = [
        ...(hmRoles || []).map((r: any) => r.user_id),
        ...(revRoles || []).map((r: any) => r.user_id),
      ];

      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", [...new Set(allUserIds)]);

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

        setHiringManagers(
          (hmRoles || [])
            .map((r: any) => profileMap.get(r.user_id))
            .filter(Boolean) as UserOption[]
        );
        setReviewers(
          (revRoles || [])
            .map((r: any) => profileMap.get(r.user_id))
            .filter(Boolean) as UserOption[]
        );
      }

      // Pre-select current HM if set on job
      if (job?.hiring_manager_user_id) {
        setSelectedHM(job.hiring_manager_user_id);
      }
    };

    const fetchTemplate = async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("subject_template, html_template")
        .eq("key", "hm_review_request")
        .eq("is_active", true)
        .single();

      if (data) {
        setSubject((data as any).subject_template);
        setHtmlBody((data as any).html_template);
        setTemplateLoaded(true);
      } else {
        // Fallback
        setSubject(`Review Required: ${candidate.full_name} for ${job?.title || "Position"}`);
        setHtmlBody(`<p>Hi,</p><p>Please review candidate <strong>${candidate.full_name}</strong> for <strong>${job?.title || "the position"}</strong>.</p>`);
        setTemplateLoaded(true);
      }
    };

    fetchUsers();
    fetchTemplate();
  }, [open, candidate, job]);

  // Replace placeholders in content
  const interpolate = (text: string, hmName: string) => {
    const reviewLink = `${window.location.origin}/candidates/${candidate.id}`;
    return text
      .split("{{candidate_name}}").join(candidate.full_name)
      .split("{{job_title}}").join(job?.title || "Position")
      .split("{{hiring_manager_name}}").join(hmName || "Hiring Manager")
      .split("{{review_link}}").join(reviewLink)
      .split("{{days_waiting}}").join("3");
  };

  const selectedHMProfile = hiringManagers.find(h => h.user_id === selectedHM);
  const hmName = selectedHMProfile?.full_name || selectedHMProfile?.email || "Hiring Manager";

  const previewSubject = useMemo(() => interpolate(subject, hmName), [subject, selectedHM, candidate, job]);
  const previewHtml = useMemo(() => interpolate(htmlBody, hmName), [htmlBody, selectedHM, candidate, job]);

  const toggleReviewer = (userId: string) => {
    setSelectedReviewers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSend = async () => {
    if (!selectedHM) {
      toast({ title: "Please select a hiring manager", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      // 1. Assign HM to job if different
      if (job && job.hiring_manager_user_id !== selectedHM) {
        await updateJob(job.id, { hiring_manager_user_id: selectedHM } as any);
      }

      // 2. Grant reviewer access for selected reviewers
      for (const revId of selectedReviewers) {
        await supabase.from("candidate_reviewer_access").insert({
          candidate_id: candidate.id,
          reviewer_user_id: revId,
          granted_by: user?.id,
        } as any).select();
      }

      // 3. Update candidate stage to hm_review
      await updateCandidateStage(candidate.id, "hm_review", "Sent to hiring manager for review");

      toast({
        title: "Sent for Review",
        description: `Email prepared for ${hmName}. Candidate moved to HM Review.`,
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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                  {reviewers.map(rev => {
                    const isSelected = selectedReviewers.includes(rev.user_id);
                    return (
                      <Button
                        key={rev.user_id}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleReviewer(rev.user_id)}
                        className="text-xs"
                      >
                        {rev.full_name || rev.email}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Email Edit / Preview Tabs */}
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="edit" className="flex-1">
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Edit Email
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Subject</Label>
                <Input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Email subject..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Body (HTML)</Label>
                <Textarea
                  value={htmlBody}
                  onChange={e => setHtmlBody(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Placeholders: {"{{candidate_name}}"}, {"{{job_title}}"}, {"{{hiring_manager_name}}"}, {"{{review_link}}"}
              </p>
            </TabsContent>

            <TabsContent value="preview" className="mt-3 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="font-medium text-sm mt-0.5">{previewSubject}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <p className="text-sm mt-0.5">
                  {selectedHMProfile ? `${selectedHMProfile.full_name || ""} <${selectedHMProfile.email}>` : "No hiring manager selected"}
                </p>
              </div>
              <div className="border rounded-lg p-4 bg-card">
                <div
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                  className="prose prose-sm max-w-none"
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Send Button */}
          <Button
            className="w-full"
            onClick={handleSend}
            disabled={submitting || !selectedHM}
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Sending..." : "Send for Review"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
