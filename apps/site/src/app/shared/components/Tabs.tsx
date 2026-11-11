import type { KeyboardEvent } from 'react';
import type { TabsProps } from '../../../types/platform-ui.types.ts';

/** Barra de abas do modelo (.fx-tabs), navegável por setas, Home e End. */
export function Tabs<K extends string>({ items, active, onChange, label }: Readonly<TabsProps<K>>) {
  /** Move a seleção entre as abas pelo teclado. */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.key === active);
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = items[(target + items.length) % items.length];
    if (next) onChange(next.key);
  }

  return (
    <div className="fx-tabs" role="tablist" aria-label={label} onKeyDown={handleKeyDown}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === active}
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
