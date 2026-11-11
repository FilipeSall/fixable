import type { Appointment } from '@fixable/shared';
import { useState } from 'react';
import type { AgendamentosTabProps } from '../../../../types/agenda-ui.types.ts';
import { AddBox } from '../../../shared/components/AddBox.tsx';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { useClientAppointments } from '../hooks/useAgenda.ts';
import { monthKeyOf } from '../lib/calendar.ts';
import { AgendaView } from './AgendaView.tsx';
import { AppointmentModal } from './AppointmentModal.tsx';

/** Aba "Agendamentos" do cliente: calendário do imóvel; o engenheiro cria e altera, o cliente só vê. */
export function AgendamentosTab({ clientId, property, properties, editable }: Readonly<AgendamentosTabProps>) {
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(new Date()));
  const [editing, setEditing] = useState<Appointment | null | 'new'>(null);
  const { data, error, isPending } = useClientAppointments(clientId, monthKey, property.id);

  return (
    <>
      {isPending ? <p role="status">Carregando...</p> : null}
      {error ? <p role="alert">{errorMessage(error)}</p> : null}
      <AgendaView
        actions={editable ? <AddBox label="Novo agendamento" onClick={() => setEditing('new')} /> : null}
        monthKey={monthKey}
        appointments={data}
        editable={editable}
        onMonthChange={setMonthKey}
        onEdit={editable ? setEditing : undefined}
        emptyHint={editable ? ' Use “Novo agendamento” para criar o primeiro.' : ''}
      />
      {editing ? (
        <AppointmentModal
          clientId={clientId}
          properties={properties}
          defaultPropertyId={property.id}
          appointment={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
