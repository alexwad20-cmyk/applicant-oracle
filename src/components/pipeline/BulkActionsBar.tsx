import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useJobs } from "@/contexts/JobsContext";
import { useToast } from "@/hooks/use-toast";
import { DbCandidate } from "@/types/database";
import { Send, Bell, X } from "lucide-react";

interface Props {
  selected: DbCandidate[];
  onClear: () => void;
}

export const BulkActionsBar = ({ selected, onClear }: Props) => {
  const { updateCandidateStage } = useJobs();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const newApplicants = selected.filter(c => c.stage === "new_applicant");
  const hmReviewCandidates = selected.filter(c => c.stage === "hm_review");

  const handleBulkSendToReview = async () => {
    if (newApplicants.length === 0) return;
    setProcessing(true);
    setProgress(0);
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < newApplicants.length; i++) {
      try {
        await updateCandidateStage(
          newApplicants[i].id,
          "hm_review",
          "Bulk sent to HM review"
        );
        succeeded++;
      } catch {
        failed++;
      }
      setProgress(((i + 1) / newApplicants.length) * 100);
    }

    toast({
      title: "Bulk action complete",
      description: `${succeeded} sent to HM Review${failed > 0 ? `, ${failed} failed` : ""}`,
    });
    setProcessing(false);
    onClear();
  };

  const handleBulkNudge = () => {
    toast({
      title: "Nudge sent",
      description: `Reminder nudge triggered for ${hmReviewCandidates.length} candidate(s)`,
    });
    onClear();
  };

  if (selected.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-lg rounded-lg px-6 py-3 flex items-center gap-4">
      <span className="text-sm font-medium">
        {selected.length} selected
      </span>

      {processing && (
        <Progress value={progress} className="w-32 h-2" />
      )}

      {!processing && newApplicants.length > 0 && (
        <Button size="sm" onClick={handleBulkSendToReview}>
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Send to HM Review ({newApplicants.length})
        </Button>
      )}

      {!processing && hmReviewCandidates.length > 0 && (
        <Button size="sm" variant="outline" onClick={handleBulkNudge}>
          <Bell className="h-3.5 w-3.5 mr-1.5" />
          Nudge HM ({hmReviewCandidates.length})
        </Button>
      )}

      <Button size="sm" variant="ghost" onClick={onClear} disabled={processing}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
