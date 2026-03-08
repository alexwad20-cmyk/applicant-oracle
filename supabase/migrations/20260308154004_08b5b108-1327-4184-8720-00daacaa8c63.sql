
-- Helper functions to break circular RLS references

CREATE OR REPLACE FUNCTION public.is_hm_for_job(_user_id uuid, _job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = _job_id AND hiring_manager_user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_hm_for_candidate(_user_id uuid, _candidate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.jobs j ON j.id = c.job_id
    WHERE c.id = _candidate_id AND j.hiring_manager_user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.reviewer_can_view_job(_user_id uuid, _job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidate_reviewer_access cra
    JOIN public.candidates c ON c.id = cra.candidate_id
    WHERE c.job_id = _job_id AND cra.reviewer_user_id = _user_id
  )
$$;

-- Drop and recreate jobs policies
DROP POLICY IF EXISTS "HR/Admin full access jobs" ON public.jobs;
DROP POLICY IF EXISTS "HM can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Reviewer can view jobs of shared candidates" ON public.jobs;

CREATE POLICY "HR/Admin full access jobs" ON public.jobs FOR ALL TO authenticated
  USING (is_hr_or_admin(auth.uid()))
  WITH CHECK (is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view their own jobs" ON public.jobs FOR SELECT TO authenticated
  USING (hiring_manager_user_id = auth.uid());

CREATE POLICY "Reviewer can view jobs of shared candidates" ON public.jobs FOR SELECT TO authenticated
  USING (reviewer_can_view_job(auth.uid(), id));

-- Drop and recreate candidates policies
DROP POLICY IF EXISTS "HR/Admin full access candidates" ON public.candidates;
DROP POLICY IF EXISTS "HM can view candidates for their jobs" ON public.candidates;
DROP POLICY IF EXISTS "HM can update candidates for their jobs" ON public.candidates;
DROP POLICY IF EXISTS "Reviewer can view shared candidates" ON public.candidates;

CREATE POLICY "HR/Admin full access candidates" ON public.candidates FOR ALL TO authenticated
  USING (is_hr_or_admin(auth.uid()))
  WITH CHECK (is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view candidates for their jobs" ON public.candidates FOR SELECT TO authenticated
  USING (is_hm_for_job(auth.uid(), job_id));

CREATE POLICY "HM can update candidates for their jobs" ON public.candidates FOR UPDATE TO authenticated
  USING (is_hm_for_job(auth.uid(), job_id));

CREATE POLICY "Reviewer can view shared candidates" ON public.candidates FOR SELECT TO authenticated
  USING (is_reviewer_for_candidate(auth.uid(), id));

-- Fix candidate_events policies too
DROP POLICY IF EXISTS "HR/Admin full access events" ON public.candidate_events;
DROP POLICY IF EXISTS "HM can view events for their candidates" ON public.candidate_events;
DROP POLICY IF EXISTS "HM can insert events for their candidates" ON public.candidate_events;

CREATE POLICY "HR/Admin full access events" ON public.candidate_events FOR ALL TO authenticated
  USING (is_hr_or_admin(auth.uid()))
  WITH CHECK (is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view events for their candidates" ON public.candidate_events FOR SELECT TO authenticated
  USING (is_hm_for_candidate(auth.uid(), candidate_id));

CREATE POLICY "HM can insert events for their candidates" ON public.candidate_events FOR INSERT TO authenticated
  WITH CHECK (is_hm_for_candidate(auth.uid(), candidate_id));

-- Fix candidate_comments policies too
DROP POLICY IF EXISTS "HR/Admin full access comments" ON public.candidate_comments;
DROP POLICY IF EXISTS "HM can view/insert comments for their candidates" ON public.candidate_comments;
DROP POLICY IF EXISTS "HM can insert comments for their candidates" ON public.candidate_comments;
DROP POLICY IF EXISTS "Reviewer can view comments for shared candidates" ON public.candidate_comments;
DROP POLICY IF EXISTS "Reviewer can insert comments for shared candidates" ON public.candidate_comments;

CREATE POLICY "HR/Admin full access comments" ON public.candidate_comments FOR ALL TO authenticated
  USING (is_hr_or_admin(auth.uid()))
  WITH CHECK (is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view comments for their candidates" ON public.candidate_comments FOR SELECT TO authenticated
  USING (is_hm_for_candidate(auth.uid(), candidate_id));

CREATE POLICY "HM can insert comments for their candidates" ON public.candidate_comments FOR INSERT TO authenticated
  WITH CHECK (is_hm_for_candidate(auth.uid(), candidate_id));

CREATE POLICY "Reviewer can view comments for shared candidates" ON public.candidate_comments FOR SELECT TO authenticated
  USING (is_reviewer_for_candidate(auth.uid(), candidate_id));

CREATE POLICY "Reviewer can insert comments for shared candidates" ON public.candidate_comments FOR INSERT TO authenticated
  WITH CHECK (is_reviewer_for_candidate(auth.uid(), candidate_id));
