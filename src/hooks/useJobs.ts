import { useState } from 'react';
import { Job, Candidate } from '@/types/applicant';

// Mock data for demonstration
const mockJobs: Job[] = [
  {
    id: '1',
    title: 'Senior Software Engineer',
    department: 'Engineering',
    hiringManager: 'John Smith',
    hiringManagerEmail: 'john.smith@company.com',
    description: 'Looking for an experienced software engineer to join our team',
    status: 'open',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Product Manager',
    department: 'Product',
    hiringManager: 'Sarah Johnson',
    hiringManagerEmail: 'sarah.johnson@company.com',
    description: 'Seeking a product manager to lead our product initiatives',
    status: 'open',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'UX Designer',
    department: 'Design',
    hiringManager: 'Mike Chen',
    hiringManagerEmail: 'mike.chen@company.com',
    description: 'Creative UX designer needed for our growing team',
    status: 'open',
    createdAt: new Date().toISOString(),
  }
];

const mockCandidates: Candidate[] = [];

export const useJobs = () => {
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [candidates, setCandidates] = useState<Candidate[]>(mockCandidates);

  const addCandidate = (candidate: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCandidate: Candidate = {
      ...candidate,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCandidates(prev => [newCandidate, ...prev]);
    return newCandidate;
  };

  const updateCandidate = (id: string, updates: Partial<Candidate>) => {
    setCandidates(prev =>
      prev.map(candidate =>
        candidate.id === id
          ? { ...candidate, ...updates, updatedAt: new Date().toISOString() }
          : candidate
      )
    );
  };

  const deleteCandidate = (id: string) => {
    setCandidates(prev => prev.filter(candidate => candidate.id !== id));
  };

  const getCandidate = (id: string) => {
    return candidates.find(candidate => candidate.id === id);
  };

  const getCandidatesForJob = (jobId: string) => {
    return candidates.filter(candidate => candidate.jobId === jobId);
  };

  const getJob = (id: string) => {
    return jobs.find(job => job.id === id);
  };

  return {
    jobs,
    candidates,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    getCandidate,
    getCandidatesForJob,
    getJob,
  };
};