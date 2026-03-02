import React, { createContext, useContext, useState, useMemo } from 'react';
import { useJobs } from './JobsContext';

interface DepartmentFilterContextType {
  department: string;
  setDepartment: (d: string) => void;
  departments: string[];
}

const DepartmentFilterContext = createContext<DepartmentFilterContextType | undefined>(undefined);

export const DepartmentFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { jobs } = useJobs();
  const [department, setDepartment] = useState('all');

  const departments = useMemo(() => {
    const deps = [...new Set(jobs.map(j => j.department).filter(Boolean))].sort();
    return deps;
  }, [jobs]);

  return (
    <DepartmentFilterContext.Provider value={{ department, setDepartment, departments }}>
      {children}
    </DepartmentFilterContext.Provider>
  );
};

export const useDepartmentFilter = () => {
  const context = useContext(DepartmentFilterContext);
  if (!context) throw new Error('useDepartmentFilter must be used within DepartmentFilterProvider');
  return context;
};
