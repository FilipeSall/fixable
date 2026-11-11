import type { FormSuccessProps } from '../../types/public-forms.types.ts';

/** Painel de sucesso exibido depois do envio, com o ícone de check do modelo e o botão para enviar de novo. */
export function FormSuccess({ title, text, resetLabel, onReset, children }: Readonly<FormSuccessProps>) {
  return (
    <div className="form-success show" role="status">
      <div className="ic">
        <svg
          className="fx-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <g transform="translate(2 2) scale(.82)">
            <path d="m5 12 4 4L19 6" />
          </g>
          <circle cx="21" cy="3" r="1" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p className="muted mt-8">{text}</p>
      {children}
      <div className="mt-24">
        <button className="btn btn-ghost" type="button" onClick={onReset}>
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
