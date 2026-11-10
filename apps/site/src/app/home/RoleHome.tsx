import type { Me } from '@fixable/shared';

interface Props {
  me: Me;
  logoutError?: string;
  onLogout: () => void;
}

export function RoleHome({ me, logoutError, onLogout }: Readonly<Props>) {
  const firstName = me.nome.split(' ')[0];
  return (
    <main className="app-home">
      <h1 className="app-h">Olá, {firstName}.</h1>
      {logoutError ? (
        <p className="err" role="alert">
          {logoutError}
        </p>
      ) : null}
      <button type="button" className="btn btn-ghost" onClick={onLogout}>
        Sair
      </button>
    </main>
  );
}
