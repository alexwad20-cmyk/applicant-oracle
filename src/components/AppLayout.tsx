import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useDepartmentFilter } from '@/contexts/DepartmentFilterContext';
import { LayoutDashboard, Briefcase, Users, Plus, LogOut, Shield, Bug, AlertTriangle, Building2, UserPlus, Mail, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, roles, isHrOrAdmin, rolesError, refreshRoles, signOut } = useAuth();
  const { department, setDepartment, departments } = useDepartmentFilter();
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { to: '/pipeline', label: 'Pipeline', icon: Briefcase, show: true },
    { to: '/applicants', label: 'All Candidates', icon: Users, show: isHrOrAdmin },
    { to: '/add-candidate', label: 'Add Candidate', icon: Plus, show: isHrOrAdmin },
    { to: '/settings/invite', label: 'Invite Users', icon: UserPlus, show: isHrOrAdmin },
    { to: '/settings/email-templates', label: 'Email Templates', icon: Mail, show: isHrOrAdmin },
    { to: '/debug', label: 'Debug', icon: Bug, show: true },
  ];

  const roleLabel = roles.includes('admin') ? 'Admin' : roles.includes('hr') ? 'HR' : roles.includes('hiring_manager') ? 'Hiring Manager' : 'No Role';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
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
            <Badge variant="outline" className="text-xs">
              <Shield className="h-3 w-3 mr-1" />
              {roleLabel}
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
