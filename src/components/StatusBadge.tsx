import { Badge } from "@/components/ui/badge";
import { CandidateStage, CANDIDATE_STAGE_LABELS } from "@/types/applicant";

interface StatusBadgeProps {
  stage: CandidateStage;
}

export const StatusBadge = ({ stage }: StatusBadgeProps) => {
  const getVariant = (stage: CandidateStage) => {
    switch (stage) {
      case CandidateStage.NEW_APPLICANT:
        return "secondary";
      case CandidateStage.SENT_FOR_REVIEW:
        return "default";
      case CandidateStage.PROGRESSED:
        return "default";
      case CandidateStage.REJECTED:
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getClassName = (stage: CandidateStage) => {
    switch (stage) {
      case CandidateStage.NEW_APPLICANT:
        return "bg-info text-info-foreground";
      case CandidateStage.SENT_FOR_REVIEW:
        return "bg-warning text-warning-foreground";
      case CandidateStage.PROGRESSED:
        return "bg-success text-success-foreground";
      case CandidateStage.REJECTED:
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <Badge variant={getVariant(stage)} className={getClassName(stage)}>
      {CANDIDATE_STAGE_LABELS[stage]}
    </Badge>
  );
};