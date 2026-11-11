import type { PlaceholderPageProps } from '../../../types/platform-ui.types.ts';
import { EmptyState } from './EmptyState.tsx';

/** Página provisória enquanto a tela definitiva não existe. */
export function PlaceholderPage({ title }: Readonly<PlaceholderPageProps>) {
  return (
    <>
      <h1 className="app-h">{title}</h1>
      <EmptyState>Em construção.</EmptyState>
    </>
  );
}
