import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/types/database';

interface PermissionsState {
  roles: AppRole[];
  loading: boolean;
  error: string | null;
  lastFetchedAt: Date | null;
  userId: string | null;
  email: string | null;
}

interface UsePermissionsReturn extends PermissionsState {
  isAdmin: boolean;
  isHR: boolean;
  isHM: boolean;
  canManageJobs: boolean;
  canManageCandidates: boolean;
  refreshRoles: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const usePermissions = (): UsePermissionsReturn => {
  const [state, setState] = useState<PermissionsState>({
    roles: [],
    loading: true,
    error: null,
    lastFetchedAt: null,
    userId: null,
    email: null,
  });

  const fetchRoles = useCallback(async (userId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch roles:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: `Role fetch failed: ${error.message}`,
        lastFetchedAt: new Date(),
      }));
      return;
    }

    const roles = (data || []).map((r: any) => r.role as AppRole);
    setState(prev => ({
      ...prev,
      roles,
      loading: false,
      error: null,
      lastFetchedAt: new Date(),
    }));
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;
        setState(prev => ({ ...prev, userId: user?.id ?? null, email: user?.email ?? null }));
        if (user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
          await fetchRoles(user.id);
        } else if (!user) {
          setState(prev => ({ ...prev, roles: [], loading: false, error: null }));
        }
      }
    );

    // Initial fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setState(prev => ({ ...prev, userId: user?.id ?? null, email: user?.email ?? null }));
      if (user) {
        fetchRoles(user.id);
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles]);

  const refreshRoles = useCallback(async () => {
    if (state.userId) {
      await fetchRoles(state.userId);
    }
  }, [state.userId, fetchRoles]);

  const refreshSession = useCallback(async () => {
    await supabase.auth.refreshSession();
    if (state.userId) {
      await fetchRoles(state.userId);
    }
  }, [state.userId, fetchRoles]);

  const isAdmin = state.roles.includes('admin');
  const isHR = state.roles.includes('hr');
  const isHM = state.roles.includes('hiring_manager');

  return {
    ...state,
    isAdmin,
    isHR,
    isHM,
    canManageJobs: isAdmin || isHR,
    canManageCandidates: isAdmin || isHR,
    refreshRoles,
    refreshSession,
  };
};
