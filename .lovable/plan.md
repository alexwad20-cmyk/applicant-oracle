# Production Readiness & Security Hardening Pass

This is a focused hardening pass — no new features, no UI redesign. I'll work through the issues in dependency order so each step builds on a stable base.

## 1. Edge Function lockdown (auth + role checks)

Classify every function in `supabase/functions/` into two groups and enforce accordingly.

**Public (token-only)** — `verify_jwt = false`, no role assumed, must validate a hashed token before any action:
- `review-action` (HM YES/NO click from email)
- `validate-review-token`, `add-comment-via-token` (legacy review token flow)
- `validate-share-token`, `add-comment-via-share-token` (reviewer share flow)
- `handle-email-suppression` (webhook from email provider, if present)

**Authenticated (JWT required + server-side role check)** — switch `verify_jwt = true` in `supabase/config.toml` and add `getClaims()` + `has_role`/`is_hr_or_admin`/`is_hm_for_candidate` checks:
- `create-candidate-share` (HR/Admin or HM-for-candidate)
- `send-review-emails` (HR/Admin only)
- `send-review-reminders` (HR/Admin only; cron path uses a separate service-role secret header)
- `notify-admin-review-complete` (called only from review-action token flow → keep public but require valid token context, not raw input)

For each authenticated function: use the anon-key client with the caller's Authorization header to read identity, then a separate service-role client only for the privileged writes that follow the permission check.

## 2. Remove public self-signup

- `src/pages/Auth.tsx`: remove the "Don't have an account? Sign up" toggle and the signup form entirely. Keep only sign-in.
- Call `supabase--configure_auth` with `disable_signup: true` so the API rejects signups even if someone calls it directly.
- Keep the allowlist + first-login role assignment flow as-is (admin invites → user signs in → role assigned from `allowed_users`).

## 3. Fix email sending

Right now several functions `console.log("[NOTIFY] ...")` instead of sending. Resend is referenced in knowledge but not wired. I'll:

- Set up Lovable Emails (built-in) via `email_domain` tools if no domain is configured, OR detect `RESEND_API_KEY` and use Resend if the user has it.
- Add a shared `_shared/send-email.ts` helper that actually sends or throws a clear error if no provider is configured.
- Update `send-review-emails`, `send-review-reminders`, `notify-admin-review-complete`, `create-candidate-share` to use the helper.
- UI: in `ShareWithReviewer` / share dialog, return `{ emailed: boolean, shareUrl }` from the edge function; toast says "Share link created and emailed" only when `emailed === true`, otherwise "Share link created — copy and send manually".

Because email-provider setup needs user input (domain DNS), I'll first check `email_domain--check_email_domain_status`. If no domain, I'll surface the setup dialog and meanwhile make the functions return clear "email_not_configured" errors instead of fake success.

## 4. Hash all public tokens consistently

Today: `review_tokens.token_hash` and `candidate_email_shares.token_hash` actually store the raw token (the code does `token_hash: token` with the plaintext UUID). Change to:

- Generate `token = crypto.randomUUID() + crypto.randomUUID()` (high entropy).
- Store `sha256(token)` hex in `token_hash`.
- Email/share link contains the raw token; lookup uses `sha256(input)`.
- Apply to: `review-action`, `send-review-emails`, `send-review-reminders`, `create-candidate-share`, `validate-share-token`, `add-comment-via-share-token`, `validate-review-token`, `add-comment-via-token`.
- Add a shared `_shared/tokens.ts` with `generateToken()` and `hashToken()`.

## 5. GDPR anonymise / delete — server-side

Add two SECURITY DEFINER RPCs callable only by HR/Admin:

- `anonymize_candidate(_candidate_id uuid)` — replaces name/email/phone/notes/agency with `'[redacted]'`, nulls `cv_file_path` (and deletes the storage object via an edge function wrapper), rewrites `candidate_comments.body` to `'[redacted]'` where it likely contains PII, deletes `candidate_email_shares` and `review_tokens`, keeps `candidate_events` rows but nulls free-text `notes`. Inserts a final `candidate_events` row `action_type='anonymized'`.
- `delete_candidate(_candidate_id uuid)` — hard delete cascade (candidate + comments + events + shares + tokens + storage object).

