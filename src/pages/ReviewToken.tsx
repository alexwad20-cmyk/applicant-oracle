import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, CheckCircle } from "lucide-react";

const ReviewToken = () => {
  const { token } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<{ full_name: string; job_title: string } | null>(null);
  const [comment, setComment] = useState("");
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
        const { data, error: fnError } = await supabase.functions.invoke("validate-review-token", {
          body: { token },
        });

        if (fnError || !data?.valid) {
          setError(data?.error || "Invalid or expired review link");
        } else {
          setCandidate({
            full_name: data.candidate_name,
            job_title: data.job_title,
          });
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
      const { error: fnError } = await supabase.functions.invoke("add-comment-via-token", {
        body: { token, comment: comment.trim() },
      });
      if (fnError) throw fnError;
      setSubmitted(true);
    } catch {
      toast({ title: "Failed to submit comment", variant: "destructive" });
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
              This link may have expired or already been used.
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
            <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold">Thank you!</h2>
            <p className="text-muted-foreground mt-2">Your comment has been submitted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg border-0 shadow-sm">
        <CardHeader className="text-center">
          <MessageSquare className="h-8 w-8 mx-auto text-primary mb-2" />
          <CardTitle>Review Candidate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="font-medium">{candidate?.full_name}</p>
            <p className="text-sm text-muted-foreground">{candidate?.job_title}</p>
          </div>
          <div className="space-y-2">
            <Label>Your Comment</Label>
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
  );
};

export default ReviewToken;
