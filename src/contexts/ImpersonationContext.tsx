import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type PreviewRole = 'real' | 'admin' | 'hr' | 'hiring_manager' | 'reviewer';

interface ImpersonationContextType {
  previewRole: PreviewRole;
  setPreviewRole: (role: PreviewRole) => void;
  resetPreviewRole: () => void;
  isImpersonating: boolean;
}

const STORAGE_KEY = 'impersonation_role';

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [previewRole, setPreviewRoleState] = useState<PreviewRole>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ['real', 'admin', 'hr', 'hiring_manager', 'reviewer'].includes(stored)) {
        return stored as PreviewRole;
      }
    } catch {}
    return 'real';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, previewRole);
    } catch {}
  }, [previewRole]);

  const setPreviewRole = useCallback((role: PreviewRole) => {
    setPreviewRoleState(role);
  }, []);

  const resetPreviewRole = useCallback(() => {
    setPreviewRoleState('real');
  }, []);

  return (
    <ImpersonationContext.Provider value={{
      previewRole,
      setPreviewRole,
      resetPreviewRole,
      isImpersonating: previewRole !== 'real',
    }}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (!context) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return context;
};
