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
import { useJobs } from "@/hooks/useJobs";
import { CandidateStage } from "@/types/applicant";
import { useToast } from "@/hooks/use-toast";

export const AddApplicant = () => {
  const navigate = useNavigate();
  const { jobs, addCandidate } = useJobs();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    jobId: "",
    dateOfApplication: new Date().toISOString().split('T')[0],
    needsVisa: false,
    fromAgency: false,
    agencyName: "",
    notes: "",
  });

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any>(null);

  const handleCvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCvFile(file);
      
      // Simulate CV parsing
      setTimeout(() => {
        const mockParsedData = {
          name: "John Doe",
          email: "john.doe@email.com", 
          phone: "+44 7123 456789",
          address: "123 Main St, London, UK"
        };
        setParsedData(mockParsedData);
        setFormData(prev => ({
          ...prev,
          ...mockParsedData
        }));
        
        toast({
          title: "CV Parsed Successfully",
          description: "Candidate information has been extracted from the CV",
        });
      }, 1500);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.jobId) {
      toast({
        title: "Please select a job",
        description: "A job position must be selected for the candidate",
        variant: "destructive",
      });
      return;
    }

    const newCandidate = addCandidate({
      ...formData,
      stage: CandidateStage.NEW_APPLICANT,
      cvFile: cvFile || undefined,
    });

    toast({
      title: "Candidate Added",
      description: `${formData.name} has been added successfully`,
    });

    navigate("/pipeline");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/pipeline")}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Pipeline
        </Button>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Add New Candidate</h1>
            <p className="text-muted-foreground mt-2">Add a new candidate to the hiring pipeline</p>
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
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Upload a CV to automatically extract candidate information
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleCvUpload}
                      className="hidden"
                      id="cv-upload"
                    />
                    <Label htmlFor="cv-upload" className="cursor-pointer">
                      <Button type="button" variant="outline" className="mt-2">
                        Choose File
                      </Button>
                    </Label>
                  </div>
                </div>
                
                {cvFile && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm font-medium">Uploaded: {cvFile.name}</p>
                    {parsedData && (
                      <div className="mt-2 text-xs text-success">
                        ✓ CV parsed successfully - information populated below
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Job Selection */}
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Briefcase className="h-5 w-5 mr-2" />
                  Job Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="job">Select Job Position *</Label>
                  <Select value={formData.jobId} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, jobId: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job position" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.filter(job => job.status === 'open').map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title} - {job.department}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter full name"
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
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter phone number"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dateOfApplication">Application Date</Label>
                    <Input
                      id="dateOfApplication"
                      type="date"
                      value={formData.dateOfApplication}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateOfApplication: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Enter full address"
                    rows={2}
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
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="needsVisa"
                      checked={formData.needsVisa}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, needsVisa: checked as boolean }))
                      }
                    />
                    <Label htmlFor="needsVisa">Requires visa sponsorship</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="fromAgency"
                      checked={formData.fromAgency}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, fromAgency: checked as boolean }))
                      }
                    />
                    <Label htmlFor="fromAgency">Candidate from recruitment agency</Label>
                  </div>
                  
                  {formData.fromAgency && (
                    <div className="space-y-2 ml-6">
                      <Label htmlFor="agencyName">Agency Name</Label>
                      <Input
                        id="agencyName"
                        value={formData.agencyName}
                        onChange={(e) => setFormData(prev => ({ ...prev, agencyName: e.target.value }))}
                        placeholder="Enter agency name"
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any additional notes about the candidate"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button 
                type="submit" 
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Add Candidate
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/pipeline")}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};