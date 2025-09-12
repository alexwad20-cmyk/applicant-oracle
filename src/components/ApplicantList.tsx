import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Search, Filter, Eye, Plus } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { CandidateStage, CANDIDATE_STAGE_LABELS } from "@/types/applicant";
import { useJobs } from "@/hooks/useJobs";

export const ApplicantList = () => {
  const navigate = useNavigate();
  const { candidates, jobs } = useJobs();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const filteredApplicants = useMemo(() => {
    return candidates.filter(candidate => {
      const job = jobs.find(j => j.id === candidate.jobId);
      const matchesSearch = candidate.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (job?.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStage = stageFilter === "all" || candidate.stage === stageFilter;
      
      return matchesSearch && matchesStage;
    });
  }, [candidates, jobs, searchTerm, stageFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-7xl mx-auto">
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">All Applicants</h1>
              <p className="text-muted-foreground mt-2">{filteredApplicants.length} of {candidates.length} applicants</p>
            </div>
            <Button 
              onClick={() => navigate("/add-applicant")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Applicant
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="shadow-soft border-0 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {Object.entries(CANDIDATE_STAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Applicants Table */}
        <Card className="shadow-soft border-0">
          <CardContent className="p-0">
            {filteredApplicants.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  {candidates.length === 0 ? "No applicants found" : "No applicants match your search criteria"}
                </p>
                <Button 
                  onClick={() => navigate("/add-applicant")}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Applicant
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Visa</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplicants.map((candidate) => {
                    const job = jobs.find(j => j.id === candidate.jobId);
                    return (
                      <TableRow key={candidate.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{candidate.name}</TableCell>
                        <TableCell>{job?.title || 'Unknown Position'}</TableCell>
                        <TableCell>{candidate.email}</TableCell>
                        <TableCell>
                          {new Date(candidate.dateOfApplication).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <StatusBadge stage={candidate.stage} />
                        </TableCell>
                        <TableCell>
                          {candidate.needsVisa ? (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                              Visa Required
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                              No Visa
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/applicants/${candidate.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};