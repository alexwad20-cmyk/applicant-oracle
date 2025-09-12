import { Candidate } from '@/types/applicant';
import { useJobs } from '@/contexts/JobsContext';

export const useApplicants = () => {
  const { candidates, addCandidate, updateCandidate, deleteCandidate, getCandidate } = useJobs();

  // For backward compatibility
  const applicants = candidates;

  const addApplicant = (applicant: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>) => {
    return addCandidate(applicant);
  };

  const updateApplicant = (id: string, updates: Partial<Candidate>) => {
    updateCandidate(id, updates);
  };

  const deleteApplicant = (id: string) => {
    deleteCandidate(id);
  };

  const getApplicant = (id: string) => {
    return getCandidate(id);
  };

  return {
    applicants,
    addApplicant,
    updateApplicant,
    deleteApplicant,
    getApplicant,
  };
};