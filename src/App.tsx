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

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, roles, rolesLoading } = useAuth();
  if (loading || rolesLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!roles.includes("admin")) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const HrOrAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, roles, rolesLoading } = useAuth();
  if (loading || rolesLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!roles.includes("admin") && !roles.includes("hr")) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/review/:token" element={<ReviewToken />} />
    <Route path="/shared-review/:token" element={<SharedReview />} />
    <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/pipeline" element={<ProtectedRoute><JobPipeline /></ProtectedRoute>} />
    <Route path="/add-candidate" element={<HrOrAdminRoute><AddCandidate /></HrOrAdminRoute>} />
    <Route path="/add-applicant" element={<HrOrAdminRoute><AddCandidate /></HrOrAdminRoute>} />
    <Route path="/applicants" element={<ProtectedRoute><ApplicantList /></ProtectedRoute>} />
    <Route path="/applicants/:id" element={<ProtectedRoute><ApplicantDetail /></ProtectedRoute>} />
    <Route path="/candidates/:id" element={<ProtectedRoute><ApplicantDetail /></ProtectedRoute>} />
    <Route path="/settings/invite" element={<HrOrAdminRoute><InviteUsers /></HrOrAdminRoute>} />
    <Route path="/settings/email-templates" element={<HrOrAdminRoute><EmailTemplates /></HrOrAdminRoute>} />
    <Route path="/debug" element={<AdminOnlyRoute><DebugPanel /></AdminOnlyRoute>} />
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
