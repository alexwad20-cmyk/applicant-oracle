
-- email_drafts table for storing per-candidate email overrides
CREATE TABLE public.email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  hiring_manager_user_id uuid,
  subject_override text,
  html_override text,
  text_override text,
  created_by uuid NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR/Admin full access email_drafts"
  ON public.email_drafts FOR ALL
  USING (is_hr_or_admin(auth.uid()))
  WITH CHECK (is_hr_or_admin(auth.uid()));

-- Add new template keys to email_templates
INSERT INTO public.email_templates (key, name, subject_template, html_template, is_active) VALUES
(
  'hm_review_request_single',
  'HM Review Request (Single)',
  'Review Required: {{candidate_name}} for {{job_title}}',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#0a7e8c;">Candidate Review Required</h2><p>Hi {{hm_name}},</p><p>Please review the following candidate for <strong>{{job_title}}</strong> ({{department}}).</p><div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;"><h3 style="margin:0 0 12px 0;">Candidate Details</h3><table style="width:100%;border-collapse:collapse;font-size:14px;"><tr><td style="padding:4px 8px;font-weight:bold;">Name</td><td style="padding:4px 8px;">{{candidate_name}}</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Email</td><td style="padding:4px 8px;">{{candidate_email}}</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Phone</td><td style="padding:4px 8px;">{{candidate_phone}}</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Source</td><td style="padding:4px 8px;">{{source}}{{agency_name}}</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Visa Required</td><td style="padding:4px 8px;">{{visa_required}}</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Applied</td><td style="padding:4px 8px;">{{applied_date}}</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">CV</td><td style="padding:4px 8px;"><a href="{{cv_url}}">Download CV</a></td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Full Profile</td><td style="padding:4px 8px;"><a href="{{candidate_link}}">View in App</a></td></tr></table></div><div style="text-align:center;margin:24px 0;"><a href="{{yes_url}}" style="display:inline-block;padding:12px 32px;background:#16a34a;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">YES</a><a href="{{no_url}}" style="display:inline-block;padding:12px 32px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">NO</a></div><p style="font-size:12px;color:#888;">Click YES to approve or NO to decline this candidate. These links expire in 7 days.</p></div>',
  true
),
(
  'hm_review_request_bulk',
  'HM Review Request (Bulk)',
  'Review Required: {{candidate_count}} candidates for your review',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#0a7e8c;">Candidates Awaiting Your Review</h2><p>Hi {{hm_name}},</p><p>The following candidates have been assigned to you for review. Please review each candidate and click YES or NO.</p>{{candidate_list_html}}<p style="font-size:12px;color:#888;">Action links expire in 7 days.</p></div>',
  true
),
(
  'hm_review_reminder_bulk',
  'HM Review Reminder (Bulk)',
  'Reminder: {{candidate_count}} candidates still need your review',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#0a7e8c;">Review Reminder</h2><p>Hi {{hm_name}},</p><p>The following candidates are still awaiting your review. Please take action at your earliest convenience.</p>{{candidate_list_html}}<p style="font-size:12px;color:#888;">Action links expire in 7 days.</p></div>',
  true
),
(
  'admin_hr_review_notification',
  'Admin/HR Review Notification',
  '{{candidate_name}} — {{outcome}} by Hiring Manager',
  '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;"><h2 style="color:#0a7e8c;">Hiring Manager Decision</h2><p>A hiring manager has made a decision on a candidate:</p><div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0;"><table style="width:100%;border-collapse:collapse;font-size:14px;"><tr><td style="padding:4px 8px;font-weight:bold;">Candidate</td><td style="padding:4px 8px;">{{candidate_name}}</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Job</td><td style="padding:4px 8px;">{{job_title}} ({{department}})</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Decision</td><td style="padding:4px 8px;font-weight:bold;color:{{outcome_color}};">{{outcome}}</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Reason</td><td style="padding:4px 8px;">{{reason}}</td></tr><tr><td style="padding:4px 8px;font-weight:bold;">Notes</td><td style="padding:4px 8px;">{{notes}}</td></tr></table></div><p><a href="{{candidate_link}}">View candidate in app</a></p></div>',
  true
)
ON CONFLICT (key) DO NOTHING;

-- Create unique index on email_templates key for the ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS email_templates_key_unique ON public.email_templates (key);
