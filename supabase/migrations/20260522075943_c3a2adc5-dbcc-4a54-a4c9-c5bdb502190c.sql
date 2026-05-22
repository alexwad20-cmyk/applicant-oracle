
-- 1. Business-day helper
CREATE OR REPLACE FUNCTION public.add_business_days(_start timestamptz, _days int)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result timestamptz := _start;
  added int := 0;
  dow int;
BEGIN
  WHILE added < _days LOOP
    result := result + interval '1 day';
    dow := EXTRACT(ISODOW FROM result); -- 1=Mon..7=Sun
    IF dow < 6 THEN
      added := added + 1;
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- 2. Tighter HM RLS: drop broad UPDATE policy on candidates
DROP POLICY IF EXISTS "HM can update candidates for their jobs" ON public.candidates;

-- 3. Stage transition RPC (HM can only move from hm_review to terminal HM states)
CREATE OR REPLACE FUNCTION public.hm_update_stage(
  _candidate_id uuid,
  _new_stage candidate_stage,
  _reason_code rejection_reason DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from_stage candidate_stage;
  _is_hm boolean;
  _is_hr boolean;
BEGIN
  -- Identity
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT public.is_hr_or_admin(auth.uid()) INTO _is_hr;
  SELECT public.is_hm_for_candidate(auth.uid(), _candidate_id) INTO _is_hm;

  IF NOT (_is_hr OR _is_hm) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT stage INTO _from_stage FROM public.candidates WHERE id = _candidate_id;
  IF _from_stage IS NULL THEN
    RAISE EXCEPTION 'Candidate not found';
  END IF;

  -- HM-only transitions are whitelisted; HR/Admin may bypass
  IF NOT _is_hr THEN
    IF _from_stage <> 'hm_review' THEN
      RAISE EXCEPTION 'HM can only act on candidates in hm_review stage';
    END IF;
    IF _new_stage NOT IN ('hm_approved','hm_shortlisted','hm_rejected') THEN
      RAISE EXCEPTION 'HM cannot move to that stage';
    END IF;
    IF _new_stage = 'hm_rejected' AND _reason_code IS NULL THEN
      RAISE EXCEPTION 'Rejection reason required';
    END IF;
  END IF;

  UPDATE public.candidates
  SET stage = _new_stage, stage_updated_at = now()
  WHERE id = _candidate_id;

  INSERT INTO public.candidate_events
    (candidate_id, actor_user_id, action_type, from_stage, to_stage, reason_code, notes)
  VALUES
    (_candidate_id, auth.uid(), 'stage_change', _from_stage, _new_stage, _reason_code, _notes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.hm_update_stage(uuid, candidate_stage, rejection_reason, text) TO authenticated;

-- 4. GDPR: anonymise candidate (HR/Admin only). Caller must remove CV storage object separately.
CREATE OR REPLACE FUNCTION public.anonymize_candidate(_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_hr_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.candidates SET
    full_name = '[redacted]',
    email = '[redacted]',
    phone = '[redacted]',
    notes = NULL,
    agency_name = NULL,
    cv_file_path = NULL
  WHERE id = _candidate_id;

  -- Strip PII from comments and events
  UPDATE public.candidate_comments
    SET body = '[redacted]', author_email = NULL
  WHERE candidate_id = _candidate_id;

  UPDATE public.candidate_events
    SET notes = NULL
  WHERE candidate_id = _candidate_id;

  -- Revoke / delete tokens and shares
  DELETE FROM public.candidate_email_shares WHERE candidate_id = _candidate_id;
  DELETE FROM public.review_tokens WHERE candidate_id = _candidate_id;

  INSERT INTO public.candidate_events (candidate_id, actor_user_id, action_type, notes)
  VALUES (_candidate_id, auth.uid(), 'anonymized', 'Candidate anonymised');
END;
$$;

GRANT EXECUTE ON FUNCTION public.anonymize_candidate(uuid) TO authenticated;

-- 5. GDPR: hard delete (HR/Admin only)
CREATE OR REPLACE FUNCTION public.delete_candidate_cascade(_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_hr_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM public.candidate_email_shares WHERE candidate_id = _candidate_id;
  DELETE FROM public.candidate_reviewer_access WHERE candidate_id = _candidate_id;
  DELETE FROM public.review_tokens WHERE candidate_id = _candidate_id;
  DELETE FROM public.candidate_comments WHERE candidate_id = _candidate_id;
  DELETE FROM public.candidate_events WHERE candidate_id = _candidate_id;
  DELETE FROM public.candidates WHERE id = _candidate_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_candidate_cascade(uuid) TO authenticated;

-- 6. Expire all public links for a candidate (HR/Admin or HM-for-candidate)
CREATE OR REPLACE FUNCTION public.expire_candidate_share_links(_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_hr_or_admin(auth.uid()) OR public.is_hm_for_candidate(auth.uid(), _candidate_id)) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  UPDATE public.candidate_email_shares
     SET revoked_at = now()
   WHERE candidate_id = _candidate_id AND revoked_at IS NULL;
  UPDATE public.review_tokens
     SET used_at = now()
   WHERE candidate_id = _candidate_id AND used_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_candidate_share_links(uuid) TO authenticated;

-- 7. Unique indexes on token hashes for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS review_tokens_token_hash_uidx ON public.review_tokens(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS candidate_email_shares_token_hash_uidx ON public.candidate_email_shares(token_hash);
