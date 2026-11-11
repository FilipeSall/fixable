import { HOME_BY_ROLE } from '@fixable/shared';
import type { Role } from '@fixable/shared';

const APP_PREFIX = '/app';
const INTERNAL_PATH = /^\/(?![/\\])/;

/** Converte o papel do usuário no caminho da sua página inicial dentro do app. */
export function homeFor(role: Role): string {
  return HOME_BY_ROLE[role].slice(APP_PREFIX.length);
}

/** Escolhe o destino após o login: o caminho interno pedido ou a página inicial do papel. */
export function destinationAfterLogin(role: Role, next: string | null): string {
  return next !== null && INTERNAL_PATH.test(next) ? next : homeFor(role);
}
