import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useJobs } from "@/contexts/JobsContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Trash2, EyeOff, AlertTriangle } from "lucide-react";
import { DbCandidate } from "@/types/database";

interface Props {
  candidate: DbCandidate;
}

export const GdprControls = ({ candidate }: Props) => {
  const { deleteCandidate, updateCandidate } = useJobs();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [anonOpen, setAnonOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleDelete = async () => {
    setProcessing(true);
    // Delete CV from storage if exists
    if (candidate.cv_file_path) {
      await supabase.storage.from("candidate-cvs").remove([candidate.cv_file_path]);
    }
    // Delete events
    await supabase.from("candidate_events").delete().eq("candidate_id", candidate.id);
    // Delete comments
    await supabase.from("candidate_comments").delete().eq("candidate_id", candidate.id);
    // Delete candidate
    await deleteCandidate(candidate.id);
    toast({ title: "Candidate deleted", description: "All data has been permanently removed." });
    navigate("/applicants");
    setProcessing(false);
  };

  const handleAnonymise = async () => {
    setProcessing(true);
    // Delete CV from storage
    if (candidate.cv_file_path) {
      await supabase.storage.from("candidate-cvs").remove([candidate.cv_file_path]);
    }
    // Anonymise candidate data
    await updateCandidate(candidate.id, {
      full_name: "[Anonymised]",
      email: "[anonymised]",
      phone: "[anonymised]",
      cv_file_path: null,
      notes: null,
      agency_name: null,
    } as any);
    toast({ title: "Candidate anonymised", description: "Personal data removed, audit trail preserved." });
    setAnonOpen(false);
    setProcessing(false);
  };

  return (
    <div className="flex gap-2">
      <Dialog open={anonOpen} onOpenChange={setAnonOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <EyeOff className="h-3.5 w-3.5 mr-1.5" />
            Anonymise
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Anonymise Candidate
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will replace {candidate.full_name}'s personal data with "[Anonymised]" and delete their CV.
            Stage history and events will be preserved for reporting.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setAnonOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleAnonymise} disabled={processing}>
              {processing ? "Processing..." : "Anonymise"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Permanently Delete Candidate
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete {candidate.full_name}, their CV, all events, and comments.
            This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={processing}>
              {processing ? "Deleting..." : "Delete Forever"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
