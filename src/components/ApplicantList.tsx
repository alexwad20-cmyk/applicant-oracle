import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Eye, Plus, Send, X } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { useJobs } from "@/contexts/JobsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useDepartmentFilter } from "@/contexts/DepartmentFilterContext";
import { AppLayout } from "./AppLayout";
import { STAGE_LABELS, CandidateStage } from "@/types/database";
import { BulkSendForReviewDialog } from "./candidate/BulkSendForReviewDialog";

export const ApplicantList = () => {
  const navigate = useNavigate();
  const { candidates, jobs } = useJobs();
  const { } = useAuth();
  const { effectiveIsHrOrAdmin } = useEffectivePermissions();
  const { department: deptFilter } = useDepartmentFilter();
  const [searchTerm, setSearchTerm] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    return candidates.filter(c => {
      const job = jobs.find(j => j.id === c.job_id);
      if (deptFilter !== 'all' && job?.department !== deptFilter) return false;
      const matchesSearch = c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job?.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStage = stageFilter === "all" || c.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [candidates, jobs, searchTerm, stageFilter, deptFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const selectedCandidates = candidates.filter(c => selectedIds.has(c.id));
  const allChecked = filtered.length > 0 && selectedIds.size === filtered.length;
  const someChecked = selectedIds.size > 0 && selectedIds.size < filtered.length;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">All Candidates</h1>
            <p className="text-muted-foreground mt-1">{filtered.length} of {candidates.length} candidates</p>
          </div>
          <Button onClick={() => navigate("/add-candidate")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Candidate
          </Button>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {Object.entries(STAGE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No candidates found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {isHrOrAdmin && (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                          {...(someChecked ? { "data-state": "indeterminate" } : {})}
                        />
                      </TableHead>
                    )}
                    <TableHead>Name</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Visa</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const job = jobs.find(j => j.id === c.job_id);
                    return (
                      <TableRow key={c.id} className={selectedIds.has(c.id) ? "bg-accent/10" : ""}>
                        {isHrOrAdmin && (
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(c.id)}
                              onCheckedChange={() => toggleSelect(c.id)}
                              aria-label={`Select ${c.full_name}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-medium">{c.full_name}</TableCell>
                        <TableCell>{job?.title || '—'}</TableCell>
                        <TableCell>
                          {job?.department ? (
                            <Badge variant="outline" className="text-xs">{job.department}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="capitalize">{c.source}</TableCell>
                        <TableCell><StatusBadge stage={c.stage} /></TableCell>
                        <TableCell>
                          {c.visa_required ? (
                            <Badge variant="outline" className="text-xs">Visa Required</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/candidates/${c.id}`)}>
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

        {/* Bulk action bar */}
        {isHrOrAdmin && selectedIds.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border shadow-lg rounded-lg px-6 py-3 flex items-center gap-4">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" onClick={() => setBulkDialogOpen(true)}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send to HM Review
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <BulkSendForReviewDialog
          open={bulkDialogOpen}
          onOpenChange={setBulkDialogOpen}
          selectedCandidates={selectedCandidates}
          onComplete={() => {
            setSelectedIds(new Set());
            setBulkDialogOpen(false);
          }}
        />
      </div>
    </AppLayout>
  );
};
