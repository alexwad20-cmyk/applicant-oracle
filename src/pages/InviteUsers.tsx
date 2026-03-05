import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { UserPlus, Trash2 } from "lucide-react";

interface AllowedUser {
  id: string;
  email: string;
  role_to_assign: string;
  notes: string | null;
  used_at: string | null;
  created_at: string;
}

const InviteUsers = () => {
  const { user, isHrOrAdmin } = useAuth();
  const { toast } = useToast();
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("hiring_manager");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAllowed = async () => {
    const { data } = await supabase
      .from("allowed_users")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setAllowedUsers(data as any);
  };

  useEffect(() => {
    fetchAllowed();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("allowed_users").insert({
      email: email.toLowerCase().trim(),
      role_to_assign: role,
      invited_by: user?.id,
      notes: notes || null,
    } as any);
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already invited", description: "This email is already in the allowlist.", variant: "destructive" });
      } else {
        toast({ title: "Failed to invite", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "User invited", description: `${email} added to allowlist as ${role}` });
      setEmail("");
      setNotes("");
      fetchAllowed();
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("allowed_users").delete().eq("id", id);
    fetchAllowed();
  };

  if (!isHrOrAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6 text-center py-12">
          <p className="text-muted-foreground">You do not have permission to manage invites.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">Invite Users</h1>
        <p className="text-muted-foreground">Manage the allowlist of users who can sign up.</p>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Add to Allowlist</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@company.com"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={submitting} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Allowlist ({allowedUsers.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {allowedUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No users in allowlist</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allowedUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{u.role_to_assign.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        {u.used_at ? (
                          <Badge className="bg-success text-success-foreground text-xs">Activated</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default InviteUsers;
