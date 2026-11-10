const TOKEN_PARAM = 'token';

/** Lê o token do fragmento do link (#token=...), que não vai ao servidor e sobrevive ao recarregar a página. */
export function tokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.slice(1)).get(TOKEN_PARAM);
}

/** Tira o fragmento com o token da URL da aba, para o link usado ou expirado não ficar reaproveitável. */
export function clearTokenFromUrl(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, '', pathname + search);
}