Add a small edge function `gdpr-action` (authenticated, HR/Admin only) that:
1. Verifies role
2. Deletes the CV storage object via service-role
3. Calls the appropriate RPC

Update `GdprControls.tsx` to call this function with two distinct buttons: **Anonymise**, **Delete**, plus a separate **Remove CV** button and **Expire share links** button. Clarify in UI copy that `data_retention_settings` is informational and not automated yet.

## 6. Tighten HM RLS

Current: `"HM can update candidates for their jobs" FOR UPDATE USING is_hm_for_job(...)` — allows updating any column. Replace with a tighter policy and move stage transitions to a SECURITY DEFINER RPC `hm_update_stage(_candidate_id, _new_stage, _reason)` that whitelists allowed transitions:
- `hm_review → hm_approved | hm_shortlisted | hm_rejected` only
- requires `reason_code` for rejected

Drop the broad UPDATE policy. HMs keep INSERT on `candidate_comments` and `candidate_email_shares` (already scoped). Frontend already restricts UI via `useEffectivePermissions`; this just enforces it server-side.

## 7. Restrict Debug page

`src/components/DebugPanel.tsx` → wrap route in admin-only guard in `App.tsx`. Non-admins get redirected to `/`. Use `realIsAdmin` (not effective) so impersonation can't unlock it.

## 8. Business-day SLA

Replace `hm_review_due_at = now() + 72h` with `+ 3 business days` (skip Sat/Sun). Add helper `addBusinessDays(date, n)` in:
- DB: `add_business_days(timestamptz, int) returns timestamptz` SQL function used in any trigger/insert.
- Edge functions: `_shared/business-days.ts` for `send-review-reminders` to skip weekends entirely (no reminders sent Sat/Sun) and base overdue on business-day deadline.
- Frontend: same helper for displaying countdown.

## 9. Lint / TS cleanup

Run `npm run lint`, triage, fix:
- Replace `any` with proper types or `unknown` + narrowing where reasonable
- Remove empty blocks
- Add missing hook deps or wrap callbacks in `useCallback`
- Do NOT relax `eslint.config.js` rules

Confirm `npm run build` passes (harness does this automatically).

## 10. Env hygiene

- Verify `.gitignore` contains `.env`
- Create `.env.example` with placeholder names only (no values)
- Confirm only `VITE_*` publishable values are in `.env` (they are — anon key + URL + project id, all safe for frontend)

## Technical notes

- `supabase/config.toml`: flip `verify_jwt = true` (i.e. remove the override) for `send-review-emails`, `send-review-reminders`, `notify-admin-review-complete`, `create-candidate-share`. Keep `verify_jwt = false` for token-validation functions and `review-action` (browser GET from email).
- Cron-invoked functions (`send-review-reminders`): when `verify_jwt = true`, the pg_cron job posts with the service-role key as Bearer, which `getClaims` accepts as a service role — handle that path by allowing role `service_role` to bypass user-role checks.
- Hashing uses Web Crypto `crypto.subtle.digest('SHA-256', ...)` in both Deno and the browser (we only hash in edge functions).
- DB migrations needed:
  1. `hm_update_stage` RPC + drop/replace HM update policy
  2. `anonymize_candidate`, `delete_candidate` RPCs
  3. `add_business_days` SQL function
  4. Index on `review_tokens.token_hash` and `candidate_email_shares.token_hash` (already PK-ish? add unique index)

## Out of scope

- Email provider DNS setup (requires user action — I'll surface the dialog if needed)
- UI redesign
- New features beyond what's required to fix the above

## Deliverable

A summary at the end covering: public vs authenticated functions, role enforcement, token handling, real vs simulated email sends, GDPR coverage, HM permission boundaries, and build/lint status.
