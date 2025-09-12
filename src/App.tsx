import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { JobsProvider } from "./contexts/JobsContext";
import { Dashboard } from "./components/Dashboard";
import { JobPipeline } from "./components/JobPipeline";
import { AddCandidate } from "./components/AddCandidate";
import { ApplicantList } from "./components/ApplicantList";
import { ApplicantDetail } from "./components/ApplicantDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <JobsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pipeline" element={<JobPipeline />} />
            <Route path="/add-applicant" element={<AddCandidate />} />
            <Route path="/add-candidate" element={<AddCandidate />} />
            <Route path="/applicants" element={<ApplicantList />} />
            <Route path="/applicants/:id" element={<ApplicantDetail />} />
            <Route path="/candidates/:id" element={<ApplicantDetail />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </JobsProvider>
  </QueryClientProvider>
);

export default App;
