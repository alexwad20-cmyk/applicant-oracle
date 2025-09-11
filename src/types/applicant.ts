export interface Applicant {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  dateOfApplication: string;
  roleAppliedFor: string;
  needsVisa: boolean;
  fromAgency: boolean;
  agencyName?: string;
  interviewStage: InterviewStage;
  jobAccepted: boolean | null; // null = not yet decided
  cvFile?: File;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export enum InterviewStage {
  APPLIED = 'applied',
  SCREENING = 'screening',
  FIRST_INTERVIEW = 'first_interview',
  SECOND_INTERVIEW = 'second_interview',
  FINAL_INTERVIEW = 'final_interview',
  OFFER_MADE = 'offer_made',
  REJECTED = 'rejected',
  WITHDRAWN = 'withdrawn'
}

export const INTERVIEW_STAGE_LABELS: Record<InterviewStage, string> = {
  [InterviewStage.APPLIED]: 'Applied',
  [InterviewStage.SCREENING]: 'Screening',
  [InterviewStage.FIRST_INTERVIEW]: 'First Interview',
  [InterviewStage.SECOND_INTERVIEW]: 'Second Interview',
  [InterviewStage.FINAL_INTERVIEW]: 'Final Interview',
  [InterviewStage.OFFER_MADE]: 'Offer Made',
  [InterviewStage.REJECTED]: 'Rejected',
  [InterviewStage.WITHDRAWN]: 'Withdrawn'
};