import { APPOINTMENT_STATUS_LABELS } from '@fixable/shared';
import type { CalendarMonthProps } from '../../../../types/agenda-ui.types.ts';
import { dayStatus, monthCells, monthTitle, shiftMonth, WEEKDAYS } from '../lib/calendar.ts';

/** Classe da célula do dia conforme hoje, seleção e agendamentos. */
function dayClass(hasEvents: boolean, isToday: boolean, isSelected: boolean): string {
  return ['day', hasEvents ? 'has' : '', isToday ? 'today' : '', isSelected ? 'hl' : ''].filter(Boolean).join(' ');
}

/** Calendário mensal do modelo: grade de 7 colunas com a cor do dia pelo status dos agendamentos. */
export function CalendarMonth({ monthKey, todayKey, appointments, selectedDay, onMonthChange, onDaySelect }: Readonly<CalendarMonthProps>) {
  return (
    <section className="cal" aria-label="Calendário">
      <div className="cal-head">
        <h3>{monthTitle(monthKey)}</h3>
        <div className="cal-nav">
          <button type="button" className="icon-btn" aria-label="Mês anterior" onClick={() => onMonthChange(shiftMonth(monthKey, -1))}>
            ‹
          </button>
          <button type="button" className="icon-btn" aria-label="Próximo mês" onClick={() => onMonthChange(shiftMonth(monthKey, 1))}>
            ›
          </button>
        </div>
      </div>
      <div className="cal-month">
        <div className="grid7">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="wd">
              {weekday}
            </div>
          ))}
          {monthCells(monthKey).map((day, index) => {
            if (!day) return <div key={`out-${index}`} className="day out" aria-hidden="true" />;
            const events = appointments.filter((item) => item.data === day);
            const number = Number(day.slice(8));
            const label = events.length === 1 ? '1 serviço' : `${events.length} serviços`;
            return (
              <div key={day} className={dayClass(events.length > 0, day === todayKey, day === selectedDay)} data-day={day}>
                {events.length > 0 ? (
                  <button type="button" className={`n ev-${dayStatus(events)}`} style={{ border: 0 }} aria-label={`Dia ${number}: ${label}, ${APPOINTMENT_STATUS_LABELS[dayStatus(events)]}`} onClick={() => onDaySelect(day)}>
                    {number}
                  </button>
                ) : (
                  <span className="n">{number}</span>
                )}
                {events.length > 0 ? <span className="cnt">{label}</span> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="cal-legend">
        <span>
          <i className="ev-confirmado" />
          Confirmado
        </span>
        <span>
          <i className="ev-pendente" />
          Pendente ou requer confirmação
        </span>
        <span>
          <i className="ev-adiado" />
          Adiado
        </span>
      </div>
    </section>
  );
}
