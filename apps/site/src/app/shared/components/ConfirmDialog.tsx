import type { ConfirmDialogProps } from '../../../types/platform-ui.types.ts';
import { Modal } from './Modal.tsx';

/** Pede confirmação antes de uma ação (excluir, concluir), com Cancelar e o botão da ação. */
export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true,
  busy = false,
}: Readonly<ConfirmDialogProps>) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{text}</p>
      <div className="fx-dialog-foot">
        <button type="button" className="b-sm" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className={danger ? 'b-sm danger' : 'b-sm solid'} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
