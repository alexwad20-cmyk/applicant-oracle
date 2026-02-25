import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { JobsProvider } from "./contexts/JobsContext";
import { Dashboard } from "./components/Dashboard";
import { JobPipeline } from "./components/JobPipeline";
import { AddCandidate } from "./components/AddCandidate";
import { ApplicantList } from "./components/ApplicantList";
import { ApplicantDetail } from "./components/ApplicantDetail";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/pipeline" element={<ProtectedRoute><JobPipeline /></ProtectedRoute>} />
    <Route path="/add-candidate" element={<ProtectedRoute><AddCandidate /></ProtectedRoute>} />
    <Route path="/add-applicant" element={<ProtectedRoute><AddCandidate /></ProtectedRoute>} />
    <Route path="/applicants" element={<ProtectedRoute><ApplicantList /></ProtectedRoute>} />
    <Route path="/applicants/:id" element={<ProtectedRoute><ApplicantDetail /></ProtectedRoute>} />
    <Route path="/candidates/:id" element={<ProtectedRoute><ApplicantDetail /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <JobsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </JobsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
