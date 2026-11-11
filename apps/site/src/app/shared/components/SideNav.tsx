import { NavLink } from 'react-router';
import type { SideNavProps } from '../../../types/platform-ui.types.ts';

/** Barra lateral do modelo (.app-side) com o item da rota atual destacado. */
export function SideNav({ section }: Readonly<SideNavProps>) {
  return (
    <aside className="app-side" aria-label="Navegação da plataforma">
      <p className="side-label">{section.label}</p>
      {section.items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'side-btn active' : 'side-btn')}>
          {item.label}
        </NavLink>
      ))}
    </aside>
  );
}
