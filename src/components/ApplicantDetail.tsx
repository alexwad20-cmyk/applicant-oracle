import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, Phone, FileText, Check, X, Clock, Download } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "./AppLayout";
import { STAGE_LABELS, REJECTION_REASON_LABELS, CandidateStage, RejectionReason, DbCandidateEvent } from "@/types/database";
import { CommentPanel } from "./comments/CommentPanel";
import { ShareWithReviewer } from "./comments/ShareWithReviewer";
import { GdprControls } from "./candidate/GdprControls";
import { SendForReviewDialog } from "./candidate/SendForReviewDialog";
import { ShareHistory } from "./candidate/ShareHistory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const ApplicantDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getCandidate, getJob, updateCandidateStage, refreshEvents, getEventsForCandidate } = useJobs();
  const { user } = useAuth();
  const { effectiveIsHrOrAdmin, effectiveIsHM, effectiveCanApproveReject, realIsHrOrAdmin, isImpersonating } = useEffectivePermissions();
  const { toast } = useToast();

  const [rejectReason, setRejectReason] = useState<RejectionReason | ''>('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  const candidate = id ? getCandidate(id) : undefined;
  const job = candidate ? getJob(candidate.job_id) : undefined;
  const events = id ? getEventsForCandidate(id) : [];

  useEffect(() => {
    if (id) refreshEvents(id);
  }, [id, refreshEvents]);

  if (!candidate) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6 text-center py-12">
          <h1 className="text-2xl font-bold mb-4">Candidate Not Found</h1>
          <Button onClick={() => navigate("/applicants")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </AppLayout>
    );
  }

  const handleApprove = async () => {
    if (isImpersonating && !realIsHrOrAdmin) {
      toast({ title: "Preview mode", description: "Action requires real HR/Admin permissions.", variant: "destructive" });
      return;
    }
    await updateCandidateStage(candidate.id, 'hm_approved', 'Approved by hiring manager');
    toast({ title: "Candidate Approved", description: `${candidate.full_name} approved` });
  };

  const handleReject = async () => {
    if (!rejectReason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }
    await updateCandidateStage(candidate.id, 'hm_rejected', rejectNotes, rejectReason);
    toast({ title: "Candidate Rejected", description: `${candidate.full_name} rejected` });
    setRejectOpen(false);
  };

  const handleSendForReview = async () => {
    await updateCandidateStage(candidate.id, 'hm_review', 'Sent to hiring manager for review');
    toast({ title: "Sent for Review" });
  };

  const handleDownloadCv = async () => {
    if (!candidate.cv_file_path) return;
    const { data } = await supabase.storage
      .from('candidate-cvs')
      .createSignedUrl(candidate.cv_file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const canDecide = (effectiveIsHM || effectiveIsHrOrAdmin) && candidate.stage === 'hm_review';

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">{candidate.full_name}</h1>
            <p className="text-muted-foreground">{job?.title || 'Unknown Position'} • {job?.department}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge stage={candidate.stage} />
            {(effectiveIsHrOrAdmin || effectiveIsHM) && (
              <ShareWithReviewer candidateId={candidate.id} candidateName={candidate.full_name} hasCv={!!candidate.cv_file_path} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Info */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Contact</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {candidate.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {candidate.email}
                </div>
              )}
              {candidate.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {candidate.phone}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {candidate.visa_required && <Badge variant="outline">Visa Required</Badge>}
                <Badge variant="outline" className="capitalize">{candidate.source}</Badge>
                {candidate.agency_name && <Badge variant="outline">Agency: {candidate.agency_name}</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {effectiveIsHrOrAdmin && candidate.stage === 'new_applicant' && (
                <SendForReviewDialog
                  candidate={candidate}
                  job={job}
                  onSent={() => toast({ title: "Review process started" })}
                />
              )}

              {canDecide && (
                <div className="flex gap-2">
                  <Button className="flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={handleApprove}>
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" className="flex-1">
                        <X className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Reject Candidate</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label>Reason *</Label>
                          <Select value={rejectReason} onValueChange={(v) => setRejectReason(v as RejectionReason)}>
                            <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(REJECTION_REASON_LABELS).map(([v, l]) => (
                                <SelectItem key={v} value={v}>{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Notes (optional)</Label>
                          <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} rows={3} />
                        </div>
                        <Button variant="destructive" className="w-full" onClick={handleReject}>
                          Confirm Rejection
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              {candidate.cv_file_path && (
                <Button variant="outline" className="w-full" onClick={handleDownloadCv}>
                  <Download className="h-4 w-4 mr-2" />
                  Download CV
                </Button>
              )}

              {candidate.hm_review_due_at && candidate.stage === 'hm_review' && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Review due: {new Date(candidate.hm_review_due_at).toLocaleDateString()}
                  {new Date(candidate.hm_review_due_at) < new Date() && (
                    <Badge variant="destructive" className="text-xs ml-1">Overdue</Badge>
                  )}
                </div>
              )}

              {(effectiveIsHrOrAdmin || effectiveIsHM) && (
                <div className="pt-3 border-t">
                  <ShareHistory candidateId={candidate.id} />
                </div>
              )}

              {effectiveIsHrOrAdmin && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">GDPR Controls</p>
                  <GdprControls candidate={candidate} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {candidate.notes && (
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-lg">Notes</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{candidate.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Audit Trail */}
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg">Activity Log</CardTitle></CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded</p>
              ) : (
                <div className="space-y-3">
                  {events.map(event => (
                    <div key={event.id} className="flex gap-3 text-sm border-l-2 border-muted pl-3">
                      <div className="flex-1">
                        <p className="font-medium capitalize">{event.action_type.replace('_', ' ')}</p>
                        {event.from_stage && event.to_stage && (
                          <p className="text-muted-foreground text-xs">
                            {STAGE_LABELS[event.from_stage]} → {STAGE_LABELS[event.to_stage]}
                          </p>
                        )}
                        {event.reason_code && (
                          <p className="text-xs text-destructive">
                            Reason: {REJECTION_REASON_LABELS[event.reason_code]}
                          </p>
                        )}
                        {event.notes && <p className="text-xs text-muted-foreground mt-1">{event.notes}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <div className="lg:col-span-2">
            <CommentPanel candidateId={candidate.id} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
