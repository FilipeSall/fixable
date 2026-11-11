import type { StatRowProps } from '../../../types/platform-ui.types.ts';

/** Faixa de números de resumo do modelo (.stat-row). */
export function StatRow({ items }: Readonly<StatRowProps>) {
  return (
    <div className="stat-row">
      {items.map((item) => (
        <div key={item.label} className="stat">
          <b>{item.value}</b>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}
