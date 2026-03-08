import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, Save, FileText, Eye, Edit } from "lucide-react";
import { ALL_PLACEHOLDERS, interpolateTemplate, PlaceholderValues } from "@/lib/emailPlaceholders";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useToast } from "@/hooks/use-toast";

interface EmailComposerProps {
  templateKey: string;
  defaultSubject: string;
  defaultHtml: string;
  subject: string;
  htmlBody: string;
  onSubjectChange: (s: string) => void;
  onHtmlChange: (h: string) => void;
  previewValues: PlaceholderValues;
  candidateId?: string;
  hmUserId?: string;
  showSaveAsTemplate?: boolean;
  showSaveDraft?: boolean;
}

export const EmailComposer = ({
  templateKey,
  defaultSubject,
  defaultHtml,
  subject,
  htmlBody,
  onSubjectChange,
  onHtmlChange,
  previewValues,
  candidateId,
  hmUserId,
  showSaveAsTemplate = true,
  showSaveDraft = true,
}: EmailComposerProps) => {
  const { user, isHrOrAdmin } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const previewSubject = useMemo(
    () => interpolateTemplate(subject, previewValues),
    [subject, previewValues]
  );
  const previewHtml = useMemo(
    () => interpolateTemplate(htmlBody, previewValues),
    [htmlBody, previewValues]
  );

  const handleInsertPlaceholder = (placeholder: string) => {
    onHtmlChange(htmlBody + placeholder);
  };

  const handleReset = () => {
    onSubjectChange(defaultSubject);
    onHtmlChange(defaultHtml);
    toast({ title: "Reset to template defaults" });
  };

  const handleSaveAsTemplate = async () => {
    if (!isHrOrAdmin) return;
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject_template: subject,
        html_template: htmlBody,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("key", templateKey);
    if (error) {
      toast({ title: "Failed to save template", variant: "destructive" });
    } else {
      toast({ title: "Template saved" });
    }
    setSaving(false);
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("email_drafts").upsert(
      {
        template_key: templateKey,
        candidate_id: candidateId || null,
        hiring_manager_user_id: hmUserId || null,
        subject_override: subject !== defaultSubject ? subject : null,
        html_override: htmlBody !== defaultHtml ? htmlBody : null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "template_key,candidate_id" as any }
    );
    if (error) {
      // Fallback: just insert
      await supabase.from("email_drafts").insert({
        template_key: templateKey,
        candidate_id: candidateId || null,
        hiring_manager_user_id: hmUserId || null,
        subject_override: subject !== defaultSubject ? subject : null,
        html_override: htmlBody !== defaultHtml ? htmlBody : null,
        created_by: user.id,
      } as any);
    }
    toast({ title: "Draft saved" });
    setSaving(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: Edit pane */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-medium flex items-center gap-1.5">
            <Edit className="h-3.5 w-3.5" />
            Edit Email
          </Label>
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Subject</Label>
          <Input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Email subject..."
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Body (HTML)</Label>
            <Select onValueChange={handleInsertPlaceholder}>
              <SelectTrigger className="w-[180px] h-7 text-xs">
                <SelectValue placeholder="Insert placeholder..." />
              </SelectTrigger>
              <SelectContent>
                {ALL_PLACEHOLDERS.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={htmlBody}
            onChange={(e) => onHtmlChange(e.target.value)}
            rows={14}
            className="font-mono text-xs"
          />
        </div>

        <div className="flex gap-2">
          {showSaveAsTemplate && isHrOrAdmin && (
            <Button variant="outline" size="sm" onClick={handleSaveAsTemplate} disabled={saving} className="text-xs">
              <Save className="h-3 w-3 mr-1" />
              Save as Template
            </Button>
          )}
          {showSaveDraft && (
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving} className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Save Draft
            </Button>
          )}
        </div>
      </div>

      {/* Right: Preview pane */}
      <div className="space-y-3">
        <Label className="font-medium flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" />
          Live Preview
        </Label>

        <Tabs defaultValue="html" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="html" className="flex-1 text-xs">Desktop</TabsTrigger>
            <TabsTrigger value="text" className="flex-1 text-xs">Plain Text</TabsTrigger>
          </TabsList>

          <TabsContent value="html" className="space-y-2 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <p className="font-medium text-sm">{previewSubject}</p>
            </div>
            <div className="border rounded-lg p-4 bg-card max-h-[400px] overflow-y-auto">
              <div
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                className="prose prose-sm max-w-none"
              />
            </div>
          </TabsContent>

          <TabsContent value="text" className="space-y-2 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground">Subject</Label>
              <p className="font-medium text-sm">{previewSubject}</p>
            </div>
            <div className="border rounded-lg p-4 bg-card max-h-[400px] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono">
                {previewHtml.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
