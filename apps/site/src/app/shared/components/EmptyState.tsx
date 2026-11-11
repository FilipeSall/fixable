import type { EmptyStateProps } from '../../../types/platform-ui.types.ts';

/** Caixa tracejada de estado vazio do modelo (.empty). */
export function EmptyState({ children }: Readonly<EmptyStateProps>) {
  return <div className="empty">{children}</div>;
}
