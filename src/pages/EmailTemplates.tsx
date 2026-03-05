import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/AppLayout";
import { Mail, Edit, Eye, Save } from "lucide-react";

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject_template: string;
  html_template: string;
  text_template: string | null;
  is_active: boolean;
  updated_at: string;
}

const EmailTemplates = () => {
  const { isHrOrAdmin, user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [previewing, setPreviewing] = useState<EmailTemplate | null>(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("created_at");
    if (data) setTemplates(data as any);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleEdit = (t: EmailTemplate) => {
    setEditing(t);
    setSubject(t.subject_template);
    setHtml(t.html_template);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject_template: subject,
        html_template: html,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", editing.id);
    if (error) {
      toast({ title: "Failed to save", variant: "destructive" });
    } else {
      toast({ title: "Template saved" });
      setEditing(null);
      fetchTemplates();
    }
    setSaving(false);
  };

  const handleToggleActive = async (t: EmailTemplate) => {
    await supabase
      .from("email_templates")
      .update({ is_active: !t.is_active } as any)
      .eq("id", t.id);
    fetchTemplates();
  };

  const renderPreview = (template: EmailTemplate) => {
    const sampleData: Record<string, string> = {
      "{{candidate_name}}": "Jane Smith",
      "{{job_title}}": "Senior Engineer",
      "{{hiring_manager_name}}": "John Doe",
      "{{review_link}}": "#",
      "{{comment_link}}": "#",
      "{{days_waiting}}": "3",
      "{{decision}}": "approved",
      "{{reason}}": "Great fit",
      "{{notes}}": "Strong technical skills",
    };
    let html = template.html_template;
    let subj = template.subject_template;
    for (const [key, val] of Object.entries(sampleData)) {
      html = html.split(key).join(val);
      subj = subj.split(key).join(val);
    }
    // Remove handlebars conditionals simply
    html = html.replace(/\{\{#if\s+\w+\}\}/g, "").replace(/\{\{\/if\}\}/g, "");
    return { html, subject: subj };
  };

  if (!isHrOrAdmin) {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto p-6 text-center py-12">
          <p className="text-muted-foreground">You do not have permission to manage email templates.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Email Templates</h1>
          <p className="text-muted-foreground mt-1">Manage notification email templates</p>
        </div>

        <div className="space-y-4">
          {templates.map((t) => (
            <Card key={t.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={t.is_active ? "default" : "secondary"} className="text-xs">
                    {t.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Switch checked={t.is_active} onCheckedChange={() => handleToggleActive(t)} />
                  <Button variant="ghost" size="sm" onClick={() => setPreviewing(t)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit: {editing?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>HTML Body</Label>
                <Textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={12} className="font-mono text-xs" />
              </div>
              <p className="text-xs text-muted-foreground">
                Available placeholders: {"{{candidate_name}}"}, {"{{job_title}}"}, {"{{hiring_manager_name}}"}, {"{{review_link}}"}, {"{{days_waiting}}"}, {"{{decision}}"}, {"{{reason}}"}, {"{{notes}}"}
              </p>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Preview: {previewing?.name}</DialogTitle>
            </DialogHeader>
            {previewing && (() => {
              const { html, subject } = renderPreview(previewing);
              return (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Subject</Label>
                    <p className="font-medium text-sm">{subject}</p>
                  </div>
                  <div className="border rounded-lg p-4 bg-background">
                    <div dangerouslySetInnerHTML={{ __html: html }} className="prose prose-sm max-w-none" />
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default EmailTemplates;
