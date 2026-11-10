import type { FormSuccessProps } from '../../types/public-forms.types.ts';

/** Painel de sucesso exibido depois do envio, com o botão para enviar outra solicitação. */
export function FormSuccess({ title, text, onReset, children }: Readonly<FormSuccessProps>) {
  return (
    <div className="form-success show" role="status">
      <h3>{title}</h3>
      <p className="muted mt-8">{text}</p>
      {children}
      <div className="mt-24">
        <button className="btn btn-ghost" type="button" onClick={onReset}>
          Enviar outra solicitação
        </button>
      </div>
    </div>
  );
}
