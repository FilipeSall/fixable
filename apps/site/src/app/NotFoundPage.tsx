import { Link } from 'react-router';
import type { NotFoundPageProps } from '../types/platform-ui.types.ts';

/** Tela exibida quando a rota do app não existe, com link de volta ao início. */
export function NotFoundPage({ embedded = false }: Readonly<NotFoundPageProps>) {
  const Wrapper = embedded ? 'div' : 'main';
  return (
    <Wrapper className={embedded ? undefined : 'app-home'}>
      <div id="login-panel">
        <h1 className="app-h">Página não encontrada.</h1>
        <p className="auth-switch">
          <Link to="/">Voltar ao início</Link>
        </p>
      </div>
    </Wrapper>
  );
}
