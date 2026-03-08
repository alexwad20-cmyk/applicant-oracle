import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { JobsProvider } from "./contexts/JobsContext";
import { DepartmentFilterProvider } from "./contexts/DepartmentFilterContext";
import { ImpersonationProvider } from "./contexts/ImpersonationContext";
import { Dashboard } from "./components/Dashboard";
import { JobPipeline } from "./components/JobPipeline";
import { AddCandidate } from "./components/AddCandidate";
import { ApplicantList } from "./components/ApplicantList";
import { ApplicantDetail } from "./components/ApplicantDetail";
import { DebugPanel } from "./components/DebugPanel";
import Auth from "./pages/Auth";
import InviteUsers from "./pages/InviteUsers";
import EmailTemplates from "./pages/EmailTemplates";
import ReviewToken from "./pages/ReviewToken";
import SharedReview from "./pages/SharedReview";
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
    <Route path="/review/:token" element={<ReviewToken />} />
    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/pipeline" element={<ProtectedRoute><JobPipeline /></ProtectedRoute>} />
    <Route path="/add-candidate" element={<ProtectedRoute><AddCandidate /></ProtectedRoute>} />
    <Route path="/add-applicant" element={<ProtectedRoute><AddCandidate /></ProtectedRoute>} />
    <Route path="/applicants" element={<ProtectedRoute><ApplicantList /></ProtectedRoute>} />
    <Route path="/applicants/:id" element={<ProtectedRoute><ApplicantDetail /></ProtectedRoute>} />
    <Route path="/candidates/:id" element={<ProtectedRoute><ApplicantDetail /></ProtectedRoute>} />
    <Route path="/settings/invite" element={<ProtectedRoute><InviteUsers /></ProtectedRoute>} />
    <Route path="/settings/email-templates" element={<ProtectedRoute><EmailTemplates /></ProtectedRoute>} />
    <Route path="/debug" element={<ProtectedRoute><DebugPanel /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ImpersonationProvider>
        <JobsProvider>
          <DepartmentFilterProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </DepartmentFilterProvider>
        </JobsProvider>
      </ImpersonationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
