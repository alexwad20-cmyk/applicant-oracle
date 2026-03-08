
-- Table: candidate_email_shares
CREATE TABLE public.candidate_email_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_viewed_at timestamptz,
  revoked_at timestamptz,
  message text
);

-- Indexes
CREATE INDEX idx_candidate_email_shares_candidate ON public.candidate_email_shares(candidate_id);
CREATE INDEX idx_candidate_email_shares_email ON public.candidate_email_shares(recipient_email);

-- Enable RLS
ALTER TABLE public.candidate_email_shares ENABLE ROW LEVEL SECURITY;

-- HR/Admin full access (PERMISSIVE)
CREATE POLICY "HR/Admin full access email_shares"
  ON public.candidate_email_shares
  FOR ALL
  TO authenticated
  USING (is_hr_or_admin(auth.uid()))
  WITH CHECK (is_hr_or_admin(auth.uid()));

-- HM can INSERT shares for candidates they can access
CREATE POLICY "HM can insert shares for their candidates"
  ON public.candidate_email_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (is_hm_for_candidate(auth.uid(), candidate_id));

-- HM can SELECT shares they created
CREATE POLICY "HM can view shares for their candidates"
  ON public.candidate_email_shares
  FOR SELECT
  TO authenticated
  USING (is_hm_for_candidate(auth.uid(), candidate_id));

-- HM can UPDATE (revoke) shares for their candidates
CREATE POLICY "HM can update shares for their candidates"
  ON public.candidate_email_shares
  FOR UPDATE
  TO authenticated
  USING (is_hm_for_candidate(auth.uid(), candidate_id));
