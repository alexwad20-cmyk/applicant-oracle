import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';
import { AppLayout } from './AppLayout';
import { RefreshCw, Bug, CheckCircle, XCircle } from 'lucide-react';

export const DebugPanel = () => {
  const {
    userId, email, roles, loading, error, lastFetchedAt,
    isAdmin, isHR, isHM, canManageJobs, canManageCandidates,
    refreshRoles, refreshSession,
  } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshRoles = async () => {
    setRefreshing(true);
    await refreshRoles();
    setRefreshing(false);
  };

  const handleRefreshSession = async () => {
    setRefreshing(true);
    await refreshSession();
    setRefreshing(false);
  };

  const Flag = ({ label, value }: { label: string; value: boolean }) => (
    <div className="flex items-center gap-2">
      {value ? <CheckCircle className="h-4 w-4 text-primary" /> : <XCircle className="h-4 w-4 text-destructive" />}
      <span className="text-sm">{label}</span>
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <Bug className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Auth & Roles Debug</h1>
        </div>

        {error && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-4">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Auth User</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><span className="text-muted-foreground">User ID:</span> <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{userId || 'Not signed in'}</code></div>
            <div><span className="text-muted-foreground">Email:</span> {email || 'N/A'}</div>
            <div><span className="text-muted-foreground">Loading:</span> {loading ? 'Yes' : 'No'}</div>
            <div><span className="text-muted-foreground">Last fetched:</span> {lastFetchedAt?.toLocaleTimeString() || 'Never'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Roles from DB</CardTitle></CardHeader>
          <CardContent>
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles found — check RLS policies and user_roles table.</p>
            ) : (
              <div className="flex gap-2">
                {roles.map(r => <Badge key={r} variant="secondary">{r}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Computed Flags</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Flag label="isAdmin" value={isAdmin} />
            <Flag label="isHR" value={isHR} />
            <Flag label="isHM (Hiring Manager)" value={isHM} />
            <Flag label="canManageJobs" value={canManageJobs} />
            <Flag label="canManageCandidates" value={canManageCandidates} />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={handleRefreshRoles} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Roles
          </Button>
          <Button onClick={handleRefreshSession} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Session
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};
