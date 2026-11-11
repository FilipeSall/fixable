import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import type { ModalProps } from '../../../types/platform-ui.types.ts';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Lista os elementos focáveis do diálogo, na ordem do documento. */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

/** Diálogo modal do modelo: prende o foco, fecha com Esc e devolve o foco a quem o abriu. */
export function Modal({ title, onClose, children, wide = false }: Readonly<ModalProps>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog) (focusables(dialog)[1] ?? focusables(dialog)[0] ?? dialog).focus();
    return () => previous?.focus();
  }, []);

  /** Trata Esc (fechar) e Tab (manter o foco dentro do diálogo). */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const items = focusables(dialogRef.current);
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fx-modal" role="presentation" onKeyDown={handleKeyDown}>
      <div
        ref={dialogRef}
        className={wide ? 'fx-dialog wide' : 'fx-dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="fx-dialog-head">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
