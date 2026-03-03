import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useJobs } from "@/contexts/JobsContext";
import { useDepartmentFilter } from "@/contexts/DepartmentFilterContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "./AppLayout";
import { CreateJobDialog } from "./CreateJobDialog";
import { DroppableStageColumn } from "./pipeline/DroppableStageColumn";
import { RejectionReasonModal } from "./pipeline/RejectionReasonModal";
import { DbCandidate, CandidateStage, RejectionReason } from "@/types/database";

const stages: { key: CandidateStage; label: string; color: string }[] = [
  { key: "new_applicant", label: "New Applicants", color: "bg-info" },
  { key: "hm_review", label: "HM Review", color: "bg-warning" },
  { key: "hm_approved", label: "Approved", color: "bg-success" },
  { key: "hm_rejected", label: "Rejected", color: "bg-destructive" },
];

export const JobPipeline = () => {
  const { jobs, getCandidatesForJob, updateCandidateStage, candidates } = useJobs();
  const { department: deptFilter } = useDepartmentFilter();
  const { isHrOrAdmin, isHiringManager, canManageJobs, user } = useAuth();
  const { toast } = useToast();

  const [activeCandidate, setActiveCandidate] = useState<DbCandidate | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{
    candidate: DbCandidate;
    toStage: CandidateStage;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const filteredJobs = jobs.filter(
    (j) => j.status === "open" && (deptFilter === "all" || j.department === deptFilter)
  );

  const canMoveCandidate = useCallback(
    (candidate: DbCandidate, toStage: CandidateStage): boolean => {
      if (candidate.stage === toStage) return false;
      if (isHrOrAdmin) return true;
      if (isHiringManager) {
        // HM can only move from hm_review to approved/rejected on their own jobs
        const job = jobs.find((j) => j.id === candidate.job_id);
        if (!job || job.hiring_manager_user_id !== user?.id) return false;
        if (candidate.stage !== "hm_review") return false;
        return toStage === "hm_approved" || toStage === "hm_rejected";
      }
      return false;
    },
    [isHrOrAdmin, isHiringManager, jobs, user?.id]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const candidate = event.active.data.current?.candidate as DbCandidate | undefined;
    setActiveCandidate(candidate || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCandidate(null);
    const { active, over } = event;
    if (!over) return;

    const candidate = active.data.current?.candidate as DbCandidate;
    // Droppable IDs are formatted as "jobId::stage"
    const overId = String(over.id);
    const toStage = (overId.includes("::") ? overId.split("::")[1] : overId) as CandidateStage;

    if (!candidate || !toStage || candidate.stage === toStage) return;

    if (!canMoveCandidate(candidate, toStage)) {
      toast({ title: "Permission denied", description: "You cannot move this candidate to that stage.", variant: "destructive" });
      return;
    }

    // If rejecting, show modal for reason
    if (toStage === "hm_rejected") {
      setPendingDrop({ candidate, toStage });
      return;
    }

    // Otherwise execute immediately
    try {
      const notes = toStage === "hm_review" ? "Sent to hiring manager for review" : undefined;
      await updateCandidateStage(candidate.id, toStage, notes);
      toast({ title: "Stage updated", description: `${candidate.full_name} moved to ${stages.find((s) => s.key === toStage)?.label}` });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const handleRejectConfirm = async (reason: RejectionReason, notes: string) => {
    if (!pendingDrop) return;
    try {
      await updateCandidateStage(pendingDrop.candidate.id, "hm_rejected", notes, reason);
      toast({ title: "Candidate rejected", description: `${pendingDrop.candidate.full_name} rejected` });
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    }
    setPendingDrop(null);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Job Pipeline</h1>
          <p className="text-muted-foreground mt-1">Drag candidates between stages</p>
        </div>
        {canManageJobs && <CreateJobDialog />}

        {filteredJobs.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">
                No open positions{deptFilter !== "all" ? ` in ${deptFilter}` : ""}. Create a job first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="space-y-8">
              {filteredJobs.map((job) => {
                const jobCandidates = getCandidatesForJob(job.id);
                return (
                  <Card key={job.id} className="border-0 shadow-sm">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{job.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {job.department} • {job.location}
                          </p>
                        </div>
                        <Badge variant="outline">{jobCandidates.length} candidates</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {stages.map((stage) => {
                          const stageCandidates = jobCandidates.filter((c) => c.stage === stage.key);
                          return (
                            <DroppableStageColumn
                              key={`${job.id}-${stage.key}`}
                              stage={{ ...stage, key: `${job.id}::${stage.key}` as any }}
                              candidates={stageCandidates}
                            />
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </DndContext>
        )}

        <RejectionReasonModal
          open={!!pendingDrop}
          candidateName={pendingDrop?.candidate.full_name || ""}
          onConfirm={handleRejectConfirm}
          onCancel={() => setPendingDrop(null)}
        />
      </div>
    </AppLayout>
  );
};
