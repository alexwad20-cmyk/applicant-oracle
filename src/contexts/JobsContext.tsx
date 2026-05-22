import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { DbJob, DbCandidate, DbCandidateEvent, CandidateStage } from '@/types/database';

interface JobsContextType {
  jobs: DbJob[];
  candidates: DbCandidate[];
  events: DbCandidateEvent[];
  loading: boolean;
  refreshJobs: () => Promise<void>;
  refreshCandidates: () => Promise<void>;
  refreshEvents: (candidateId: string) => Promise<void>;
  addJob: (job: Partial<DbJob>) => Promise<DbJob | null>;
  updateJob: (id: string, updates: Partial<DbJob>) => Promise<void>;
  addCandidate: (candidate: Partial<DbCandidate>) => Promise<DbCandidate | null>;
  updateCandidate: (id: string, updates: Partial<DbCandidate>) => Promise<void>;
  deleteCandidate: (id: string) => Promise<void>;
  addEvent: (event: Omit<DbCandidateEvent, 'id' | 'created_at'>) => Promise<void>;
  updateCandidateStage: (id: string, newStage: CandidateStage, notes?: string, reasonCode?: string) => Promise<void>;
  getCandidate: (id: string) => DbCandidate | undefined;
  getJob: (id: string) => DbJob | undefined;
  getCandidatesForJob: (jobId: string) => DbCandidate[];
  getEventsForCandidate: (candidateId: string) => DbCandidateEvent[];
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

export const JobsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<DbJob[]>([]);
  const [candidates, setCandidates] = useState<DbCandidate[]>([]);
  const [events, setEvents] = useState<DbCandidateEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshJobs = useCallback(async () => {
    const { data } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (data) setJobs(data as any);
  }, []);

  const refreshCandidates = useCallback(async () => {
    const { data } = await supabase.from('candidates').select('*').order('created_at', { ascending: false });
    if (data) setCandidates(data as any);
  }, []);

  const refreshEvents = useCallback(async (candidateId: string) => {
    const { data } = await supabase
      .from('candidate_events')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });
    if (data) {
      setEvents(prev => {
        const filtered = prev.filter(e => e.candidate_id !== candidateId);
        return [...filtered, ...(data as any)];
      });
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setJobs([]);
      setCandidates([]);
      setEvents([]);
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      await Promise.all([refreshJobs(), refreshCandidates()]);
      setLoading(false);
    };
    load();
  }, [user, refreshJobs, refreshCandidates]);

  const addJob = async (job: Partial<DbJob>) => {
    const { data, error } = await supabase.from('jobs').insert(job as any).select().single();
    if (error) { console.error(error); return null; }
    await refreshJobs();
    return data as any;
  };

  const updateJob = async (id: string, updates: Partial<DbJob>) => {
    await supabase.from('jobs').update(updates as any).eq('id', id);
    await refreshJobs();
  };

  const addCandidate = async (candidate: Partial<DbCandidate>) => {
    const { data, error } = await supabase.from('candidates').insert({
      ...candidate,
      created_by: user?.id,
    } as any).select().single();
    if (error) { console.error(error); return null; }
    // Log event
    if (data) {
      await supabase.from('candidate_events').insert({
        candidate_id: (data as any).id,
        actor_user_id: user?.id,
        action_type: 'created',
        to_stage: 'new_applicant',
      } as any);
    }
    await refreshCandidates();
    return data as any;
  };

  const updateCandidate = async (id: string, updates: Partial<DbCandidate>) => {
    await supabase.from('candidates').update(updates as any).eq('id', id);
    await refreshCandidates();
  };

  const deleteCandidate = async (id: string) => {
    await supabase.from('candidates').delete().eq('id', id);
    await refreshCandidates();
  };

  const updateCandidateStage = async (
    id: string,
    newStage: CandidateStage,
    notes?: string,
    reasonCode?: string
  ) => {
    const candidate = candidates.find(c => c.id === id);
    const fromStage = candidate?.stage;

    // HM transitions go through the server-side RPC which enforces whitelisted
    // transitions and required rejection reasons. HR/Admin can still call it.
    const hmTargets: CandidateStage[] = ['hm_approved', 'hm_shortlisted', 'hm_rejected'];
    if (fromStage === 'hm_review' && hmTargets.includes(newStage)) {
      const { error } = await supabase.rpc('hm_update_stage', {
        _candidate_id: id,
        _new_stage: newStage,
        _reason_code: (reasonCode as never) || null,
        _notes: notes || null,
      });
      if (error) { console.error(error); throw error; }
    } else {
      // Other transitions (HR/Admin only by RLS) — direct update.
      const businessDayDue = (() => {
        const d = new Date();
        let added = 0;
        while (added < 3) {
          d.setDate(d.getDate() + 1);
          const dow = d.getDay();
          if (dow !== 0 && dow !== 6) added++;
        }
        return d.toISOString();
      })();
      await supabase.from('candidates').update({
        stage: newStage,
        stage_updated_at: new Date().toISOString(),
        ...(newStage === 'hm_review' ? { hm_review_due_at: businessDayDue } : {}),
      }).eq('id', id);
      await supabase.from('candidate_events').insert({
        candidate_id: id, actor_user_id: user?.id, action_type: 'stage_change',
        from_stage: fromStage, to_stage: newStage,
        reason_code: reasonCode || null, notes: notes || null,
      });
    }

    await refreshCandidates();

    if (fromStage === 'hm_review' && (newStage === 'hm_approved' || newStage === 'hm_rejected')) {
      try {
        await supabase.functions.invoke('notify-admin-review-complete', {
          body: {
            candidate_id: id,
            decision: newStage === 'hm_approved' ? 'approved' : 'rejected',
            reason: reasonCode || null,
            notes: notes || null,
          },
        });
      } catch (e) {
        console.warn('Failed to notify admins:', e);
      }
    }
  };

  const addEvent = async (event: Omit<DbCandidateEvent, 'id' | 'created_at'>) => {
    await supabase.from('candidate_events').insert(event as any);
  };

  const getCandidate = (id: string) => candidates.find(c => c.id === id);
  const getJob = (id: string) => jobs.find(j => j.id === id);
  const getCandidatesForJob = (jobId: string) => candidates.filter(c => c.job_id === jobId);
  const getEventsForCandidate = (candidateId: string) => events.filter(e => e.candidate_id === candidateId);

  return (
    <JobsContext.Provider value={{
      jobs, candidates, events, loading,
      refreshJobs, refreshCandidates, refreshEvents,
      addJob, updateJob,
      addCandidate, updateCandidate, deleteCandidate,
      addEvent, updateCandidateStage,
      getCandidate, getJob, getCandidatesForJob, getEventsForCandidate,
    }}>
      {children}
    </JobsContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobsContext);
  if (!context) throw new Error('useJobs must be used within JobsProvider');
  return context;
};
