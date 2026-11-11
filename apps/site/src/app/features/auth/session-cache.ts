import type { QueryClient } from '@tanstack/react-query';
import { ME_KEY } from './me-key.ts';

/** Cancela as consultas em andamento e descarta todas as que não são a sessão, para nenhum dado de um usuário aparecer para outro. */
export async function clearPrivateQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries();
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
}

/** Diz se a troca de sessão muda de usuário a partir de alguém logado, caso em que o cache privado precisa ser descartado. */
export function changesUser(previous: string | null | undefined, next: string | null): boolean {
  return Boolean(previous) && previous !== next;
}
