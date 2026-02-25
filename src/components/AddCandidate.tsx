import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload, FileText, User, Briefcase } from "lucide-react";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "./AppLayout";
import { CandidateSource } from "@/types/database";

export const AddCandidate = () => {
  const navigate = useNavigate();
  const { jobs, addCandidate } = useJobs();
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    job_id: "",
    source: "direct" as CandidateSource,
    visa_required: false,
    agency_name: "",
    notes: "",
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleCvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setCvFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.job_id) {
      toast({ title: "Please select a job", variant: "destructive" });
      return;
    }

    setUploading(true);
    let cvPath: string | null = null;

    // Upload CV if present
    if (cvFile) {
      const ext = cvFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('candidate-cvs')
        .upload(fileName, cvFile);
      if (uploadError) {
        toast({ title: "CV upload failed", description: uploadError.message, variant: "destructive" });
        setUploading(false);
        return;
      }
      cvPath = fileName;
    }

    const result = await addCandidate({
      ...formData,
      cv_file_path: cvPath,
      stage: 'new_applicant',
      agency_name: formData.source === 'agency' ? formData.agency_name : null,
    });

    setUploading(false);

    if (result) {
      toast({ title: "Candidate Added", description: `${formData.full_name} added successfully` });
      navigate("/pipeline");
    } else {
      toast({ title: "Error adding candidate", variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6">
        <Button variant="ghost" onClick={() => navigate("/pipeline")} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pipeline
        </Button>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Add New Candidate</h1>
            <p className="text-muted-foreground mt-1">Add a candidate to the hiring pipeline</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CV Upload */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <FileText className="h-5 w-5 mr-2" />
                  CV Upload
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">Upload candidate CV (PDF, DOC)</p>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={handleCvUpload} className="hidden" id="cv-upload" />
                  <Label htmlFor="cv-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm">Choose File</Button>
                  </Label>
                </div>
                {cvFile && (
                  <p className="text-sm mt-2 text-muted-foreground">Selected: {cvFile.name}</p>
                )}
              </CardContent>
            </Card>

            {/* Job Selection */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Briefcase className="h-5 w-5 mr-2" />
                  Job Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="job">Select Job *</Label>
                <Select value={formData.job_id} onValueChange={(v) => setFormData(p => ({ ...p, job_id: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.filter(j => j.status === 'open').map(job => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} — {job.department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Personal Info */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <User className="h-5 w-5 mr-2" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Full Name *</Label>
                    <Input value={formData.full_name} onChange={(e) => setFormData(p => ({ ...p, full_name: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Email</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Phone</Label>
                    <Input value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Source</Label>
                    <Select value={formData.source} onValueChange={(v) => setFormData(p => ({ ...p, source: v as CandidateSource }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="direct">Direct</SelectItem>
                        <SelectItem value="agency">Agency</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {formData.source === 'agency' && (
                  <div className="space-y-1">
                    <Label>Agency Name</Label>
                    <Input value={formData.agency_name} onChange={(e) => setFormData(p => ({ ...p, agency_name: e.target.value }))} />
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="visa"
                    checked={formData.visa_required}
                    onCheckedChange={(checked) => setFormData(p => ({ ...p, visa_required: checked as boolean }))}
                  />
                  <Label htmlFor="visa">Requires visa sponsorship</Label>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Additional notes"
                  rows={3}
                  className="mt-1"
                />
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button type="submit" className="flex-1" disabled={uploading}>
                {uploading ? 'Adding...' : 'Add Candidate'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/pipeline")} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};
