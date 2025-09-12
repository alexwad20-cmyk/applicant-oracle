import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Clock, CheckCircle, XCircle, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { CandidateStage } from "@/types/applicant";
import { useJobs } from "@/hooks/useJobs";
export const Dashboard = () => {
  const {
    jobs,
    candidates
  } = useJobs();
  const stats = useMemo(() => {
    const total = candidates.length;
    const newApplicants = candidates.filter(c => c.stage === CandidateStage.NEW_APPLICANT).length;
    const sentForReview = candidates.filter(c => c.stage === CandidateStage.SENT_FOR_REVIEW).length;
    const progressed = candidates.filter(c => c.stage === CandidateStage.PROGRESSED).length;
    const rejected = candidates.filter(c => c.stage === CandidateStage.REJECTED).length;
    return {
      total,
      newApplicants,
      sentForReview,
      progressed,
      rejected
    };
  }, [candidates]);
  const recentCandidates = useMemo(() => candidates.sort((a, b) => new Date(b.dateOfApplication).getTime() - new Date(a.dateOfApplication).getTime()).slice(0, 5), [candidates]);
  return <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Agency Candidate Pipeline</h1>
          <p className="text-muted-foreground mt-2">Track candidates through the hiring process</p>
        </div>
        <div className="flex gap-2">
          <Link to="/pipeline">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Briefcase className="h-4 w-4 mr-2" />
              View Pipeline
            </Button>
          </Link>
          <Link to="/add-candidate">
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Candidate
            </Button>
          </Link>
        </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Applicants</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{stats.newApplicants}</div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sent for Review</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.sentForReview}</div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progressed</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.progressed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Candidates & Jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Candidates
                <Link to="/pipeline">
                  <Button variant="ghost" size="sm">View Pipeline</Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentCandidates.length === 0 ? <p className="text-muted-foreground text-center py-8">No candidates yet</p> : recentCandidates.map(candidate => {
              const job = jobs.find(j => j.id === candidate.jobId);
              return <div key={candidate.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{candidate.name}</p>
                        <p className="text-sm text-muted-foreground">{job?.title || 'Unknown Position'}</p>
                      </div>
                      <Badge variant="secondary" className="bg-info text-info-foreground">
                        {new Date(candidate.dateOfApplication).toLocaleDateString()}
                      </Badge>
                    </div>;
            })}
            </CardContent>
          </Card>

          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle>Open Positions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {jobs.filter(job => job.status === 'open').map(job => {
              const jobCandidates = candidates.filter(c => c.jobId === job.id);
              return <div key={job.id} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{job.title}</p>
                        <p className="text-sm text-muted-foreground">{job.department}</p>
                        <p className="text-xs text-muted-foreground">HM: {job.hiringManager}</p>
                      </div>
                      <Badge variant="outline" className="bg-success/10 text-success">
                        {jobCandidates.length} candidates
                      </Badge>
                    </div>
                  </div>;
            })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
};