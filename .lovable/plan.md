

# Fix: "Create Job" button not visible

## Problem
The "Create Job" button (and "Pipeline" and "Add Candidate" buttons) are hidden because the current user has no roles assigned. The dashboard shows "My Reviews" instead of "HR Dashboard", confirming `isHrOrAdmin` is `false`.

**Root cause:** The auto-assign trigger (`auto_assign_first_admin`) was created *after* the user had already signed up, so their roles were never inserted into the `user_roles` table.

## Solution

### 1. Database fix: Assign roles to existing user
Run a migration to insert `admin` and `hr` roles for the existing user (id: `212df8aa-ab94-43da-aeea-78712367b0e6`) into the `user_roles` table.

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES 
  ('212df8aa-ab94-43da-aeea-78712367b0e6', 'admin'),
  ('212df8aa-ab94-43da-aeea-78712367b0e6', 'hr')
ON CONFLICT DO NOTHING;
```

### 2. No code changes needed
The `CreateJobDialog` component and its integration into Dashboard and Pipeline are already correctly implemented. Once the roles are assigned, `isHrOrAdmin` will be `true` and all HR/Admin buttons (Pipeline, Add Candidate, Create Job) will appear.

## Technical details
- The `AuthContext` fetches roles from `user_roles` table via `fetchRoles()` on login
- The `isHrOrAdmin` flag gates UI visibility in Dashboard and Pipeline
- The auto-assign trigger will work for future first-time signups; this is a one-time fix for the existing user
