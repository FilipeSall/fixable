import type { AuthLayoutProps } from '../../../types/auth-screens.types.ts';

/** Moldura das telas de acesso no visual do modelo: topo com a marca e duas colunas (formulário e cartão). */
export function AuthLayout({ children, aside }: Readonly<AuthLayoutProps>) {
  return (
    <div className="app-shell auth-page">
      <header className="app-top">
        <div className="app-top-inner">
          <a className="app-brand" href="/">
            <span>fixable</span>
          </a>
          <div className="app-top-right">
            <a className="app-logout" href="/">
              Voltar ao site
            </a>
          </div>
        </div>
      </header>
      <main className={aside ? 'login-wide' : 'login-wide single'}>
        <div id="login-panel">{children}</div>
        {aside ? <aside className="login-card">{aside}</aside> : null}
      </main>
    </div>
  );
}
