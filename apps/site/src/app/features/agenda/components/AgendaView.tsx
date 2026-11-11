import { useState } from 'react';
import type { AgendaItem, AgendaViewProps } from '../../../../types/agenda-ui.types.ts';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog.tsx';
import { EmptyState } from '../../../shared/components/EmptyState.tsx';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { formatDate } from '../../../shared/lib/format.ts';
import { useAppointmentActions } from '../hooks/useAppointmentActions.ts';
import { dayKeyOf, monthTitle } from '../lib/calendar.ts';
import { AppointmentCard } from './AppointmentCard.tsx';
import { CalendarMonth } from './CalendarMonth.tsx';


/** Calendário do mês com a lista de agendamentos, as ações de status e a exclusão. */
export function AgendaView({ monthKey, appointments, editable, onMonthChange, onEdit, emptyHint = '' }: Readonly<AgendaViewProps>) {
  const [todayKey] = useState(() => dayKeyOf(new Date()));
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AgendaItem | null>(null);
  const { changeStatus, remove } = useAppointmentActions();
  const sorted = [...appointments].sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
  const actionError = changeStatus.error ?? remove.error;

  /** Destaca o dia e abre o primeiro agendamento dele. */
  function selectDay(day: string) {
    setSelectedDay(day);
    setOpenId(sorted.find((item) => item.data === day)?.id ?? null);
  }

  return (
    <>
      <CalendarMonth
        monthKey={monthKey}
        todayKey={todayKey}
        appointments={appointments}
        selectedDay={selectedDay}
        onMonthChange={(key) => {
          setSelectedDay(null);
          onMonthChange(key);
        }}
        onDaySelect={selectDay}
      />
      <h3 className="ag-list-title">Agendamentos de {monthTitle(monthKey).split(' de ')[0]?.toLowerCase()}</h3>
      {actionError ? <p role="alert">{errorMessage(actionError)}</p> : null}
      {sorted.length === 0 ? <EmptyState>Nenhum serviço agendado neste mês.{emptyHint}</EmptyState> : null}
      {sorted.map((appointment) => (
        <AppointmentCard
          key={appointment.id}
          appointment={appointment}
          open={appointment.id === openId}
          editable={editable}
          onToggle={() => setOpenId(appointment.id === openId ? null : appointment.id)}
          onStatus={(status) => changeStatus.mutate({ id: appointment.id, status })}
          onEdit={onEdit ? () => onEdit(appointment) : undefined}
          onDelete={() => setRemoving(appointment)}
        />
      ))}
      {removing ? (
        <ConfirmDialog
          title="Excluir agendamento"
          text={`“${removing.servico}” em ${formatDate(removing.data)} será removido do calendário do cliente.`}
          confirmLabel="Excluir"
          busy={remove.isPending}
          onConfirm={() => remove.mutate(removing.id, { onSuccess: () => setRemoving(null) })}
          onCancel={() => setRemoving(null)}
        />
      ) : null}
    </>
  );
}
