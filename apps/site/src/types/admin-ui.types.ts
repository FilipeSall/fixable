import type { AdminApplication, ApplicationStatus } from '@fixable/shared';

export type LeadFilter = 'todos' | 'sem';

export type ApplicationAction = { kind: 'approve' | 'refuse'; application: AdminApplication } | null;

export type ApplicationTab = ApplicationStatus;

export type InviteModalProps = {
  onClose: () => void;
};
