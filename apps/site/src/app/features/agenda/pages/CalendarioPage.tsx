import { useState } from 'react';
import { errorMessage } from '../../../shared/lib/errors.ts';
import { AgendaView } from '../components/AgendaView.tsx';
import { useEngineerAppointments } from '../hooks/useAgenda.ts';
import { monthKeyOf } from '../lib/calendar.ts';

/** Calendário do engenheiro com os agendamentos de todos os clientes dele. */
export function CalendarioPage() {
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(new Date()));
  const { data, error, isPending } = useEngineerAppointments(monthKey);
  return (
    <>
      <h1 className="app-h">Calendário</h1>
      <p className="app-sub">Todos os agendamentos dos seus clientes. Use a seta de um agendamento para ver a descrição completa e o cliente atendido.</p>
      {isPending ? <p role="status">Carregando...</p> : null}
      {error ? <p role="alert">{errorMessage(error)}</p> : null}
      <AgendaView monthKey={monthKey} appointments={data} editable onMonthChange={setMonthKey} />
    </>
  );
}
