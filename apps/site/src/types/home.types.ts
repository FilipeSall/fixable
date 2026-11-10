import type { Me } from '@fixable/shared';

export type RoleHomeProps = {
  me: Me;
  logoutError?: string;
  onLogout: () => void;
};
