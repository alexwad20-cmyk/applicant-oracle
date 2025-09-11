import { useState, useEffect } from 'react';
import { Applicant } from '@/types/applicant';

// Mock data for demonstration
const mockApplicants: Applicant[] = [];

export const useApplicants = () => {
  const [applicants, setApplicants] = useState<Applicant[]>(mockApplicants);

  const addApplicant = (applicant: Omit<Applicant, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newApplicant: Applicant = {
      ...applicant,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setApplicants(prev => [newApplicant, ...prev]);
    return newApplicant;
  };

  const updateApplicant = (id: string, updates: Partial<Applicant>) => {
    setApplicants(prev =>
      prev.map(applicant =>
        applicant.id === id
          ? { ...applicant, ...updates, updatedAt: new Date().toISOString() }
          : applicant
      )
    );
  };

  const deleteApplicant = (id: string) => {
    setApplicants(prev => prev.filter(applicant => applicant.id !== id));
  };

  const getApplicant = (id: string) => {
    return applicants.find(applicant => applicant.id === id);
  };

  return {
    applicants,
    addApplicant,
    updateApplicant,
    deleteApplicant,
    getApplicant,
  };
};