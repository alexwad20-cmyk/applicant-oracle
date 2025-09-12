import React, { createContext, useContext, useState, useEffect } from 'react';
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

interface JobsContextType {
  jobs: Job[];
  candidates: Candidate[];
  addCandidate: (candidate: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>) => Candidate;
  updateCandidate: (id: string, updates: Partial<Candidate>) => void;
  deleteCandidate: (id: string) => void;
  getCandidate: (id: string) => Candidate | undefined;
  getCandidatesForJob: (jobId: string) => Candidate[];
  getJob: (id: string) => Job | undefined;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

export const JobsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = localStorage.getItem('jobs');
    return saved ? JSON.parse(saved) : mockJobs;
  });
  
  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    const saved = localStorage.getItem('candidates');
    return saved ? JSON.parse(saved) : [];
  });

  // Persist to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('jobs', JSON.stringify(jobs));
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem('candidates', JSON.stringify(candidates));
  }, [candidates]);

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

  const value: JobsContextType = {
    jobs,
    candidates,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    getCandidate,
    getCandidatesForJob,
    getJob,
  };

  return (
    <JobsContext.Provider value={value}>
      {children}
    </JobsContext.Provider>
  );
};

export const useJobs = () => {
  const context = useContext(JobsContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobsProvider');
  }
  return context;
};