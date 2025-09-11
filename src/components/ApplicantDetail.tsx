import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Building, FileText, Edit } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { CandidateStage, CANDIDATE_STAGE_LABELS } from "@/types/applicant";
import { useJobs } from "@/hooks/useJobs";
import { useToast } from "@/hooks/use-toast";

export const ApplicantDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getCandidate, updateCandidate, getJob } = useJobs();
  const { toast } = useToast();
  
  const candidate = id ? getCandidate(id) : null;
  const job = candidate ? getJob(candidate.jobId) : null;

  if (!candidate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <h1 className="text-2xl font-bold text-foreground mb-4">Applicant Not Found</h1>
          <Button onClick={() => navigate("/applicants")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Applicants
          </Button>
        </div>
      </div>
    );
  }

  const handleStageUpdate = (newStage: CandidateStage) => {
    updateCandidate(candidate.id, { stage: newStage });
    toast({
      title: "Status Updated", 
      description: `${candidate.name} has been moved to ${CANDIDATE_STAGE_LABELS[newStage]}`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/applicants")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Applicants
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{applicant.name}</h1>
              <p className="text-muted-foreground mt-2">Applied for {applicant.roleAppliedFor}</p>
            </div>
            <StatusBadge stage={applicant.interviewStage} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Information */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Edit className="h-5 w-5 mr-2" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{applicant.email}</span>
              </div>
              {applicant.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{applicant.phone}</span>
                </div>
              )}
              {applicant.address && (
                <div className="flex items-start space-x-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <span>{applicant.address}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Application Details */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Application Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Applied on {new Date(applicant.dateOfApplication).toLocaleDateString()}</span>
              </div>
              
              <div className="flex items-center space-x-3">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span>{applicant.roleAppliedFor}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {applicant.needsVisa && (
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                    Visa Required
                  </Badge>
                )}
                {applicant.fromAgency && (
                  <Badge variant="outline" className="bg-info/10 text-info border-info/20">
                    From Agency: {applicant.agencyName || 'N/A'}
                  </Badge>
                )}
                {applicant.jobAccepted === true && (
                  <Badge className="bg-success text-success-foreground">Job Accepted</Badge>
                )}
                {applicant.jobAccepted === false && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    Job Declined
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status Management */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle>Interview Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Stage</label>
                <Select
                  value={applicant.interviewStage}
                  onValueChange={(value) => handleStageUpdate(value as InterviewStage)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERVIEW_STAGE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {applicant.interviewStage === InterviewStage.OFFER_MADE && applicant.jobAccepted === null && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job Response</label>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handleJobAcceptance(true)}
                      className="bg-success hover:bg-success/90 text-success-foreground"
                    >
                      Accepted
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleJobAcceptance(false)}
                      className="border-destructive text-destructive hover:bg-destructive/10"
                    >
                      Declined
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {applicant.notes && (
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {applicant.notes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* CV Information */}
          {applicant.cvFile && (
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  CV File
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm">{applicant.cvFile.name}</span>
                  <Button variant="outline" size="sm">
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};