

# Full Feature Plan: Pipeline DnD, Filters, Bulk Actions, Invite-Only, Reminders, Reviewers, Email Templates

## Current State Summary

The app is a hiring pipeline tracker with Supabase Auth, Postgres, and Storage. It has jobs, candidates, candidate_events, profiles, user_roles, and review_tokens tables. RLS policies exist but are all marked as **RESTRICTIVE** (which may still cause issues -- we will fix these as part of Phase A). The `app_role` enum has `admin`, `hr`, `hiring_manager`. There are no Edge Functions, no drag-and-drop, no department filters, no bulk actions, and signup is publicly available.

---

## Phase A: Department Filters + RLS Fix

### Database
- Fix all RLS policies to be **PERMISSIVE** (drop restrictive, recreate as permissive) across `user_roles`, `profiles`, `jobs`, `candidates`, `candidate_events`, `review_tokens`
- Add index on `jobs(department)`, `candidates(job_id)`, `candidates(stage)` for filter performance
- Add `last_reminder_sent_at` (timestamp nullable) and `reminder_count` (int default 0) columns to `candidates` table (needed later but cheap to add now)

### Frontend
- Add a global department filter dropdown to `AppLayout` (stored in URL params or React state)
- Pass department filter into `JobPipeline`, `Dashboard`, and `ApplicantList`
- Filter jobs by `job.department`, candidates inherit department via `job_id` join
- Add department column to `ApplicantList` table
- Add department badge to job cards

---

## Phase B: Drag-and-Drop Kanban Pipeline

### Dependencies
- Install `@dnd-kit/core` and `@dnd-kit/sortable`

### Frontend
- Refactor `JobPipeline` to use dnd-kit `DndContext` with droppable stage columns and draggable candidate cards
- On drop:
  - Validate permissions: HR/Admin can move freely; HM can only move `hm_review` candidates on their jobs to `hm_approved`/`hm_rejected`
  - If dropping to `hm_rejected`: open a rejection reason modal (reuse the existing `REJECTION_REASON_LABELS` select pattern from `ApplicantDetail`)
  - Optimistically update UI, call `updateCandidateStage()`, revert on error
  - Show toast on success/failure
- Candidate cards remain clickable for detail view

---

## Phase C: Multi-Select + Bulk Actions

### Frontend
- Add selection checkboxes to candidate cards in Pipeline and ApplicantList
- Create a `BulkActionsBar` component (sticky bottom bar) shown when selection count > 0, displaying:
  - "Send to HM Review" (for `new_applicant` candidates)
  - "Nudge Hiring Manager" (for `hm_review` candidates)
  - Selection count + "Clear" button
- Bulk "Send to HM Review":
  - Process each candidate sequentially with a progress indicator
  - Update `stage` to `hm_review`, set `hm_review_due_at`, log `candidate_events`
  - Show summary toast (X succeeded, Y failed)
- Bulk "Nudge" is a placeholder until Edge Functions are built in Phase E

---

## Phase D: Invite-Only + Allowlist + GDPR Controls

### Database
- Alter `app_role` enum to add `'reviewer'` value
- Create `allowed_users` table:
  - `id` uuid PK
  - `email` text unique (lowercased via trigger)
  - `role_to_assign` app_role
  - `invited_by` uuid (references auth.users)
  - `notes` text nullable
  - `used_at` timestamp nullable
  - `created_at` timestamp default now()
- RLS: only admin/hr can SELECT/INSERT/UPDATE/DELETE on `allowed_users`
- Create a database function `check_user_allowed(email text)` (SECURITY DEFINER) that returns boolean

### Frontend -- Auth page changes
- Remove public signup toggle from Auth page
- After sign-in, check `allowed_users` for the user's email. If not found, show "Access not approved" screen and sign the user out
- On first approved sign-in (when `used_at` is null), auto-assign roles from `allowed_users.role_to_assign` and set `used_at`

### Frontend -- Admin "Invite User" UI
- New page/dialog accessible from nav (Admin/HR only): `Settings > Invite Users`
- Form: email + role dropdown (admin, hr, hiring_manager, reviewer)
- Inserts into `allowed_users`
- Optionally sends invite email (Phase E Edge Function) or shows instructions

### GDPR Controls
- Add "Delete Candidate" and "Anonymise Candidate" buttons on candidate detail (HR/Admin only)
- Delete: hard delete candidate + delete CV from storage + delete events
- Anonymise: replace `full_name`, `email`, `phone` with "[Anonymised]", delete CV, keep stage/events for stats
- Create `data_retention_settings` table (single-row config: `retention_days` int default 365)
- Admin-only "Run Retention Cleanup" button (manual trigger calling an Edge Function in Phase E)

---

## Phase E: Reminders + Admin Notifications (Edge Functions)

