import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Clock, CheckCircle, XCircle, Briefcase, AlertTriangle, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useJobs } from "@/contexts/JobsContext";
import { useDepartmentFilter } from "@/contexts/DepartmentFilterContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { StatusBadge } from "./StatusBadge";
import { AppLayout } from "./AppLayout";
import { CreateJobDialog } from "./CreateJobDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const Dashboard = () => {
  const { jobs, candidates, loading, refreshCandidates } = useJobs();
  const { department: deptFilter } = useDepartmentFilter();
  const { rolesLoading, rolesError, refreshRoles } = useAuth();
  const { effectiveCanManageJobs, effectiveIsHrOrAdmin, realIsHrOrAdmin, isImpersonating } = useEffectivePermissions();
  const { toast } = useToast();
  const [sendingReminders, setSendingReminders] = useState(false);

  const filteredJobs = useMemo(() => jobs.filter(j => deptFilter === 'all' || j.department === deptFilter), [jobs, deptFilter]);
  const filteredCandidates = useMemo(() => {
    const jobIds = new Set(filteredJobs.map(j => j.id));
    return candidates.filter(c => jobIds.has(c.job_id));
  }, [candidates, filteredJobs]);

  const stats = useMemo(() => {
    const total = filteredCandidates.length;
    const newApplicants = filteredCandidates.filter(c => c.stage === 'new_applicant').length;
    const hmReview = filteredCandidates.filter(c => c.stage === 'hm_review').length;
    const approved = filteredCandidates.filter(c => c.stage === 'hm_approved').length;
    const rejected = filteredCandidates.filter(c => c.stage === 'hm_rejected').length;
    const overdue = filteredCandidates.filter(c =>
      c.stage === 'hm_review' && c.hm_review_due_at && new Date(c.hm_review_due_at) < new Date()
    ).length;
    return { total, newApplicants, hmReview, approved, rejected, overdue };
  }, [filteredCandidates]);

  const recentCandidates = useMemo(() =>
    [...filteredCandidates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [filteredCandidates]
  );

  const handleRunReminders = async () => {
    setSendingReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-review-reminders');
      if (error) throw error;
      toast({ title: "Reminders sent", description: `${data?.reminders_sent || 0} reminder(s) sent.` });
      await refreshCandidates();
    } catch {
      toast({ title: "Failed to send reminders", variant: "destructive" });
    }
    setSendingReminders(false);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {effectiveCanManageJobs ? 'HR Dashboard' : 'My Reviews'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {effectiveCanManageJobs ? 'Track candidates through the hiring process' : 'Candidates pending your review'}
            </p>
          </div>
          {effectiveCanManageJobs && (
            <div className="flex gap-2">
              <Link to="/pipeline">
                <Button>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Pipeline
                </Button>
              </Link>
              <Link to="/add-candidate">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Candidate
                </Button>
              </Link>
              <CreateJobDialog />
            </div>
          )}
          {rolesLoading && !effectiveCanManageJobs && (
            <Button disabled variant="outline">
              <span className="animate-spin mr-2">⏳</span> Loading permissions...
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-info">{stats.newApplicants}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">HM Review</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.hmReview}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Overdue warning */}
        {stats.overdue > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                {stats.overdue} candidate{stats.overdue > 1 ? 's' : ''} overdue for HM review
              </p>
              {isHrOrAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRunReminders}
                  disabled={sendingReminders}
                  className="ml-auto"
                >
                  <Bell className="h-3.5 w-3.5 mr-1.5" />
                  {sendingReminders ? "Sending..." : "Run Reminders Now"}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent + Jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                Recent Candidates
                <Link to="/pipeline">
                  <Button variant="ghost" size="sm">View Pipeline</Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentCandidates.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No candidates yet</p>
              ) : (
                recentCandidates.map(candidate => {
                  const job = jobs.find(j => j.id === candidate.job_id);
                  return (
                    <Link key={candidate.id} to={`/candidates/${candidate.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div>
                          <p className="font-medium text-sm">{candidate.full_name}</p>
                          <p className="text-xs text-muted-foreground">{job?.title || 'Unknown'}</p>
                        </div>
                        <StatusBadge stage={candidate.stage} />
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Open Positions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredJobs.filter(j => j.status === 'open').length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No open positions</p>
              ) : (
                filteredJobs.filter(j => j.status === 'open').map(job => {
                  const count = filteredCandidates.filter(c => c.job_id === job.id).length;
                  return (
                    <div key={job.id} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{job.title}</p>
                          <p className="text-xs text-muted-foreground">{job.department} • {job.location}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {count} candidates
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};
