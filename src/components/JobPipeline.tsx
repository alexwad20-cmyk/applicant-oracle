import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Eye } from "lucide-react";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { StatusBadge } from "./StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "./AppLayout";
import { CreateJobDialog } from "./CreateJobDialog";
import { DbCandidate, DbJob, CandidateStage } from "@/types/database";

export const JobPipeline = () => {
  const navigate = useNavigate();
  const { jobs, candidates, getCandidatesForJob, updateCandidateStage } = useJobs();
  const { isHrOrAdmin, canManageJobs } = useAuth();
  const { toast } = useToast();

  const handleSendForReview = async (candidate: DbCandidate) => {
    await updateCandidateStage(candidate.id, 'hm_review', 'Sent to hiring manager for review');
    toast({ title: "Sent for HM Review", description: `${candidate.full_name} sent for review` });
  };

  const stages: { key: CandidateStage; label: string; color: string }[] = [
    { key: 'new_applicant', label: 'New Applicants', color: 'bg-info' },
    { key: 'hm_review', label: 'HM Review', color: 'bg-warning' },
    { key: 'hm_approved', label: 'Approved', color: 'bg-success' },
    { key: 'hm_rejected', label: 'Rejected', color: 'bg-destructive' },
  ];

  const renderCandidateCard = (candidate: DbCandidate) => {
    const isOverdue = candidate.stage === 'hm_review' && candidate.hm_review_due_at && new Date(candidate.hm_review_due_at) < new Date();

    return (
      <div key={candidate.id} className={`p-3 border rounded-lg bg-card ${isOverdue ? 'border-destructive/50' : ''}`}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="font-medium text-sm">{candidate.full_name}</h4>
            <p className="text-xs text-muted-foreground">{candidate.email}</p>
          </div>
          <StatusBadge stage={candidate.stage} />
        </div>

        <div className="flex gap-1 mb-2 flex-wrap">
          {candidate.visa_required && <Badge variant="outline" className="text-xs">Visa</Badge>}
          {candidate.source === 'agency' && <Badge variant="outline" className="text-xs">Agency</Badge>}
          {isOverdue && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
        </div>

        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/candidates/${candidate.id}`)}>
            <Eye className="h-3 w-3" />
          </Button>
          {isHrOrAdmin && candidate.stage === 'new_applicant' && (
            <Button size="sm" onClick={() => handleSendForReview(candidate)} className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              Send for Review
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Job Pipeline</h1>
          <p className="text-muted-foreground mt-1">Manage candidates by job and stage</p>
        </div>
        {canManageJobs && <CreateJobDialog />}

        {jobs.filter(j => j.status === 'open').length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No open positions. Create a job first.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {jobs.filter(j => j.status === 'open').map(job => {
              const jobCandidates = getCandidatesForJob(job.id);
              return (
                <Card key={job.id} className="border-0 shadow-sm">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{job.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{job.department} • {job.location}</p>
                      </div>
                      <Badge variant="outline">{jobCandidates.length} candidates</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {stages.map(stage => {
                        const stageCandidates = jobCandidates.filter(c => c.stage === stage.key);
                        return (
                          <div key={stage.key}>
                            <div className="flex items-center gap-2 mb-3">
                              <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                              <h4 className="font-medium text-sm">{stage.label} ({stageCandidates.length})</h4>
                            </div>
                            <div className="space-y-2">
                              {stageCandidates.length === 0 ? (
                                <p className="text-xs text-muted-foreground pl-4">None</p>
                              ) : (
                                stageCandidates.map(c => renderCandidateCard(c))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};
