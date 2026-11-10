import { useAuth } from './AuthProvider.tsx';

/** Aviso de que a sessão não pôde ser verificada (5xx ou rede), com botão para consultar de novo. */
export function SessionError() {
  const { retry } = useAuth();
  return (
    <>
      <p role="alert" className="err">
        Não foi possível verificar sua sessão.
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={retry}>
        Tentar de novo
      </button>
    </>
  );
}
