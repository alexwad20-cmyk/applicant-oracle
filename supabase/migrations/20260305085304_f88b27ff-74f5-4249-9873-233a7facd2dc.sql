
-- Phase D: Add 'reviewer' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reviewer';

-- Phase D: Create allowed_users table
CREATE TABLE public.allowed_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role_to_assign public.app_role NOT NULL DEFAULT 'hiring_manager',
  invited_by uuid,
  notes text,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT allowed_users_email_unique UNIQUE (email)
);

ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/Admin full access allowed_users" ON public.allowed_users
  FOR ALL TO authenticated
  USING (public.is_hr_or_admin(auth.uid()))
  WITH CHECK (public.is_hr_or_admin(auth.uid()));

-- Phase D: Create data_retention_settings table (single row config)
CREATE TABLE public.data_retention_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retention_days integer NOT NULL DEFAULT 365,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_retention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/Admin full access retention settings" ON public.data_retention_settings
  FOR ALL TO authenticated
  USING (public.is_hr_or_admin(auth.uid()))
  WITH CHECK (public.is_hr_or_admin(auth.uid()));

-- Seed default retention settings
INSERT INTO public.data_retention_settings (retention_days) VALUES (365);

-- Phase D: Function to check if user email is in allowlist
CREATE OR REPLACE FUNCTION public.check_user_allowed(check_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.allowed_users WHERE lower(email) = lower(check_email)
  )
$$;

-- Phase F: Create candidate_comments table
CREATE TABLE public.candidate_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  author_user_id uuid,
  author_email text,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal_only',
  source text NOT NULL DEFAULT 'app',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_comments ENABLE ROW LEVEL SECURITY;

-- Phase F: Create candidate_reviewer_access table
CREATE TABLE public.candidate_reviewer_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL,
  granted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, reviewer_user_id)
);

ALTER TABLE public.candidate_reviewer_access ENABLE ROW LEVEL SECURITY;

-- Phase F: Security definer function for reviewer access check
CREATE OR REPLACE FUNCTION public.is_reviewer_for_candidate(_user_id uuid, _candidate_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.candidate_reviewer_access
    WHERE reviewer_user_id = _user_id AND candidate_id = _candidate_id
  )
$$;

-- Phase F: RLS for candidate_comments
CREATE POLICY "HR/Admin full access comments" ON public.candidate_comments
  FOR ALL TO authenticated
  USING (public.is_hr_or_admin(auth.uid()))
  WITH CHECK (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "HM can view/insert comments for their candidates" ON public.candidate_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidates c JOIN jobs j ON j.id = c.job_id
      WHERE c.id = candidate_comments.candidate_id AND j.hiring_manager_user_id = auth.uid()
    )
  );

CREATE POLICY "HM can insert comments for their candidates" ON public.candidate_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM candidates c JOIN jobs j ON j.id = c.job_id
      WHERE c.id = candidate_comments.candidate_id AND j.hiring_manager_user_id = auth.uid()
    )
  );

CREATE POLICY "Reviewer can view comments for shared candidates" ON public.candidate_comments
  FOR SELECT TO authenticated
  USING (public.is_reviewer_for_candidate(auth.uid(), candidate_id));

CREATE POLICY "Reviewer can insert comments for shared candidates" ON public.candidate_comments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_reviewer_for_candidate(auth.uid(), candidate_id));

-- Phase F: RLS for candidate_reviewer_access
CREATE POLICY "HR/Admin full access reviewer_access" ON public.candidate_reviewer_access
  FOR ALL TO authenticated
  USING (public.is_hr_or_admin(auth.uid()))
  WITH CHECK (public.is_hr_or_admin(auth.uid()));

CREATE POLICY "Reviewer can view own access" ON public.candidate_reviewer_access
  FOR SELECT TO authenticated
  USING (reviewer_user_id = auth.uid());

-- Phase F: Add reviewer access to candidates table
CREATE POLICY "Reviewer can view shared candidates" ON public.candidates
  FOR SELECT TO authenticated
  USING (public.is_reviewer_for_candidate(auth.uid(), id));

-- Phase F: Add reviewer access to jobs table (for shared candidates' jobs)
CREATE POLICY "Reviewer can view jobs of shared candidates" ON public.jobs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM candidate_reviewer_access cra
      JOIN candidates c ON c.id = cra.candidate_id
      WHERE c.job_id = jobs.id AND cra.reviewer_user_id = auth.uid()
    )
  );

-- Phase H: Create email_templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  subject_template text NOT NULL,
  html_template text NOT NULL,
  text_template text,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/Admin full access email_templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.is_hr_or_admin(auth.uid()))
  WITH CHECK (public.is_hr_or_admin(auth.uid()));

-- Seed default email templates
INSERT INTO public.email_templates (key, name, subject_template, html_template) VALUES
('hm_review_request', 'HM Review Request', 'Review Required: {{candidate_name}} for {{job_title}}', '<h2>Review Request</h2><p>Hi {{hiring_manager_name}},</p><p>A new candidate <strong>{{candidate_name}}</strong> has been submitted for your review for the position <strong>{{job_title}}</strong>.</p><p>Please review within 72 hours.</p><p><a href="{{review_link}}">Review Now</a></p>'),
('hm_review_reminder', 'HM Review Reminder', 'Reminder: Review {{candidate_name}} for {{job_title}}', '<h2>Review Reminder</h2><p>Hi {{hiring_manager_name}},</p><p>This is a reminder to review <strong>{{candidate_name}}</strong> for <strong>{{job_title}}</strong>.</p><p>This candidate has been awaiting review for {{days_waiting}} days.</p><p><a href="{{review_link}}">Review Now</a></p>'),
('admin_review_notification', 'Admin Review Notification', 'Review Complete: {{candidate_name}} - {{decision}}', '<h2>Review Complete</h2><p>Hiring manager has {{decision}} <strong>{{candidate_name}}</strong> for <strong>{{job_title}}</strong>.</p>{{#if reason}}<p>Reason: {{reason}}</p>{{/if}}{{#if notes}}<p>Notes: {{notes}}</p>{{/if}}'),
('reviewer_share', 'Reviewer Share Notification', 'You have been asked to review {{candidate_name}}', '<h2>Review Request</h2><p>Hi,</p><p>You have been asked to review <strong>{{candidate_name}}</strong> for the position <strong>{{job_title}}</strong>.</p><p><a href="{{comment_link}}">Add Your Comments</a></p>');

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_comments;
