
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'hr', 'hiring_manager');

CREATE TYPE public.candidate_stage AS ENUM (
  'new_applicant',
  'hm_review',
  'hm_approved',
  'hm_rejected'
);

CREATE TYPE public.rejection_reason AS ENUM (
  'skills_mismatch',
  'experience_level',
  'salary_mismatch',
  'location_commute',
  'notice_period',
  'right_to_work',
  'culture_values',
  'declined_role',
  'counteroffer',
  'other'
);

CREATE TYPE public.candidate_source AS ENUM ('direct', 'agency', 'referral');

-- ============================================================
-- UTILITY: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- USER ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is HR or admin
CREATE OR REPLACE FUNCTION public.is_hr_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'hr')
  )
$$;

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  hiring_manager_user_id UUID,
  recruiter_user_id UUID,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CANDIDATES
-- ============================================================
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  source candidate_source NOT NULL DEFAULT 'direct',
  agency_name TEXT,
  visa_required BOOLEAN NOT NULL DEFAULT false,
  stage candidate_stage NOT NULL DEFAULT 'new_applicant',
  stage_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hm_review_due_at TIMESTAMPTZ,
  cv_file_path TEXT,
  notes TEXT,
  duplicate_of_candidate_id UUID REFERENCES public.candidates(id),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CANDIDATE EVENTS (audit log)
-- ============================================================
CREATE TABLE public.candidate_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  actor_user_id UUID,
  action_type TEXT NOT NULL,
  from_stage candidate_stage,
  to_stage candidate_stage,
  reason_code rejection_reason,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REVIEW TOKENS (email action tokens)
-- ============================================================
CREATE TABLE public.review_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.review_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STORAGE: CV bucket (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-cvs', 'candidate-cvs', false)
ON CONFLICT (id) DO NOTHING;

-- HR/Admin can upload CVs
CREATE POLICY "HR can upload CVs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'candidate-cvs'
  AND public.is_hr_or_admin(auth.uid())
);

-- HR/Admin can view all CVs; HM can view CVs for their jobs
CREATE POLICY "Authorized users can view CVs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'candidate-cvs'
  AND (
    public.is_hr_or_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.candidates c
      JOIN public.jobs j ON j.id = c.job_id
      WHERE c.cv_file_path = name
      AND j.hiring_manager_user_id = auth.uid()
    )
  )
);

-- HR/Admin can delete CVs
CREATE POLICY "HR can delete CVs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'candidate-cvs'
  AND public.is_hr_or_admin(auth.uid())
);

-- ============================================================
-- RLS POLICIES: profiles
-- ============================================================
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "HR/Admin can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- RLS POLICIES: user_roles
-- ============================================================
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- RLS POLICIES: jobs
-- ============================================================
CREATE POLICY "HR/Admin can do everything on jobs"
ON public.jobs FOR ALL
TO authenticated
USING (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view their own jobs"
ON public.jobs FOR SELECT
TO authenticated
USING (hiring_manager_user_id = auth.uid());

-- ============================================================
-- RLS POLICIES: candidates
-- ============================================================
CREATE POLICY "HR/Admin full access to candidates"
ON public.candidates FOR ALL
TO authenticated
USING (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view candidates for their jobs"
ON public.candidates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = candidates.job_id
    AND jobs.hiring_manager_user_id = auth.uid()
  )
);

CREATE POLICY "HM can update candidates for their jobs"
ON public.candidates FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE jobs.id = candidates.job_id
    AND jobs.hiring_manager_user_id = auth.uid()
  )
);

-- ============================================================
-- RLS POLICIES: candidate_events
-- ============================================================
CREATE POLICY "HR/Admin full access to events"
ON public.candidate_events FOR ALL
TO authenticated
USING (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view events for their candidates"
ON public.candidate_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.jobs j ON j.id = c.job_id
    WHERE c.id = candidate_events.candidate_id
    AND j.hiring_manager_user_id = auth.uid()
  )
);

CREATE POLICY "HM can insert events for their candidates"
ON public.candidate_events FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.candidates c
    JOIN public.jobs j ON j.id = c.job_id
    WHERE c.id = candidate_events.candidate_id
    AND j.hiring_manager_user_id = auth.uid()
  )
);

-- ============================================================
-- RLS POLICIES: review_tokens
-- ============================================================
CREATE POLICY "HR/Admin full access to tokens"
ON public.review_tokens FOR ALL
TO authenticated
USING (public.is_hr_or_admin(auth.uid()));

-- Tokens are also accessed by edge functions via service role, so minimal RLS needed
