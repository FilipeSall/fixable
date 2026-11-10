import type { ChangeEvent } from 'react';
import type { ConsentFieldProps } from '../../types/public-forms.types.ts';

/** Checkbox obrigatório de aceite dos termos de uso e da política de privacidade. */
export function ConsentField({ id, checked, onChange, error }: Readonly<ConsentFieldProps>) {
  /** Repassa o novo estado do checkbox ao formulário. */
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.checked);
  }
  return (
    <div className="field full">
      <label className="chk" htmlFor={id}>
        <input
          id={id}
          name="aceiteTermos"
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <span>
          Li e aceito os <a href="/termos-de-uso">termos de uso</a> e a <a href="/privacidade">política de privacidade</a>.
        </span>
      </label>
      {error ? (
        <span className="err" id={`${id}-err`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
