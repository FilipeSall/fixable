import type { Role } from './types/roles.types.ts';

export const ROLES = ['cliente', 'profissional', 'engenheiro', 'admin'] as const;

export const USER_STATUSES = ['convidado', 'ativo', 'bloqueado'] as const;

export const HOME_BY_ROLE: Record<Role, string> = {
  cliente: '/app/cliente',
  engenheiro: '/app/clientes',
  profissional: '/app/projetos',
  admin: '/app/admin/leads',
};
