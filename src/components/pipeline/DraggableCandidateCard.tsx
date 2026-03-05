import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { DbCandidate } from "@/types/database";

interface Props {
  candidate: DbCandidate;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const DraggableCandidateCard = ({ candidate, selected, onToggleSelect }: Props) => {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
    data: { candidate },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const isOverdue =
    candidate.stage === "hm_review" &&
    candidate.hm_review_due_at &&
    new Date(candidate.hm_review_due_at) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 border rounded-lg bg-card cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? "shadow-lg ring-2 ring-primary/40" : ""
      } ${isOverdue ? "border-destructive/50" : ""} ${selected ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-start gap-2 min-w-0">
          {onToggleSelect && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(candidate.id)}
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-0.5"
            />
          )}
          <div className="min-w-0">
            <h4 className="font-medium text-sm truncate">{candidate.full_name}</h4>
            <p className="text-xs text-muted-foreground truncate">{candidate.email}</p>
          </div>
        </div>
        <StatusBadge stage={candidate.stage} />
      </div>

      <div className="flex gap-1 mb-2 flex-wrap">
        {candidate.visa_required && (
          <Badge variant="outline" className="text-xs">Visa</Badge>
        )}
        {candidate.source === "agency" && (
          <Badge variant="outline" className="text-xs">Agency</Badge>
        )}
        {isOverdue && (
          <Badge variant="destructive" className="text-xs">Overdue</Badge>
        )}
        {candidate.reminder_count > 0 && (
          <Badge variant="secondary" className="text-xs">
            {candidate.reminder_count} reminder{candidate.reminder_count > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => navigate(`/candidates/${candidate.id}`)}
        >
          <Eye className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
