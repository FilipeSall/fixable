import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@fixable/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { clientKeys } from '../../clientes/api.ts';
import { agendaKeys, deleteAppointment, updateAppointment } from '../api.ts';

/** Rótulo curto do status para o aviso ("pendente" em vez de "Pendente · requer confirmação"). */
function shortLabel(status: AppointmentStatus): string {
  return (APPOINTMENT_STATUS_LABELS[status].split(' ·')[0] ?? status).toLowerCase();
}

/** Ações de troca de status e exclusão de agendamentos, com recarga das listas e avisos. */
export function useAppointmentActions() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  /** Recarrega agendamentos e contadores. */
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: agendaKeys.all });
    await queryClient.invalidateQueries({ queryKey: clientKeys.list });
  }

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) => updateAppointment(id, { status }),
    onSuccess: async (_, { status }) => {
      await refresh();
      show(`Agendamento marcado como “${shortLabel(status)}”.`);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: async () => {
      await refresh();
      show('Agendamento excluído.');
    },
  });

  return { changeStatus, remove };
}
