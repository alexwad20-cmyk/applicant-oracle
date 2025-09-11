export interface Job {
  id: string;
  title: string;
  department: string;
  hiringManager: string;
  hiringManagerEmail: string;
  description: string;
  status: 'open' | 'closed' | 'paused';
  createdAt: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  jobId: string;
  dateOfApplication: string;
  needsVisa: boolean;
  fromAgency: boolean;
  agencyName?: string;
  stage: CandidateStage;
  cvFile?: File;
  notes?: string;
  emailSentAt?: string; // When email was sent to hiring manager
  createdAt: string;
  updatedAt: string;
}

export enum CandidateStage {
  NEW_APPLICANT = 'new_applicant',
  SENT_FOR_REVIEW = 'sent_for_review',
  PROGRESSED = 'progressed',
  REJECTED = 'rejected'
}

export const CANDIDATE_STAGE_LABELS: Record<CandidateStage, string> = {
  [CandidateStage.NEW_APPLICANT]: 'New Applicant',
  [CandidateStage.SENT_FOR_REVIEW]: 'Sent for Review',
  [CandidateStage.PROGRESSED]: 'Progressed',
  [CandidateStage.REJECTED]: 'Rejected'
};

export interface EmailTemplate {
  id: string;
  subject: string;
  content: string;
  candidateId: string;
  hiringManagerEmail: string;
  sentAt: string;
  responseToken: string;
}

// Legacy types for backwards compatibility
export type Applicant = Candidate;
export type InterviewStage = CandidateStage;
export const INTERVIEW_STAGE_LABELS = CANDIDATE_STAGE_LABELS;