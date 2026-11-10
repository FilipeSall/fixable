export const ROLES = ['cliente', 'profissional', 'engenheiro', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['convidado', 'ativo', 'bloqueado'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const HOME_BY_ROLE: Record<Role, string> = {
  cliente: '/app/cliente',
  engenheiro: '/app/clientes',
  profissional: '/app/projetos',
  admin: '/app/admin',
};
