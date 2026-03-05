import { useDroppable } from "@dnd-kit/core";
import { CandidateStage, DbCandidate } from "@/types/database";
import { DraggableCandidateCard } from "./DraggableCandidateCard";

interface StageConfig {
  key: CandidateStage;
  label: string;
  color: string;
}

interface Props {
  stage: StageConfig;
  candidates: DbCandidate[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export const DroppableStageColumn = ({ stage, candidates, selectedIds, onToggleSelect }: Props) => {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.key,
    data: { stage: stage.key },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] rounded-lg p-2 transition-colors ${
        isOver ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
        <h4 className="font-medium text-sm">
          {stage.label} ({candidates.length})
        </h4>
      </div>
      <div className="space-y-2">
        {candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground pl-4 py-4">
            {isOver ? "Drop here" : "None"}
          </p>
        ) : (
          candidates.map((c) => (
            <DraggableCandidateCard
              key={c.id}
              candidate={c}
              selected={selectedIds?.has(c.id) ?? false}
              onToggleSelect={onToggleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
};
