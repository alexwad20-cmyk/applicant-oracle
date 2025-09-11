import { Badge } from "@/components/ui/badge";
import { InterviewStage, INTERVIEW_STAGE_LABELS } from "@/types/applicant";

interface StatusBadgeProps {
  stage: InterviewStage;
}

export const StatusBadge = ({ stage }: StatusBadgeProps) => {
  const getVariant = (stage: InterviewStage) => {
    switch (stage) {
      case InterviewStage.APPLIED:
        return "secondary";
      case InterviewStage.SCREENING:
        return "default";
      case InterviewStage.FIRST_INTERVIEW:
      case InterviewStage.SECOND_INTERVIEW:
      case InterviewStage.FINAL_INTERVIEW:
        return "default";
      case InterviewStage.OFFER_MADE:
        return "default";
      case InterviewStage.REJECTED:
        return "destructive";
      case InterviewStage.WITHDRAWN:
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getClassName = (stage: InterviewStage) => {
    switch (stage) {
      case InterviewStage.APPLIED:
        return "bg-info text-info-foreground";
      case InterviewStage.SCREENING:
        return "bg-warning text-warning-foreground";
      case InterviewStage.FIRST_INTERVIEW:
      case InterviewStage.SECOND_INTERVIEW:
      case InterviewStage.FINAL_INTERVIEW:
        return "bg-primary text-primary-foreground";
      case InterviewStage.OFFER_MADE:
        return "bg-success text-success-foreground";
      case InterviewStage.REJECTED:
        return "bg-destructive text-destructive-foreground";
      case InterviewStage.WITHDRAWN:
        return "bg-muted text-muted-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <Badge variant={getVariant(stage)} className={getClassName(stage)}>
      {INTERVIEW_STAGE_LABELS[stage]}
    </Badge>
  );
};