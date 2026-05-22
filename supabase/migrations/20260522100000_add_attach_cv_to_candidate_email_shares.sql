-- Track whether a public candidate share link is allowed to expose a CV.
-- Existing links default to false so CVs are not exposed unless explicitly enabled.
alter table public.candidate_email_shares
  add column if not exists attach_cv boolean not null default false;
