import type { Appointment, AppointmentStatus } from '@fixable/shared';
import type { PillColor } from '../../../../types/platform-ui.types.ts';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MONTH_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const STATUS_PILL: Record<AppointmentStatus, PillColor> = {
  confirmado: 'green',
  pendente: 'yellow',
  adiado: 'red',
};

/** Completa com zero à esquerda até dois dígitos. */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Chave do mês (AAAA-MM) de uma data local. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Chave do dia (AAAA-MM-DD) de uma data local. */
export function dayKeyOf(date: Date): string {
  return `${monthKeyOf(date)}-${pad(date.getDate())}`;
}

/** Soma (ou subtrai) meses a uma chave AAAA-MM. */
export function shiftMonth(monthKey: string, delta: number): string {
  const [year = 0, month = 1] = monthKey.split('-').map(Number);
  return monthKeyOf(new Date(year, month - 1 + delta, 1));
}

/** Título do mês, como "Novembro de 2026". */
export function monthTitle(monthKey: string): string {
  const [year = 0, month = 1] = monthKey.split('-').map(Number);
  return `${MONTHS[month - 1] ?? ''} de ${year}`;
}

/** Monta a grade do mês: espaços vazios até o primeiro dia da semana e depois os dias (AAAA-MM-DD). */
export function monthCells(monthKey: string): (string | null)[] {
  const [year = 0, month = 1] = monthKey.split('-').map(Number);
  const first = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const blanks: null[] = Array.from({ length: first }, () => null);
  const filled = Array.from({ length: days }, (_, index) => `${monthKey}-${pad(index + 1)}`);
  return [...blanks, ...filled];
}

/** Cor do dia: adiado vence, depois pendente, senão confirmado. */
export function dayStatus(appointments: readonly Appointment[]): AppointmentStatus {
  if (appointments.some((item) => item.status === 'adiado')) return 'adiado';
  if (appointments.some((item) => item.status === 'pendente')) return 'pendente';
  return 'confirmado';
}

/** Data AAAA-MM-DD somada de N dias a partir de hoje. */
export function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dayKeyOf(date);
}
