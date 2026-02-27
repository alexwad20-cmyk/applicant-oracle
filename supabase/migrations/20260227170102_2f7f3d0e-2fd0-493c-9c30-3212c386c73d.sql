
-- ============================================
-- Fix ALL RLS policies: drop RESTRICTIVE, recreate as PERMISSIVE
-- ============================================

-- === user_roles ===
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- === profiles ===
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "HR/Admin can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "HR/Admin can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));

-- === jobs ===
DROP POLICY IF EXISTS "HR/Admin can do everything on jobs" ON public.jobs;
DROP POLICY IF EXISTS "HM can view their own jobs" ON public.jobs;

CREATE POLICY "HR/Admin full access jobs"
  ON public.jobs FOR ALL TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view their own jobs"
  ON public.jobs FOR SELECT TO authenticated
  USING (hiring_manager_user_id = auth.uid());

-- === candidates ===
DROP POLICY IF EXISTS "HR/Admin full access to candidates" ON public.candidates;
DROP POLICY IF EXISTS "HM can view candidates for their jobs" ON public.candidates;
DROP POLICY IF EXISTS "HM can update candidates for their jobs" ON public.candidates;

CREATE POLICY "HR/Admin full access candidates"
  ON public.candidates FOR ALL TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view candidates for their jobs"
  ON public.candidates FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM jobs WHERE jobs.id = candidates.job_id AND jobs.hiring_manager_user_id = auth.uid()
  ));

CREATE POLICY "HM can update candidates for their jobs"
  ON public.candidates FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM jobs WHERE jobs.id = candidates.job_id AND jobs.hiring_manager_user_id = auth.uid()
  ));

-- === candidate_events ===
DROP POLICY IF EXISTS "HR/Admin full access to events" ON public.candidate_events;
DROP POLICY IF EXISTS "HM can view events for their candidates" ON public.candidate_events;
DROP POLICY IF EXISTS "HM can insert events for their candidates" ON public.candidate_events;

CREATE POLICY "HR/Admin full access events"
  ON public.candidate_events FOR ALL TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view events for their candidates"
  ON public.candidate_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM candidates c JOIN jobs j ON j.id = c.job_id
    WHERE c.id = candidate_events.candidate_id AND j.hiring_manager_user_id = auth.uid()
  ));

CREATE POLICY "HM can insert events for their candidates"
  ON public.candidate_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM candidates c JOIN jobs j ON j.id = c.job_id
    WHERE c.id = candidate_events.candidate_id AND j.hiring_manager_user_id = auth.uid()
  ));

-- === review_tokens ===
DROP POLICY IF EXISTS "HR/Admin full access to tokens" ON public.review_tokens;

CREATE POLICY "HR/Admin full access tokens"
  ON public.review_tokens FOR ALL TO authenticated
  USING (public.is_hr_or_admin(auth.uid()));
