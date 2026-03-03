import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REJECTION_REASON_LABELS, RejectionReason } from "@/types/database";

interface Props {
  open: boolean;
  candidateName: string;
  onConfirm: (reason: RejectionReason, notes: string) => void;
  onCancel: () => void;
}

export const RejectionReasonModal = ({ open, candidateName, onConfirm, onCancel }: Props) => {
  const [reason, setReason] = useState<RejectionReason | "">("");
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason, notes);
    setReason("");
    setNotes("");
  };

  const handleCancel = () => {
    setReason("");
    setNotes("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {candidateName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Reason *</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as RejectionReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REJECTION_REASON_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCancel}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleConfirm} disabled={!reason}>
              Confirm Rejection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
