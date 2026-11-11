import type { SyntheticEvent } from 'react';
import type { FormModalProps } from '../../../types/platform-ui.types.ts';
import { Modal } from './Modal.tsx';

/** Modal com formulário no padrão do modelo: campos, erro, Excluir à esquerda, Cancelar e ação principal. */
export function FormModal({
  title,
  submitLabel,
  onSubmit,
  onClose,
  children,
  error = '',
  busy = false,
  onDelete,
  deleteLabel = 'Excluir',
}: Readonly<FormModalProps>) {
  /** Impede o envio nativo e repassa a submissão para quem abriu o modal. */
  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="fx-form" noValidate onSubmit={handleSubmit}>
        <div className="form-grid">{children}</div>
        <p className="err" role="alert">
          {error}
        </p>
        <div className="fx-dialog-foot">
          {onDelete ? (
            <button type="button" className="b-sm danger" style={{ marginRight: 'auto' }} onClick={onDelete} disabled={busy}>
              {deleteLabel}
            </button>
          ) : null}
          <button type="button" className="b-sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="b-sm solid" disabled={busy}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