### Edge Function: `send-review-reminders`
- Query candidates in `hm_review` where overdue or last reminder > 24h ago, `reminder_count < 5`
- For each, send email to HM (via Resend or log for now)
- Update `last_reminder_sent_at`, increment `reminder_count`
- Log `candidate_events` with action `reminder_sent`
- Config in `supabase/config.toml`: `verify_jwt = false` (validate in code)
- Manual trigger: Admin "Run Reminders Now" button on Dashboard calls the function

### Edge Function: `notify-admin-review-complete`
- Triggered when candidate stage changes from `hm_review` to `hm_approved`/`hm_rejected`
- Called from `updateCandidateStage` in `JobsContext` after successful update
- Sends email to all admin/hr users with candidate name, decision, reason, and link
- Logs `candidate_events` with action `admin_notified`

### Frontend
- Add "Run Reminders Now" button on Dashboard (Admin only)
- Show `reminder_count` badge on overdue candidate cards
- Wire `updateCandidateStage` to call `notify-admin-review-complete` Edge Function on HM decisions

---

## Phase F: Reviewer Role + Comments + Share Flow

### Database
- Create `candidate_comments` table:
  - `id` uuid PK
  - `candidate_id` uuid FK
  - `author_user_id` uuid nullable
  - `author_email` text nullable
  - `body` text
  - `visibility` text default `'internal_only'`
  - `source` text default `'app'` (values: `app`, `email`)
  - `created_at` timestamp default now()
- Create `candidate_reviewer_access` table:
  - `id` uuid PK
  - `candidate_id` uuid FK
  - `reviewer_user_id` uuid FK
  - `granted_by` uuid
  - `created_at` timestamp default now()
  - Unique on `(candidate_id, reviewer_user_id)`
- RLS for `candidate_comments`:
  - HR/Admin: full access
  - HM: can read/insert for candidates on their jobs
  - Reviewer: can read/insert only for candidates in `candidate_reviewer_access`
- RLS for `candidate_reviewer_access`:
  - HR/Admin: full access
  - Reviewer: can SELECT own rows
- Update `candidates` RLS: add permissive policy for reviewers who have access via `candidate_reviewer_access`
- Update `jobs` RLS: add permissive SELECT for reviewers who have candidate access on that job

### Frontend
- Add "Comments" panel to `ApplicantDetail` page (timeline style, below Activity Log)
- Comment input box for authorized users
- "Share with Reviewer" button on candidate detail (HR/Admin only):
  - Dialog to select a user with `reviewer` role
  - Inserts into `candidate_reviewer_access`
- Reviewer dashboard: shows only shared candidates, with comment-only actions (no stage change buttons)

---

## Phase G: Email-to-Comment (Fallback Link)

### Edge Function: `add-comment-via-token`
- Generate a time-limited token when sharing with a reviewer
- Email contains a "Add Comment" link pointing to a public page
- Page validates token, shows candidate summary + comment form
- Submits comment to `candidate_comments` with `source='email'` and `author_email`
- No platform account required for this flow

### Frontend
- Create a minimal public page `/review/:token` that shows candidate info + comment form
- Token validation via Edge Function

---

## Phase H: Email Templates + Preview/Edit UI

### Database
- Create `email_templates` table:
  - `id` uuid PK
  - `key` text unique (e.g., `hm_review_request`, `hm_review_reminder`, `admin_review_notification`, `reviewer_share`)
  - `name` text
  - `subject_template` text
  - `html_template` text
  - `text_template` text nullable
  - `is_active` boolean default true
  - `updated_by` uuid nullable
  - `updated_at` timestamp default now()
  - `created_at` timestamp default now()
- Seed default templates with placeholders (`{{candidate_name}}`, `{{job_title}}`, etc.)
- RLS: only admin/hr can read/write
- Optional: `email_template_events` audit table

### Frontend
- New page: `Settings > Email Templates` (Admin/HR only)
- List templates with "Edit" and "Preview" buttons
- Editor: subject + HTML body textarea
- Preview modal: select a sample candidate/job, render with real data, show desktop + plain text views, flag unresolved placeholders
- "Preview Email" button on candidate card and in bulk action modal (HR/Admin)

### Edge Functions
- Update all email-sending functions to load template by key from DB, fill placeholders server-side, then send

---

## Technical Notes

- All new tables get RLS enabled with **PERMISSIVE** policies
- The `has_role` and `is_hr_or_admin` SECURITY DEFINER functions are used in RLS to avoid recursion
- A new `is_reviewer_for_candidate(_user_id uuid, _candidate_id uuid)` SECURITY DEFINER function will be created for reviewer RLS
- dnd-kit is preferred over react-beautiful-dnd (maintained, accessible, lightweight)
- Edge Functions use `verify_jwt = false` in config.toml with in-code JWT validation via `getClaims()`
- Email sending initially logs to console; wired to Resend when API key is configured
- All phases are independent and can be shipped incrementally

