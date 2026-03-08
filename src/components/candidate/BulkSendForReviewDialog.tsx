import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, X, Users, ChevronRight, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useJobs } from "@/contexts/JobsContext";
import { useToast } from "@/hooks/use-toast";
import { DbCandidate, DbJob } from "@/types/database";
import { EmailComposer } from "@/components/email/EmailComposer";
import { interpolateTemplate, PlaceholderValues, buildCandidateBlockHtml } from "@/lib/emailPlaceholders";

interface UserOption {
  user_id: string;
  email: string;
  full_name: string;
}

interface HmGroup {
  hm: UserOption;
  candidates: DbCandidate[];
  jobs: Map<string, DbJob | undefined>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCandidates: DbCandidate[];
  onComplete: () => void;
}

export const BulkSendForReviewDialog = ({ open, onOpenChange, selectedCandidates, onComplete }: Props) => {
  const { user } = useAuth();
  const { jobs, updateCandidateStage, updateJob } = useJobs();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [hiringManagers, setHiringManagers] = useState<UserOption[]>([]);
  const [hmAssignments, setHmAssignments] = useState<Record<string, string>>({});
  const [hmGroups, setHmGroups] = useState<HmGroup[]>([]);
  const [previewGroupIdx, setPreviewGroupIdx] = useState(0);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [defaultSubject, setDefaultSubject] = useState("");
  const [defaultHtml, setDefaultHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResults, setSendResults] = useState<{ hm: string; success: boolean; error?: string }[]>([]);
  const [removedCandidates, setRemovedCandidates] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSendResults([]);
      setSendProgress(0);
      setRemovedCandidates(new Set());
      return;
    }

    const fetchData = async () => {
      const { data: hmRoles } = await supabase
        .from("user_roles").select("user_id").eq("role", "hiring_manager");
      if (hmRoles && hmRoles.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles").select("user_id, email, full_name")
          .in("user_id", hmRoles.map((r: any) => r.user_id));
        setHiringManagers((profiles || []) as UserOption[]);
      }

      const { data: tmpl } = await supabase
        .from("email_templates")
        .select("subject_template, html_template")
        .eq("key", "hm_review_request_bulk")
        .eq("is_active", true)
        .single();
      if (tmpl) {
        setSubject((tmpl as any).subject_template);
        setHtmlBody((tmpl as any).html_template);
        setDefaultSubject((tmpl as any).subject_template);
        setDefaultHtml((tmpl as any).html_template);
      }
    };

    fetchData();

    // Pre-populate HM assignments from jobs
    const assignments: Record<string, string> = {};
    for (const c of selectedCandidates) {
      const job = jobs.find(j => j.id === c.job_id);
      if (job?.hiring_manager_user_id) {
        assignments[c.job_id] = job.hiring_manager_user_id;
      }
    }
    setHmAssignments(assignments);
  }, [open, selectedCandidates, jobs]);

  // Jobs that need HM assignment
  const jobsNeedingHm = useMemo(() => {
    const jobIds = [...new Set(selectedCandidates.map(c => c.job_id))];
    return jobIds.filter(jid => !hmAssignments[jid]);
  }, [selectedCandidates, hmAssignments]);

  const canProceedStep1 = jobsNeedingHm.length === 0;

  // Build groups
  useEffect(() => {
    if (step < 2) return;
    const groups = new Map<string, HmGroup>();
    const activeCandidates = selectedCandidates.filter(c => !removedCandidates.has(c.id));

    for (const c of activeCandidates) {
      const hmId = hmAssignments[c.job_id];
      if (!hmId) continue;
      const hm = hiringManagers.find(h => h.user_id === hmId);
      if (!hm) continue;

      if (!groups.has(hmId)) {
        groups.set(hmId, { hm, candidates: [], jobs: new Map() });
      }
      const g = groups.get(hmId)!;
      g.candidates.push(c);
      if (!g.jobs.has(c.job_id)) {
        g.jobs.set(c.job_id, jobs.find(j => j.id === c.job_id));
      }
    }
    setHmGroups(Array.from(groups.values()));
  }, [step, selectedCandidates, hmAssignments, hiringManagers, jobs, removedCandidates]);

  const currentGroup = hmGroups[previewGroupIdx];

  const previewValues: PlaceholderValues = useMemo(() => {
    if (!currentGroup) return {};
    const listHtml = currentGroup.candidates
      .map(c => buildCandidateBlockHtml(c, currentGroup.jobs.get(c.job_id)))
      .join("");
    return {
      "{{hm_name}}": currentGroup.hm.full_name || currentGroup.hm.email,
      "{{hm_email}}": currentGroup.hm.email,
      "{{candidate_count}}": String(currentGroup.candidates.length),
      "{{candidate_list_html}}": listHtml,
      "{{candidate_list_text}}": currentGroup.candidates.map(c => `- ${c.full_name}`).join("\n"),
    };
  }, [currentGroup]);

  const removeCandidate = (candidateId: string) => {
    setRemovedCandidates(prev => new Set(prev).add(candidateId));
  };

  const handleSend = async () => {
    setSending(true);
    setSendProgress(0);
    const results: typeof sendResults = [];

    for (let i = 0; i < hmGroups.length; i++) {
      const group = hmGroups[i];
      try {
        // Assign HM to jobs that don't have one
        for (const [jobId] of group.jobs) {
          const job = jobs.find(j => j.id === jobId);
          if (job && job.hiring_manager_user_id !== group.hm.user_id) {
            await updateJob(jobId, { hiring_manager_user_id: group.hm.user_id } as any);
          }
        }

        // Send via edge function
        await supabase.functions.invoke("send-review-emails", {
          body: {
            mode: "bulk",
            candidate_ids: group.candidates.map(c => c.id),
            hm_user_id: group.hm.user_id,
            subject_override: subject !== defaultSubject ? subject : null,
            html_override: htmlBody !== defaultHtml ? htmlBody : null,
          },
        });

        // Update stages
        for (const c of group.candidates) {
          if (c.stage === "new_applicant") {
            await updateCandidateStage(c.id, "hm_review", "Bulk sent to HM review");
          }
        }

        results.push({ hm: group.hm.full_name || group.hm.email, success: true });
      } catch (err: any) {
        results.push({ hm: group.hm.full_name || group.hm.email, success: false, error: err.message });
      }
      setSendProgress(((i + 1) / hmGroups.length) * 100);
    }

    setSendResults(results);
    setSending(false);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    toast({
      title: "Bulk send complete",
      description: `${successCount} HM(s) emailed${failCount > 0 ? `, ${failCount} failed` : ""}`,
    });

    if (failCount === 0) {
      setTimeout(() => {
        onOpenChange(false);
        onComplete();
      }, 1500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Send for HM Review</DialogTitle>
          <DialogDescription>
            Send review emails to hiring managers for {selectedCandidates.length} selected candidate(s).
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm mb-2">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-1">
              <Badge variant={step === s ? "default" : step > s ? "secondary" : "outline"} className="text-xs">
                {s}
              </Badge>
              <span className={step === s ? "font-medium" : "text-muted-foreground"}>
                {s === 1 ? "Validate" : s === 2 ? "Review Groups" : "Compose & Send"}
              </span>
              {s < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step 1: Validate */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ensure each job has a hiring manager assigned.
            </p>
            {jobsNeedingHm.length === 0 ? (
              <p className="text-sm text-success font-medium">✓ All candidates have HMs assigned.</p>
            ) : (
              <div className="space-y-3">
                {jobsNeedingHm.map(jobId => {
                  const job = jobs.find(j => j.id === jobId);
                  return (
                    <div key={jobId} className="flex items-center gap-3">
                      <span className="text-sm font-medium min-w-[200px]">{job?.title || jobId}</span>
                      <Select
                        value={hmAssignments[jobId] || ""}
                        onValueChange={v => setHmAssignments(prev => ({ ...prev, [jobId]: v }))}
                      >
                        <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Choose HM..." />
                        </SelectTrigger>
                        <SelectContent>
                          {hiringManagers.map(hm => (
                            <SelectItem key={hm.user_id} value={hm.user_id}>
                              {hm.full_name || hm.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full">
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2: Review Groups */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Candidates grouped by hiring manager. Remove any if needed.
            </p>
            {hmGroups.map((group, idx) => (
              <div key={group.hm.user_id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{group.hm.full_name || group.hm.email}</span>
                  <Badge variant="secondary" className="text-xs">{group.candidates.length} candidate(s)</Badge>
                </div>
                <div className="space-y-1 pl-6">
                  {group.candidates.map(c => {
                    const job = group.jobs.get(c.job_id);
                    return (
                      <div key={c.id} className="flex items-center justify-between text-sm">
                        <span>{c.full_name} — {job?.title || "Unknown"}</span>
                        <Button variant="ghost" size="sm" onClick={() => removeCandidate(c.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={hmGroups.length === 0} className="flex-1">
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Compose & Send */}
        {step === 3 && (
          <div className="space-y-4">
            {hmGroups.length > 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Preview for:</Label>
                <Select
                  value={String(previewGroupIdx)}
                  onValueChange={v => setPreviewGroupIdx(Number(v))}
                >
                  <SelectTrigger className="w-[250px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hmGroups.map((g, i) => (
                      <SelectItem key={i} value={String(i)} className="text-xs">
                        {g.hm.full_name || g.hm.email} ({g.candidates.length} candidates)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <EmailComposer
              templateKey="hm_review_request_bulk"
              defaultSubject={defaultSubject}
              defaultHtml={defaultHtml}
              subject={subject}
              htmlBody={htmlBody}
              onSubjectChange={setSubject}
              onHtmlChange={setHtmlBody}
              previewValues={previewValues}
              showSaveDraft={false}
            />

            {sending && (
              <div className="space-y-2">
                <Progress value={sendProgress} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">
                  Sending... {Math.round(sendProgress)}%
                </p>
              </div>
            )}

            {sendResults.length > 0 && (
              <div className="space-y-1">
                {sendResults.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant={r.success ? "default" : "destructive"} className="text-xs">
                      {r.success ? "✓" : "✗"}
                    </Badge>
                    <span>{r.hm}</span>
                    {r.error && <span className="text-destructive text-xs">— {r.error}</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={sending}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleSend} disabled={sending || hmGroups.length === 0} className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Sending..." : `Send to ${hmGroups.length} Hiring Manager(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
