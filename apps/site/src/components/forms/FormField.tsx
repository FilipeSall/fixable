import type { ChangeEvent } from 'react';
import type { FormFieldProps } from '../../types/public-forms.types.ts';
import { CustomSelect } from './CustomSelect.tsx';

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
  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChange(name, event.target.value);
  }
  return (
    <div className={full ? 'field full' : 'field'}>
      <label htmlFor={id} id={`${id}-label`}>
        {label}
        {hint ? <span className="muted"> ({hint})</span> : null}
      </label>
      {control === 'select' ? (
        <CustomSelect id={id} name={name} value={value} onChange={onChange} options={options ?? []} error={error} />
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
