import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Send } from "lucide-react";

interface Props {
  candidateId: string;
  candidateName?: string;
  hasCv?: boolean;
}

export const ShareWithReviewer = ({ candidateId, candidateName, hasCv }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [expiryDays, setExpiryDays] = useState("7");
  const [attachCv, setAttachCv] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      toast({ title: "Please enter a reviewer email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-candidate-share", {
        body: {
          candidate_id: candidateId,
          recipient_email: email.trim(),
          expiry_days: parseInt(expiryDays),
          message: message.trim() || null,
          attach_cv: attachCv,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Share sent", description: `Review link emailed to ${email.trim()}` });
      setOpen(false);
      setEmail("");
      setMessage("");
    } catch (err: any) {
      toast({ title: "Failed to share", description: err.message, variant: "destructive" });
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
          <DialogTitle>Share with External Reviewer</DialogTitle>
          <DialogDescription>
            Send a secure, time-limited review link via email. The reviewer can view the candidate and leave comments — no account needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Reviewer email *</Label>
            <Input
              type="email"
              placeholder="reviewer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Message to reviewer (optional)</Label>
            <Textarea
              placeholder="Any additional context..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Link expires in</Label>
            <Select value={expiryDays} onValueChange={setExpiryDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">24 hours</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {hasCv && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="attach-cv"
                checked={attachCv}
                onCheckedChange={(v) => setAttachCv(!!v)}
              />
              <Label htmlFor="attach-cv" className="text-sm cursor-pointer">
                Attach CV to email (if available)
              </Label>
            </div>
          )}
          <Button className="w-full" onClick={handleSend} disabled={submitting || !email.trim()}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Sending..." : "Send Share Email"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
