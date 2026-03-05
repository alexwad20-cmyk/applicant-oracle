// Manual DB types matching our schema (until auto-generated types update)

export type AppRole = 'admin' | 'hr' | 'hiring_manager' | 'reviewer';
export type CandidateStage = 'new_applicant' | 'hm_review' | 'hm_approved' | 'hm_rejected';
export type CandidateSource = 'direct' | 'agency' | 'referral';
export type RejectionReason =
  | 'skills_mismatch'
  | 'experience_level'
  | 'salary_mismatch'
  | 'location_commute'
  | 'notice_period'
  | 'right_to_work'
  | 'culture_values'
  | 'declined_role'
  | 'counteroffer'
  | 'other';

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  skills_mismatch: 'Skills mismatch',
  experience_level: 'Experience level',
  salary_mismatch: 'Salary mismatch',
  location_commute: 'Location/commute',
  notice_period: 'Notice period',
  right_to_work: 'Right to work',
  culture_values: 'Culture/values',
  declined_role: 'Declined role',
  counteroffer: 'Counteroffer',
  other: 'Other',
};

export const STAGE_LABELS: Record<CandidateStage, string> = {
  new_applicant: 'New Applicant',
  hm_review: 'HM Review',
  hm_approved: 'Approved',
  hm_rejected: 'Rejected',
};

export interface DbProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface DbUserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface DbJob {
  id: string;
  title: string;
  location: string;
  department: string;
  description: string;
  hiring_manager_user_id: string | null;
  recruiter_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbCandidate {
  id: string;
  job_id: string;
  full_name: string;
  email: string;
  phone: string;
  source: CandidateSource;
  agency_name: string | null;
  visa_required: boolean;
  stage: CandidateStage;
  stage_updated_at: string;
  hm_review_due_at: string | null;
  last_reminder_sent_at: string | null;
  reminder_count: number;
  cv_file_path: string | null;
  notes: string | null;
  duplicate_of_candidate_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCandidateEvent {
  id: string;
  candidate_id: string;
  actor_user_id: string | null;
  action_type: string;
  from_stage: CandidateStage | null;
  to_stage: CandidateStage | null;
  reason_code: RejectionReason | null;
  notes: string | null;
  created_at: string;
}

export interface DbReviewToken {
  id: string;
  candidate_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}
