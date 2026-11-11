import { useSyncExternalStore } from 'react';

/** Assinatura vazia para useSyncExternalStore: o valor só muda da renderização do servidor para a do navegador. */
export function subscribeNothing() {
  return () => undefined;
}

/** Snapshot do navegador: a ilha já hidratou. */
function hydratedOnClient() {
  return true;
}

/** Snapshot do servidor e da hidratação: a ilha ainda não hidratou. */
function notHydratedOnServer() {
  return false;
}

/** Indica se o componente já hidratou no navegador, para só habilitar ações que dependem do React. */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNothing, hydratedOnClient, notHydratedOnServer);
}
