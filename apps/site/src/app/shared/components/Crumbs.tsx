import { Fragment } from 'react';
import { Link } from 'react-router';
import type { CrumbsProps } from '../../../types/platform-ui.types.ts';

/** Trilha de navegação do modelo (.crumbs), com links nos níveis anteriores. */
export function Crumbs({ items }: Readonly<CrumbsProps>) {
  return (
    <nav className="crumbs" aria-label="Você está em">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 ? <span aria-hidden="true">/</span> : null}
          {item.to ? (
            <Link to={item.to} className="link">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
