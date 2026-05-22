import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useJobs } from "@/contexts/JobsContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Trash2, EyeOff, AlertTriangle, FileX, Link2Off } from "lucide-react";
import { DbCandidate } from "@/types/database";

interface Props {
  candidate: DbCandidate;
}

type Action = "anonymize" | "delete" | "remove_cv" | "expire_links";

export const GdprControls = ({ candidate }: Props) => {
  const { refreshCandidates } = useJobs();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [openAction, setOpenAction] = useState<Action | null>(null);
  const [processing, setProcessing] = useState(false);

  const run = async (action: Action) => {
    setProcessing(true);
    const { data, error } = await supabase.functions.invoke("gdpr-action", {
      body: { action, candidate_id: candidate.id },
    });
    setProcessing(false);
    if (error || (data && (data as { error?: string }).error)) {
      toast({
        title: "Action failed",
        description: error?.message || (data as { error?: string })?.error || "Unknown error",
        variant: "destructive",
      });
      return;
    }
    toast({ title: titleFor(action), description: descFor(action, candidate.full_name) });
    setOpenAction(null);
    await refreshCandidates();
    if (action === "delete") navigate("/applicants");
  };

  const titleFor = (a: Action) =>
    a === "delete" ? "Candidate deleted"
    : a === "anonymize" ? "Candidate anonymised"
    : a === "remove_cv" ? "CV removed"
    : "Share links expired";

  const descFor = (a: Action, name: string) =>
    a === "delete" ? `${name} and all related data were permanently deleted.`
    : a === "anonymize" ? `${name}'s personal data was redacted. Audit trail preserved.`
    : a === "remove_cv" ? `CV file for ${name} was removed.`
    : `All outstanding share/review links for ${name} were revoked.`;

  const Btn = ({ a, icon: Icon, label, variant = "outline" as const }: { a: Action; icon: React.ComponentType<{ className?: string }>; label: string; variant?: "outline" | "destructive" }) => (
    <Button variant={variant} size="sm" onClick={() => setOpenAction(a)}>
      <Icon className="h-3.5 w-3.5 mr-1.5" />{label}
    </Button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      <Btn a="remove_cv" icon={FileX} label="Remove CV" />
      <Btn a="expire_links" icon={Link2Off} label="Expire share links" />
      <Btn a="anonymize" icon={EyeOff} label="Anonymise" />
      <Btn a="delete" icon={Trash2} label="Delete" variant="destructive" />

      <Dialog open={openAction !== null} onOpenChange={(o) => !o && setOpenAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {openAction === "delete" && `Permanently delete ${candidate.full_name}`}
              {openAction === "anonymize" && `Anonymise ${candidate.full_name}`}
              {openAction === "remove_cv" && `Remove CV for ${candidate.full_name}`}
              {openAction === "expire_links" && `Expire all share/review links`}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {openAction === "delete" && "Permanently deletes the candidate, CV, comments, events, share links and review tokens. Cannot be undone."}
            {openAction === "anonymize" && "Replaces name, email, phone, notes and agency with '[redacted]', deletes the CV, strips PII from comments, and revokes outstanding links. Stage history rows remain for reporting (with notes cleared)."}
            {openAction === "remove_cv" && "Deletes the CV file only. Candidate record and history are kept."}
            {openAction === "expire_links" && "Revokes every active reviewer share link and HM review token for this candidate."}
          </p>
          <p className="text-xs text-muted-foreground">
            Note: scheduled retention (data_retention_settings) is informational only — automatic deletion is not currently enabled.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setOpenAction(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => openAction && run(openAction)} disabled={processing}>
              {processing ? "Processing..." : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

