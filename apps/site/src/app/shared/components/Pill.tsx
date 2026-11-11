import type { PillProps } from '../../../types/platform-ui.types.ts';

/** Etiqueta de status colorida do modelo (.pill). */
export function Pill({ color, children }: Readonly<PillProps>) {
  return <span className={`pill ${color}`}>{children}</span>;
}
