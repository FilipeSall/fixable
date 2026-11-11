import { DEMO_EMAIL_SUFFIX } from '../db/demo-data.ts';

/** Diz se o e-mail é do domínio reservado da demonstração (`*.demo@fixable.com.br`). */
export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
}
