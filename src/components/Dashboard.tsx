import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Clock, CheckCircle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Applicant, InterviewStage } from "@/types/applicant";
import { useApplicants } from "@/hooks/useApplicants";

export const Dashboard = () => {
  const { applicants } = useApplicants();

  const stats = useMemo(() => {
    const total = applicants.length;
    const inProgress = applicants.filter(a => 
      [InterviewStage.SCREENING, InterviewStage.FIRST_INTERVIEW, 
       InterviewStage.SECOND_INTERVIEW, InterviewStage.FINAL_INTERVIEW].includes(a.interviewStage)
    ).length;
    const offered = applicants.filter(a => a.interviewStage === InterviewStage.OFFER_MADE).length;
    const rejected = applicants.filter(a => a.interviewStage === InterviewStage.REJECTED).length;

    return { total, inProgress, offered, rejected };
  }, [applicants]);

  const recentApplicants = useMemo(() => 
    applicants
      .sort((a, b) => new Date(b.dateOfApplication).getTime() - new Date(a.dateOfApplication).getTime())
      .slice(0, 5)
  , [applicants]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Applicant Tracker</h1>
            <p className="text-muted-foreground mt-2">Manage and track job applications</p>
          </div>
          <Link to="/add-applicant">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Add Applicant
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Applicants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.inProgress}</div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Offers Made</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.offered}</div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Applicants */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent Applications
                <Link to="/applicants">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentApplicants.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No applicants yet</p>
              ) : (
                recentApplicants.map((applicant) => (
                  <div key={applicant.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{applicant.name}</p>
                      <p className="text-sm text-muted-foreground">{applicant.roleAppliedFor}</p>
                    </div>
                    <Badge variant="secondary" className="bg-info text-info-foreground">
                      {new Date(applicant.dateOfApplication).toLocaleDateString()}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link to="/add-applicant">
                <Button className="w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Applicant
                </Button>
              </Link>
              <Link to="/applicants">
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  View All Applicants
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};