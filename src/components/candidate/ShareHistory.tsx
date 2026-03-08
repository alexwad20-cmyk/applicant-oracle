import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Ban, ExternalLink, Eye } from "lucide-react";

interface Share {
  id: string;
  recipient_email: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
}

interface Props {
  candidateId: string;
}

export const ShareHistory = ({ candidateId }: Props) => {
  const { toast } = useToast();
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShares = useCallback(async () => {
    const { data } = await supabase
      .from("candidate_email_shares")
      .select("id, recipient_email, created_at, expires_at, revoked_at, last_viewed_at")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    if (data) setShares(data as any);
    setLoading(false);
  }, [candidateId]);

  useEffect(() => { fetchShares(); }, [fetchShares]);

  const handleRevoke = async (shareId: string) => {
    const { error } = await supabase
      .from("candidate_email_shares")
      .update({ revoked_at: new Date().toISOString() } as any)
      .eq("id", shareId);
    if (error) {
      toast({ title: "Failed to revoke", variant: "destructive" });
    } else {
      toast({ title: "Share revoked" });
      // Log event
      await supabase.from("candidate_events").insert({
        candidate_id: candidateId,
        action_type: "share_revoked",
        notes: `Revoked share ${shareId}`,
      } as any);
      fetchShares();
    }
  };

  const getStatus = (share: Share): { label: string; variant: "default" | "destructive" | "outline" | "secondary" } => {
    if (share.revoked_at) return { label: "Revoked", variant: "destructive" };
    if (new Date(share.expires_at) < new Date()) return { label: "Expired", variant: "secondary" };
    return { label: "Active", variant: "default" };
  };

  if (loading) return null;
  if (shares.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Share History</p>
      <div className="space-y-2">
        {shares.map((share) => {
          const status = getStatus(share);
          const isActive = status.label === "Active";
          return (
            <div key={share.id} className="flex items-center justify-between text-xs border rounded-md p-2 bg-muted/30">
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="font-medium truncate">{share.recipient_email}</p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>Sent {new Date(share.created_at).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>Expires {new Date(share.expires_at).toLocaleDateString()}</span>
                  {share.last_viewed_at && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Eye className="h-3 w-3" />
                        Viewed
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <Badge variant={status.variant} className="text-[10px]">{status.label}</Badge>
                {isActive && (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-destructive" onClick={() => handleRevoke(share.id)}>
                    <Ban className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
