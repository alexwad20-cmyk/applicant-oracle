import { useAuth } from '@/contexts/AuthContext';
import { useImpersonation, PreviewRole } from '@/contexts/ImpersonationContext';

export interface EffectivePermissions {
  // Real (DB) flags — use for action execution guards
  realIsAdmin: boolean;
  realIsHR: boolean;
  realIsHM: boolean;
  realIsHrOrAdmin: boolean;

  // Effective (UI) flags — use for visibility/rendering
  effectiveIsAdmin: boolean;
  effectiveIsHR: boolean;
  effectiveIsHM: boolean;
  effectiveIsReviewer: boolean;
  effectiveIsHrOrAdmin: boolean;
  effectiveCanManageJobs: boolean;
  effectiveCanManageCandidates: boolean;
  effectiveCanApproveReject: boolean;
  effectiveCanInviteUsers: boolean;

  // Impersonation state
  isImpersonating: boolean;
  previewRole: PreviewRole;
}

export const useEffectivePermissions = (): EffectivePermissions => {
  const { roles, isHrOrAdmin, isHiringManager } = useAuth();
  const { previewRole, isImpersonating } = useImpersonation();

  const realIsAdmin = roles.includes('admin');
  const realIsHR = roles.includes('hr');
  const realIsHM = isHiringManager;
  const realIsHrOrAdmin = isHrOrAdmin;

  // Compute effective flags
  let effectiveIsAdmin: boolean;
  let effectiveIsHR: boolean;
  let effectiveIsHM: boolean;
  let effectiveIsReviewer: boolean;

  if (previewRole === 'real') {
    effectiveIsAdmin = realIsAdmin;
    effectiveIsHR = realIsHR;
    effectiveIsHM = realIsHM;
    effectiveIsReviewer = roles.includes('reviewer');
  } else {
    effectiveIsAdmin = previewRole === 'admin';
    effectiveIsHR = previewRole === 'hr';
    effectiveIsHM = previewRole === 'hiring_manager';
    effectiveIsReviewer = previewRole === 'reviewer';
  }

  const effectiveIsHrOrAdmin = effectiveIsAdmin || effectiveIsHR;

  return {
    realIsAdmin,
    realIsHR,
    realIsHM,
    realIsHrOrAdmin,

    effectiveIsAdmin,
    effectiveIsHR,
    effectiveIsHM,
    effectiveIsReviewer,
    effectiveIsHrOrAdmin,
    effectiveCanManageJobs: effectiveIsHrOrAdmin,
    effectiveCanManageCandidates: effectiveIsHrOrAdmin,
    effectiveCanApproveReject: effectiveIsHM,
    effectiveCanInviteUsers: effectiveIsHrOrAdmin,

    isImpersonating,
    previewRole,
  };
};
