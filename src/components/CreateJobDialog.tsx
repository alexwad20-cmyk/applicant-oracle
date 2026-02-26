import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useJobs } from "@/contexts/JobsContext";
import { useToast } from "@/hooks/use-toast";

export const CreateJobDialog = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { addJob } = useJobs();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const job = await addJob({ title: title.trim(), department, location, description, status: "open" });
    setSubmitting(false);
    if (job) {
      toast({ title: "Job created", description: `${job.title} has been added` });
      setTitle(""); setDepartment(""); setLocation(""); setDescription("");
      setOpen(false);
    } else {
      toast({ title: "Error", description: "Failed to create job", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Create Job
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="job-title">Title *</Label>
            <Input id="job-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-dept">Department</Label>
            <Input id="job-dept" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Engineering" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-loc">Location</Label>
            <Input id="job-loc" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. London, UK" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="job-desc">Description</Label>
            <Textarea id="job-desc" value={description} onChange={e => setDescription(e.target.value)} placeholder="Job description..." rows={3} />
          </div>
          <Button type="submit" disabled={submitting || !title.trim()} className="w-full">
            {submitting ? "Creating..." : "Create Job"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
