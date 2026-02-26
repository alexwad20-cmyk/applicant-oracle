
# Add Job Creation UI

## What will be built
A "Create Job" dialog accessible from the Dashboard and Pipeline pages, allowing HR/Admin users to create new job positions directly from the UI instead of relying on seeded data.

## Changes

### 1. New component: `src/components/CreateJobDialog.tsx`
A dialog form with fields for:
- Title (required)
- Department
- Location
- Description (textarea)

Uses the existing `addJob` function from `JobsContext`. Only visible to HR/Admin users.

### 2. Add "Create Job" button to Dashboard
In the header actions area (next to "Pipeline" and "Add Candidate" buttons), add a "Create Job" button that opens the dialog.

### 3. Add "Create Job" button to Pipeline page
In the pipeline header area, add the same button so jobs can be created from either page.

## Technical details
- The dialog will use existing shadcn `Dialog`, `Input`, `Textarea`, and `Button` components
- Uses `addJob` from `JobsContext` which already handles the database insert and refresh
- No database changes needed -- the `jobs` table schema already supports all required fields
- Role gating: button only shown when `isHrOrAdmin` is true (matching existing pattern)
