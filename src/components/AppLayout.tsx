import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation, PreviewRole } from '@/contexts/ImpersonationContext';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useDepartmentFilter } from '@/contexts/DepartmentFilterContext';
import { LayoutDashboard, Briefcase, Users, Plus, LogOut, Shield, Bug, AlertTriangle, Building2, UserPlus, Mail, Eye, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AppLayoutProps {
  children: ReactNode;
}

const ROLE_LABELS: Record<PreviewRole, string> = {
  real: 'Real roles',
  admin: 'Admin',
  hr: 'HR',
  hiring_manager: 'Hiring Manager',
  reviewer: 'Reviewer',
};

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, rolesError, refreshRoles, signOut } = useAuth();
  const { previewRole, setPreviewRole, resetPreviewRole, isImpersonating } = useImpersonation();
  const { effectiveIsHrOrAdmin, effectiveIsHM, effectiveIsAdmin, effectiveIsHR, effectiveIsReviewer, realIsHrOrAdmin } = useEffectivePermissions();
  const { department, setDepartment, departments } = useDepartmentFilter();
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/pipeline', label: 'Pipeline', icon: Briefcase, show: true },
    { to: '/applicants', label: 'All Candidates', icon: Users, show: effectiveIsHrOrAdmin },
    { to: '/add-candidate', label: 'Add Candidate', icon: Plus, show: effectiveIsHrOrAdmin },
    { to: '/settings/invite', label: 'Invite Users', icon: UserPlus, show: effectiveIsHrOrAdmin },
    { to: '/settings/email-templates', label: 'Email Templates', icon: Mail, show: effectiveIsHrOrAdmin },
    { to: '/debug', label: 'Debug', icon: Bug, show: true },
  ];

  const effectiveRoleLabel = effectiveIsAdmin ? 'Admin' : effectiveIsHR ? 'HR' : effectiveIsHM ? 'Hiring Manager' : effectiveIsReviewer ? 'Reviewer' : 'No Role';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-1.5 flex items-center gap-2 justify-center">
          <Eye className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs text-amber-700 font-medium">
            Preview mode: viewing as <strong>{ROLE_LABELS[previewRole]}</strong>. Your database roles are unchanged.
          </span>
          <Button variant="ghost" size="sm" onClick={resetPreviewRole} className="h-5 px-1.5 text-amber-700 hover:text-amber-900">
            <X className="h-3 w-3 mr-0.5" />
            <span className="text-xs">Reset</span>
          </Button>
        </div>
      )}

      {/* Top nav bar */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-foreground">
              <Briefcase className="h-5 w-5 text-primary" />
              <span className="hidden sm:inline">HR Tracker</span>
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.filter(n => n.show).map(item => (
                <Link key={item.to} to={item.to}>
                  <Button
                    variant={location.pathname === item.to ? 'secondary' : 'ghost'}
                    size="sm"
                    className="text-xs"
                  >
                    <item.icon className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden md:inline">{item.label}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {departments.length > 0 && (
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Role Switcher — only for real Admin/HR */}
            {realIsHrOrAdmin && (
              <Select value={previewRole} onValueChange={(v) => setPreviewRole(v as PreviewRole)}>
                <SelectTrigger className={`w-[150px] h-8 text-xs ${isImpersonating ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/20' : ''}`}>
                  <Eye className="h-3 w-3 mr-1" />
                  <SelectValue placeholder="Preview as" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real">Real roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Badge variant="outline" className={`text-xs ${isImpersonating ? 'border-amber-500 text-amber-700' : ''}`}>
              <Shield className="h-3 w-3 mr-1" />
              {effectiveRoleLabel}
            </Badge>
            <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>
      {rolesError && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-2 flex items-center gap-2 justify-center">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm text-destructive">{rolesError}</span>
          <Button variant="ghost" size="sm" onClick={refreshRoles} className="text-destructive underline text-xs">
            Retry
          </Button>
        </div>
      )}
      <main>{children}</main>
    </div>
  );
};
