import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { CustomSelectProps } from '../../types/public-forms.types.ts';

/** Devolve o índice da próxima opção cujo rótulo começa com a letra digitada, partindo da opção ativa, ou -1. */
function nextByLetter(labels: readonly string[], letter: string, from: number): number {
  const needle = letter.toLocaleLowerCase('pt-BR');
  for (let step = 1; step <= labels.length; step += 1) {
    const index = (from + step) % labels.length;
    if (labels[index]?.toLocaleLowerCase('pt-BR').startsWith(needle)) return index;
  }
  return -1;
}

/** Select customizado acessível (combobox somente de seleção) que mantém um input hidden com o valor para o formulário. */
export function CustomSelect({ id, name, value, onChange, options, error, placeholder = 'Selecione' }: Readonly<CustomSelectProps>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = `${id}-list`;
  /** Monta o id do elemento de uma opção, usado por aria-activedescendant. */
  const optionId = (index: number) => `${id}-opt-${index}`;
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    /** Fecha a lista quando o clique acontece fora do componente. */
    function closeOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  });

  /** Abre a lista com a opção selecionada (ou a primeira) ativa. */
  function openList() {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  /** Escolhe a opção, avisa o formulário e fecha a lista. */
  function choose(index: number) {
    const option = options[index];
    if (option) onChange(name, option.value);
    setOpen(false);
  }

  /** Move a opção ativa, sem passar dos limites da lista. */
  function moveTo(index: number) {
    setActive(Math.min(options.length - 1, Math.max(0, index)));
  }

  /** Trata as teclas do padrão WAI-ARIA de combobox somente de seleção. */
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event;
    if (!open) {
      if (key === 'Enter' || key === ' ' || key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (key === 'Tab') {
      setOpen(false);
      return;
    }
    const moves: Record<string, () => void> = {
      ArrowDown: () => moveTo(active + 1),
      ArrowUp: () => moveTo(active - 1),
      Home: () => moveTo(0),
      End: () => moveTo(options.length - 1),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => setOpen(false),
    };
    if (moves[key]) {
      event.preventDefault();
      moves[key]();
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const found = nextByLetter(
        options.map((option) => option.label),
        key,
        active,
      );
      if (found >= 0) setActive(found);
    }
  }

  return (
    <div className="fx-select" ref={rootRef}>
      <input type="hidden" name={name} value={value} readOnly />
      <button
        type="button"
        id={id}
        className="fx-select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        data-placeholder={selected ? undefined : 'true'}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
      >
        <span className="fx-select-value">{selected ? selected.label : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="fx-select-menu" id={listId} role="listbox" aria-labelledby={`${id}-label`} hidden={!open}>
        {options.map((option, index) => (
          <div
            key={option.value}
            id={optionId(index)}
            role="option"
            aria-selected={option.value === value}
            className={open && index === active ? 'fx-select-option is-active' : 'fx-select-option'}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActive(index)}
            onClick={() => choose(index)}
          >
            <span>{option.label}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="m5 12 4.5 4.5L19 7" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}
