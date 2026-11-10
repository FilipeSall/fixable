import { Link } from 'react-router';

/** Tela exibida quando a rota do app não existe, com link de volta ao início. */
export function NotFoundPage() {
  return (
    <main className="app-home">
      <div id="login-panel">
        <h1 className="app-h">Página não encontrada.</h1>
        <p className="auth-switch">
          <Link to="/">Voltar ao início</Link>
        </p>
      </div>
    </main>
  );
}
