import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, X, Download, Mail } from "lucide-react";
import { Candidate, Job } from "@/types/applicant";
import { useJobs } from "@/hooks/useJobs";
import { useToast } from "@/hooks/use-toast";

interface EmailPreviewProps {
  candidate: Candidate;
  job: Job;
}

export const EmailPreview = ({ candidate, job }: EmailPreviewProps) => {
  const { updateCandidate } = useJobs();
  const { toast } = useToast();

  const handleProgress = () => {
    updateCandidate(candidate.id, {
      stage: 'progressed' as any
    });
    toast({
      title: "Candidate Progressed",
      description: `${candidate.name} has been moved to the next stage`,
    });
  };

  const handleReject = () => {
    updateCandidate(candidate.id, {
      stage: 'rejected' as any
    });
    toast({
      title: "Candidate Rejected",
      description: `${candidate.name} has been rejected`,
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6">
      {/* Email Header */}
      <Card className="bg-muted/20 border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Email Sent to Hiring Manager</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <strong>To:</strong> {job.hiringManager} ({job.hiringManagerEmail})
          </div>
          <div className="text-sm">
            <strong>Subject:</strong> New Candidate for Review - {job.title}
          </div>
          <div className="text-sm">
            <strong>Sent:</strong> {candidate.emailSentAt ? new Date(candidate.emailSentAt).toLocaleString() : 'Just now'}
          </div>
        </CardContent>
      </Card>

      {/* Email Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-background p-4 rounded border-l-4 border-l-primary">
            <div className="space-y-4">
              <p>Hi {job.hiringManager},</p>
              
              <p>
                We have a new candidate for the <strong>{job.title}</strong> position that requires your review.
              </p>
              
              <div className="bg-muted/50 p-4 rounded">
                <h4 className="font-medium mb-2">Candidate Information:</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Name:</strong> {candidate.name}</div>
                  <div><strong>Email:</strong> {candidate.email}</div>
                  <div><strong>Phone:</strong> {candidate.phone}</div>
                  <div><strong>Applied:</strong> {new Date(candidate.dateOfApplication).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2 mt-3">
                  {candidate.needsVisa && (
                    <Badge variant="outline" className="bg-warning/10 text-warning">
                      Visa Required
                    </Badge>
                  )}
                  {candidate.fromAgency && (
                    <Badge variant="outline" className="bg-info/10 text-info">
                      From Agency: {candidate.agencyName}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <Download className="h-4 w-4" />
                <span className="text-sm">CV__{candidate.name.replace(' ', '_')}.pdf (attached)</span>
              </div>

              <p>Please review the candidate and let us know your decision:</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons - This is what the hiring manager sees */}
      <Card className="border-2 border-dashed border-primary/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            Hiring Manager Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            These buttons would appear in the actual email sent to the hiring manager:
          </p>
          <div className="flex gap-3">
            <Button 
              onClick={handleProgress}
              className="bg-success hover:bg-success/90 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              Progress Candidate
            </Button>
            <Button 
              onClick={handleReject}
              variant="destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Reject Candidate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Clicking these buttons updates the candidate status automatically
          </p>
        </CardContent>
      </Card>
    </div>
  );
};