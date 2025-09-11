import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, ArrowLeft } from "lucide-react";
import { InterviewStage } from "@/types/applicant";
import { useApplicants } from "@/hooks/useApplicants";

export const AddApplicant = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addApplicant } = useApplicants();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    roleAppliedFor: "",
    needsVisa: false,
    fromAgency: false,
    agencyName: "",
    interviewStage: InterviewStage.APPLIED,
    notes: "",
  });
  
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCvFile(file);
    setIsProcessing(true);

    // Simulate CV parsing
    setTimeout(() => {
      // Mock extracted data
      const mockData = {
        name: "John Doe",
        email: "john.doe@email.com",
        phone: "+1 (555) 123-4567",
        address: "123 Main Street, City, State 12345"
      };

      setFormData(prev => ({
        ...prev,
        ...mockData
      }));

      toast({
        title: "CV Parsed Successfully",
        description: "Key information has been extracted from the CV.",
      });

      setIsProcessing(false);
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.roleAppliedFor) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    addApplicant({
      ...formData,
      dateOfApplication: new Date().toISOString(),
      jobAccepted: null,
      cvFile,
    });

    toast({
      title: "Applicant Added",
      description: `${formData.name} has been added successfully.`,
    });

    navigate("/applicants");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Add New Applicant</h1>
          <p className="text-muted-foreground mt-2">Upload CV and enter applicant information</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* CV Upload Section */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                CV Upload & Parsing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="cv-upload"
                />
                <label htmlFor="cv-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {cvFile ? `Uploaded: ${cvFile.name}` : "Click to upload CV (PDF, DOC, DOCX)"}
                  </p>
                </label>
                {isProcessing && (
                  <div className="mt-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground mt-2">Processing CV...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Application Details */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role Applied For *</Label>
                  <Input
                    id="role"
                    value={formData.roleAppliedFor}
                    onChange={(e) => setFormData(prev => ({ ...prev, roleAppliedFor: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage">Interview Stage</Label>
                  <Select
                    value={formData.interviewStage}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, interviewStage: value as InterviewStage }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={InterviewStage.APPLIED}>Applied</SelectItem>
                      <SelectItem value={InterviewStage.SCREENING}>Screening</SelectItem>
                      <SelectItem value={InterviewStage.FIRST_INTERVIEW}>First Interview</SelectItem>
                      <SelectItem value={InterviewStage.SECOND_INTERVIEW}>Second Interview</SelectItem>
                      <SelectItem value={InterviewStage.FINAL_INTERVIEW}>Final Interview</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="visa"
                    checked={formData.needsVisa}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, needsVisa: checked }))}
                  />
                  <Label htmlFor="visa">Needs Visa</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="agency"
                    checked={formData.fromAgency}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, fromAgency: checked }))}
                  />
                  <Label htmlFor="agency">From Agency</Label>
                </div>
              </div>

              {formData.fromAgency && (
                <div className="space-y-2">
                  <Label htmlFor="agencyName">Agency Name</Label>
                  <Input
                    id="agencyName"
                    value={formData.agencyName}
                    onChange={(e) => setFormData(prev => ({ ...prev, agencyName: e.target.value }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Add Applicant
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};