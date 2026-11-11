import type { RowCardProps } from '../../../types/platform-ui.types.ts';

/** Linha de lista do modelo (.row-card), clicável quando recebe onClick. */
export function RowCard({ title, subtitle, right, onClick }: Readonly<RowCardProps>) {
  const content = (
    <>
      <div className="l">
        <strong>{title}</strong>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
      {right ? <div className="r">{right}</div> : null}
    </>
  );
  if (!onClick) return <div className="row-card">{content}</div>;
  return (
    <button type="button" className="row-card click" style={{ width: '100%', textAlign: 'left' }} onClick={onClick}>
      {content}
    </button>
  );
}
