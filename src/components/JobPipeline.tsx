import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Users, Mail, Check, X, Eye, ExternalLink } from "lucide-react";
import { useJobs } from "@/hooks/useJobs";
import { Job, Candidate, CandidateStage, CANDIDATE_STAGE_LABELS } from "@/types/applicant";
import { StatusBadge } from "./StatusBadge";
import { EmailPreview } from "./EmailPreview";
import { useToast } from "@/hooks/use-toast";

export const JobPipeline = () => {
  const navigate = useNavigate();
  const { jobs, candidates, updateCandidate, getCandidatesForJob } = useJobs();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const handleSendForReview = (candidate: Candidate) => {
    const job = jobs.find(j => j.id === candidate.jobId);
    if (!job) return;

    // Simulate sending email to hiring manager
    updateCandidate(candidate.id, {
      stage: CandidateStage.SENT_FOR_REVIEW,
      emailSentAt: new Date().toISOString()
    });

    toast({
      title: "Email Sent",
      description: `CV sent to ${job.hiringManager} for review`,
    });
  };

  const renderCandidateCard = (candidate: Candidate, job: Job) => (
    <div key={candidate.id} className="p-4 border rounded-lg bg-card">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium">{candidate.name}</h4>
          <p className="text-sm text-muted-foreground">{candidate.email}</p>
        </div>
        <StatusBadge stage={candidate.stage as any} />
      </div>
      
      <div className="flex gap-2 mb-3">
        {candidate.needsVisa && (
          <Badge variant="outline" className="text-xs">Visa Required</Badge>
        )}
        {candidate.fromAgency && (
          <Badge variant="outline" className="text-xs">Agency</Badge>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/candidates/${candidate.id}`)}
        >
          <Eye className="h-3 w-3" />
        </Button>
        
        {candidate.stage === CandidateStage.NEW_APPLICANT && (
          <Button
            variant="default"
            size="sm"
            onClick={() => handleSendForReview(candidate)}
            className="text-xs"
          >
            <Mail className="h-3 w-3 mr-1" />
            Send for Review
          </Button>
        )}
        
        {candidate.stage === CandidateStage.SENT_FOR_REVIEW && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                <ExternalLink className="h-3 w-3 mr-1" />
                View Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Email Sent to Hiring Manager</DialogTitle>
              </DialogHeader>
              <EmailPreview candidate={candidate} job={job} />
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Job Pipeline</h1>
          <p className="text-muted-foreground mt-2">Manage candidates by job position</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {jobs.filter(job => job.status === 'open').map(job => {
            const jobCandidates = getCandidatesForJob(job.id);
            const newApplicants = jobCandidates.filter(c => c.stage === CandidateStage.NEW_APPLICANT);
            const sentForReview = jobCandidates.filter(c => c.stage === CandidateStage.SENT_FOR_REVIEW);
            const progressed = jobCandidates.filter(c => c.stage === CandidateStage.PROGRESSED);
            const rejected = jobCandidates.filter(c => c.stage === CandidateStage.REJECTED);

            return (
              <Card key={job.id} className="shadow-soft border-0">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{job.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{job.department}</p>
                      <p className="text-xs text-muted-foreground">HM: {job.hiringManager}</p>
                    </div>
                    <Badge variant="outline" className="bg-success/10 text-success">
                      {jobCandidates.length} candidates
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* New Applicants */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-info"></div>
                      <h4 className="font-medium text-sm">New Applicants ({newApplicants.length})</h4>
                    </div>
                    <div className="space-y-2 pl-5">
                      {newApplicants.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No new applicants</p>
                      ) : (
                        newApplicants.map(candidate => renderCandidateCard(candidate, job))
                      )}
                    </div>
                  </div>

                  {/* Sent for Review */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-warning"></div>
                      <h4 className="font-medium text-sm">Sent for Review ({sentForReview.length})</h4>
                    </div>
                    <div className="space-y-2 pl-5">
                      {sentForReview.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None pending review</p>
                      ) : (
                        sentForReview.map(candidate => renderCandidateCard(candidate, job))
                      )}
                    </div>
                  </div>

                  {/* Progressed */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-success"></div>
                      <h4 className="font-medium text-sm">Progressed ({progressed.length})</h4>
                    </div>
                    <div className="space-y-2 pl-5">
                      {progressed.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None progressed yet</p>
                      ) : (
                        progressed.map(candidate => renderCandidateCard(candidate, job))
                      )}
                    </div>
                  </div>

                  {/* Rejected */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-destructive"></div>
                      <h4 className="font-medium text-sm">Rejected ({rejected.length})</h4>
                    </div>
                    <div className="space-y-2 pl-5">
                      {rejected.length === 0 ? (
                        <p className="text-xs text-muted-foreground">None rejected</p>
                      ) : (
                        rejected.slice(0, 2).map(candidate => renderCandidateCard(candidate, job))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};