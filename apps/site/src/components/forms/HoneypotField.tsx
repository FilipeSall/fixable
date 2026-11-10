import type { ChangeEvent } from 'react';
import type { HoneypotFieldProps } from '../../types/public-forms.types.ts';

const OFFSCREEN = { position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' } as const;

/** Campo isca fora da tela que só robôs preenchem; o servidor descarta o envio quando ele vem preenchido. */
export function HoneypotField({ id, value, onChange }: Readonly<HoneypotFieldProps>) {
  /** Repassa o texto do campo isca ao formulário. */
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }
  return (
    <div aria-hidden="true" style={OFFSCREEN}>
      <label htmlFor={id}>Não preencha este campo</label>
      <input id={id} name="website" type="text" tabIndex={-1} autoComplete="off" value={value} onChange={handleChange} />
    </div>
  );
}
