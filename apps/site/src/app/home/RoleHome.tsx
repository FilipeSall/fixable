import type { Me } from '@fixable/shared';

interface Props {
  me: Me;
  onLogout: () => void;
}

export function RoleHome({ me, onLogout }: Readonly<Props>) {
  const firstName = me.nome.split(' ')[0];
  return (
    <main className="app-home">
      <h1 className="app-h">Olá, {firstName}.</h1>
      <button type="button" className="btn btn-ghost" onClick={onLogout}>
        Sair
      </button>
    </main>
  );
}
