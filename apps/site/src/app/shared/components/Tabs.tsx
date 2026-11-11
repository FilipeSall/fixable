import { useRef, type KeyboardEvent } from 'react';
import type { TabPanelProps, TabsProps } from '../../../types/platform-ui.types.ts';

/** Id do botão de uma aba, usado pelo painel em aria-labelledby. */
export function tabId(idPrefix: string, key: string): string {
  return `${idPrefix}-tab-${key}`;
}

/** Id do painel das abas, usado pelos botões em aria-controls. */
export function panelId(idPrefix: string): string {
  return `${idPrefix}-panel`;
}

/** Barra de abas do modelo (.fx-tabs); setas, Home e End trocam a aba e levam o foco junto. */
export function Tabs<K extends string>({ items, active, onChange, label, idPrefix }: Readonly<TabsProps<K>>) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  /** Move a seleção e o foco entre as abas pelo teclado. */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.key === active);
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = items[(target + items.length) % items.length];
    if (!next) return;
    onChange(next.key);
    refs.current.get(next.key)?.focus();
  }

  return (
    <div className="fx-tabs" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
      {items.map((item) => (
        <button
          key={item.key}
          ref={(node) => {
            if (node) refs.current.set(item.key, node);
            else refs.current.delete(item.key);
          }}
          id={tabId(idPrefix, item.key)}
          type="button"
          role="tab"
          aria-selected={item.key === active}
          aria-controls={panelId(idPrefix)}
          tabIndex={item.key === active ? 0 : -1}
          className={item.key === active ? 'fx-tab active' : 'fx-tab'}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Painel ligado à aba ativa (role tabpanel, rotulado pela aba). */
export function TabPanel({ idPrefix, active, children }: Readonly<TabPanelProps>) {
  return (
    <div role="tabpanel" id={panelId(idPrefix)} aria-labelledby={tabId(idPrefix, active)}>
      {children}
    </div>
  );
}
