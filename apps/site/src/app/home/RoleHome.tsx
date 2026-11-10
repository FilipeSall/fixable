import type { RoleHomeProps } from '../../types/home.types.ts';

/** Mostra a saudação ao usuário e o botão de sair. */
export function RoleHome({ me, logoutError, onLogout }: Readonly<RoleHomeProps>) {
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
