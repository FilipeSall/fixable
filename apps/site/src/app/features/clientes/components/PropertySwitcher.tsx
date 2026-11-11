import type { PropertySwitcherProps } from '../../../../types/clientes.types.ts';

/** Alterna entre os imóveis do cliente; aparece quando há mais de um ou quando é possível adicionar. */
export function PropertySwitcher({ properties, activeId, onChange, onAdd }: Readonly<PropertySwitcherProps>) {
  if (properties.length < 2 && !onAdd) return null;
  return (
    <div className="btn-row" role="group" aria-label="Imóveis do cliente" style={{ marginBottom: 18 }}>
      {properties.map((property) => (
        <button
          key={property.id}
          type="button"
          className={property.id === activeId ? 'floor-btn active' : 'floor-btn'}
          aria-pressed={property.id === activeId}
          onClick={() => onChange(property.id)}
        >
          {property.apelido}
        </button>
      ))}
      {onAdd ? (
        <button type="button" className="b-sm" onClick={onAdd}>
          + Novo imóvel
        </button>
      ) : null}
    </div>
  );
}
