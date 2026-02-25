import { Badge } from "@/components/ui/badge";
import { CandidateStage, STAGE_LABELS } from "@/types/database";

interface StatusBadgeProps {
  stage: CandidateStage;
}

export const StatusBadge = ({ stage }: StatusBadgeProps) => {
  const getClassName = (stage: CandidateStage) => {
    switch (stage) {
      case 'new_applicant':
        return "bg-info text-info-foreground";
      case 'hm_review':
        return "bg-warning text-warning-foreground";
      case 'hm_approved':
        return "bg-success text-success-foreground";
      case 'hm_rejected':
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <Badge className={getClassName(stage)}>
      {STAGE_LABELS[stage] || stage}
    </Badge>
  );
};
