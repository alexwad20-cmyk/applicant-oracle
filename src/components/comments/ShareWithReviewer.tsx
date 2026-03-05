import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UserPlus } from "lucide-react";

interface Props {
  candidateId: string;
}

export const ShareWithReviewer = ({ candidateId }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reviewers, setReviewers] = useState<{ user_id: string; email: string }[]>([]);
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Fetch users with reviewer role
    const fetchReviewers = async () => {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "reviewer");
      if (!roleData?.length) return;

      const userIds = roleData.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email")
        .in("user_id", userIds);
      if (profiles) setReviewers(profiles as any);
    };
    fetchReviewers();
  }, [open]);

  const handleShare = async () => {
    if (!selectedReviewer) return;
    setSubmitting(true);
    const { error } = await supabase.from("candidate_reviewer_access").insert({
      candidate_id: candidateId,
      reviewer_user_id: selectedReviewer,
      granted_by: user?.id,
    } as any);
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already shared", description: "This reviewer already has access." });
      } else {
        toast({ title: "Failed to share", variant: "destructive" });
      }
    } else {
      toast({ title: "Shared", description: "Reviewer can now view and comment." });
      setOpen(false);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Share with Reviewer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share with Reviewer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Select value={selectedReviewer} onValueChange={setSelectedReviewer}>
            <SelectTrigger>
              <SelectValue placeholder="Select a reviewer" />
            </SelectTrigger>
            <SelectContent>
              {reviewers.map((r) => (
                <SelectItem key={r.user_id} value={r.user_id}>
                  {r.email}
                </SelectItem>
              ))}
              {reviewers.length === 0 && (
                <SelectItem value="none" disabled>No reviewers found</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button className="w-full" onClick={handleShare} disabled={!selectedReviewer || submitting}>
            {submitting ? "Sharing..." : "Grant Access"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
