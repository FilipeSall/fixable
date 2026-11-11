import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { fetchFloorplan, fetchHistory, maqueteKeys } from '../api.ts';

/** Andares, cômodos e serviços visíveis do imóvel. */
export function useFloorplan(propertyId: string) {
  return useQuery({ queryKey: maqueteKeys.floorplan(propertyId), queryFn: () => fetchFloorplan(propertyId) });
}

/** Histórico de manutenção do imóvel. */
export function useHistory(propertyId: string) {
  return useQuery({ queryKey: maqueteKeys.history(propertyId), queryFn: () => fetchHistory(propertyId) });
}

/** Devolve a função que recarrega maquete, histórico e a lista de clientes depois de uma mudança. */
export function useRefreshMaquete(propertyId: string) {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: maqueteKeys.floorplan(propertyId) }),
      queryClient.invalidateQueries({ queryKey: maqueteKeys.history(propertyId) }),
      queryClient.invalidateQueries({ queryKey: ['clients'] }),
    ]);
  }, [queryClient, propertyId]);
}
