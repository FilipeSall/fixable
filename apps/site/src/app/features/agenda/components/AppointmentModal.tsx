import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from '@fixable/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AppointmentModalProps } from '../../../../types/agenda-ui.types.ts';
import { FormModal } from '../../../shared/components/FormModal.tsx';
import { useToast } from '../../../shared/hooks/useToast.ts';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { agendaKeys, createAppointment, updateAppointment } from '../api.ts';
import { daysFromToday } from '../lib/calendar.ts';

const DEFAULT_DAYS_AHEAD = 3;
const DEFAULT_TIME = '09:00';

/** Modal de criar ou editar um agendamento do cliente. */
export function AppointmentModal({ clientId, properties, defaultPropertyId, appointment, onClose }: Readonly<AppointmentModalProps>) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const [servico, setServico] = useState(appointment?.servico ?? '');
  const [data, setData] = useState(appointment?.data ?? daysFromToday(DEFAULT_DAYS_AHEAD));
  const [hora, setHora] = useState(appointment?.hora.slice(0, 5) ?? DEFAULT_TIME);
  const [status, setStatus] = useState<AppointmentStatus>(appointment?.status ?? 'pendente');
  const [propertyId, setPropertyId] = useState(appointment?.propertyId ?? defaultPropertyId);
  const [descricao, setDescricao] = useState(appointment?.descricao ?? '');

  const save = useMutation({
    mutationFn: () => {
      const base = { propertyId, servico, data, hora, status };
      if (appointment) return updateAppointment(appointment.id, { ...base, descricao });
      return createAppointment(clientId, { ...base, ...(descricao ? { descricao } : {}) });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: agendaKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      show('Agendamento salvo. Ele já aparece no calendário do cliente.');
      onClose();
    },
  });

  return (
    <FormModal
      title={appointment ? 'Editar agendamento' : 'Novo agendamento'}
      submitLabel={appointment ? 'Salvar' : 'Agendar'}
      busy={save.isPending}
      error={save.error ? errorMessage(save.error) : ''}
      onSubmit={() => save.mutate()}
      onClose={onClose}
    >
      <div className="field full">
        <label htmlFor="ag-servico">Serviço agendado</label>
        <input id="ag-servico" value={servico} onChange={(event) => setServico(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ag-data">Data</label>
        <input id="ag-data" type="date" value={data} onChange={(event) => setData(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ag-hora">Horário</label>
        <input id="ag-hora" type="time" value={hora} onChange={(event) => setHora(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ag-status">Status</label>
        <select id="ag-status" value={status} onChange={(event) => setStatus(event.target.value as AppointmentStatus)}>
          {APPOINTMENT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {APPOINTMENT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ag-imovel">Imóvel</label>
        <select id="ag-imovel" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.apelido}
            </option>
          ))}
        </select>
      </div>
      <div className="field full">
        <label htmlFor="ag-descricao">Descrição do serviço a ser prestado</label>
        <textarea id="ag-descricao" value={descricao} onChange={(event) => setDescricao(event.target.value)} />
      </div>
    </FormModal>
  );
}
