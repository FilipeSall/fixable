import type { AddBoxProps } from '../../../types/platform-ui.types.ts';

/** Botão tracejado de adicionar do modelo (.add-box). */
export function AddBox({ label, onClick, below = false }: Readonly<AddBoxProps>) {
  return (
    <button type="button" className={below ? 'add-box below' : 'add-box'} onClick={onClick}>
      <b aria-hidden="true">+</b>
      {label}
    </button>
  );
}
