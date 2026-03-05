import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send } from "lucide-react";

interface Comment {
  id: string;
  candidate_id: string;
  author_user_id: string | null;
  author_email: string | null;
  body: string;
  visibility: string;
  source: string;
  created_at: string;
}

interface Props {
  candidateId: string;
}

export const CommentPanel = ({ candidateId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from("candidate_comments")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: true });
    if (data) setComments(data as any);
  }, [candidateId]);

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-${candidateId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "candidate_comments", filter: `candidate_id=eq.${candidateId}` },
        () => fetchComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [candidateId, fetchComments]);

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("candidate_comments").insert({
      candidate_id: candidateId,
      author_user_id: user?.id,
      author_email: user?.email,
      body: body.trim(),
    } as any);
    if (error) {
      toast({ title: "Failed to add comment", variant: "destructive" });
    } else {
      setBody("");
      await fetchComments();
    }
    setSubmitting(false);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {comments.map((c) => (
              <div key={c.id} className="border-l-2 border-muted pl-3 text-sm">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-xs">
                    {c.author_email || "System"}
                    {c.source !== "app" && (
                      <span className="ml-1 text-muted-foreground">(via {c.source})</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{c.body}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="flex-1"
          />
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !body.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
