import type { ChangeEvent } from 'react';
import type { FormFieldProps } from '../../types/public-forms.types.ts';

/** Campo de formulário público (input, select ou textarea) com rótulo e erro ligado por aria-describedby. */
export function FormField({
  id,
  name,
  label,
  value,
  onChange,
  error,
  control = 'input',
  type = 'text',
  placeholder,
  autoComplete,
  options,
  full,
  hint,
}: Readonly<FormFieldProps>) {
  const errorId = `${id}-err`;
  const aria = { 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? errorId : undefined };
  /** Repassa o valor digitado ou selecionado ao formulário. */
  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    onChange(name, event.target.value);
  }
  return (
    <div className={full ? 'field full' : 'field'}>
      <label htmlFor={id}>
        {label}
        {hint ? <span className="muted"> ({hint})</span> : null}
      </label>
      {control === 'select' ? (
        <select id={id} name={name} value={value} onChange={handleChange} {...aria}>
          <option value="">Selecione</option>
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      {control === 'textarea' ? (
        <textarea id={id} name={name} value={value} placeholder={placeholder} onChange={handleChange} {...aria} />
      ) : null}
      {control === 'input' ? (
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={handleChange}
          {...aria}
        />
      ) : null}
      {error ? (
        <span className="err" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
