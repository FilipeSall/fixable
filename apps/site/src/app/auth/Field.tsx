import type { ChangeEvent } from 'react';
import type { FieldProps } from '../../types/auth-screens.types.ts';

/** Campo de formulário com rótulo, mensagem de erro e atributos de acessibilidade. */
export function Field({ id, label, type, autoComplete, value, onChange, error, placeholder }: Readonly<FieldProps>) {
  const errorId = `${id}-err`;
  /** Repassa o texto digitado ao componente pai. */
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <span className="err" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
