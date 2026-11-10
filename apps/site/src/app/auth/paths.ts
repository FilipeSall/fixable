import { HOME_BY_ROLE } from '@fixable/shared';
import type { Role } from '@fixable/shared';

const APP_PREFIX = '/app';
const INTERNAL_PATH = /^\/(?![/\\])/;

export function homeFor(role: Role): string {
  return HOME_BY_ROLE[role].slice(APP_PREFIX.length);
}

export function destinationAfterLogin(role: Role, next: string | null): string {
  return next !== null && INTERNAL_PATH.test(next) ? next : homeFor(role);
}
