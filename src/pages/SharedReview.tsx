import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, CheckCircle, FileText, User, Briefcase, MapPin } from "lucide-react";

interface CandidateInfo {
  full_name: string;
  job_title: string;
  department: string;
  source: string;
  visa_required: boolean;
  cv_url: string | null;
  comments: Array<{
    body: string;
    author_email: string | null;
    created_at: string;
    source: string;
  }>;
}

const SharedReview = () => {
  const { token } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [comment, setComment] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setError("Invalid review link");
        setLoading(false);
        return;
      }
      try {
        const { data, error: fnError } = await supabase.functions.invoke("validate-share-token", {
          body: { token },
        });
        if (fnError || data?.error) {
          setError(data?.error || "Invalid or expired review link");
        } else {
          setCandidate(data);
        }
      } catch {
        setError("Failed to validate review link");
      }
      setLoading(false);
    };
    validate();
  }, [token]);

  const handleSubmit = async () => {
    if (!comment.trim() || !token) return;
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("add-comment-via-share-token", {
        body: {
          token,
          comment: comment.trim(),
          author_email: authorEmail.trim() || null,
          author_name: authorName.trim() || null,
        },
      });
      if (fnError || data?.error) throw new Error(data?.error || "Failed");
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Failed to submit comment", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <p className="text-muted-foreground">Validating review link...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md border-0 shadow-sm">
          <CardContent className="text-center py-12">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-muted-foreground text-sm mt-2">
              This link may have expired or been revoked.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md border-0 shadow-sm">
          <CardContent className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold">Thank you!</h2>
            <p className="text-muted-foreground mt-2">Your comment has been submitted and the team has been notified.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6 py-8">
        {/* Candidate Summary */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="text-center pb-2">
            <MessageSquare className="h-8 w-8 mx-auto text-primary mb-2" />
            <CardTitle>Candidate Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-lg">{candidate?.full_name}</span>
              </div>
              <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" />
                {candidate?.job_title} • {candidate?.department}
              </div>
              <div className="flex gap-2 justify-center flex-wrap">
                <Badge variant="outline" className="capitalize text-xs">{candidate?.source}</Badge>
                {candidate?.visa_required && <Badge variant="outline" className="text-xs">Visa Required</Badge>}
              </div>
            </div>

            {candidate?.cv_url && (
              <Button variant="outline" className="w-full" asChild>
                <a href={candidate.cv_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 mr-2" />
                  View CV
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Existing Comments */}
        {candidate?.comments && candidate.comments.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Previous Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {candidate.comments.map((c, i) => (
                  <div key={i} className="border-l-2 border-muted pl-3 text-sm">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{c.author_email || "Anonymous"}</span>
                      <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-muted-foreground mt-0.5">{c.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comment Form */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Add Your Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Your name (optional)</Label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Your email (optional)</Label>
                <Input
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Your comment *</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your feedback about this candidate..."
                rows={4}
              />
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={submitting || !comment.trim()}>
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Submitting..." : "Submit Comment"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SharedReview;
