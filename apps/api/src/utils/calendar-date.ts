const DAY_MS = 24 * 60 * 60 * 1000;

/** Converte a data YYYY-MM-DD em um Date à meia-noite UTC, base das contas de calendário. */
const toUtc = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/** Formata um Date UTC de volta para YYYY-MM-DD. */
const toIso = (date: Date): string => date.toISOString().slice(0, 10);

/** Devolve o último dia do mês (1 a 12) do ano informado. */
const lastDayOf = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Devolve a data de hoje (YYYY-MM-DD) no fuso horário informado. */
export function todayIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Soma (ou subtrai, se negativo) dias a uma data YYYY-MM-DD. */
export function addDays(iso: string, days: number): string {
  return toIso(new Date(toUtc(iso).getTime() + days * DAY_MS));
}

/** Desloca a data sem sair do mês: tenta o deslocamento, depois o espelho, e por fim limita à borda do mês. */
export function dayInMonth(iso: string, days: number): string {
  const month = iso.slice(0, 7);
  for (const candidate of [addDays(iso, days), addDays(iso, -days)]) {
    if (candidate.startsWith(month)) return candidate;
  }
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const day = days > 0 ? lastDayOf(year, monthNumber) : 1;
  return `${month}-${String(day).padStart(2, '0')}`;
}

/** Devolve o dia pedido do mês seguinte ao da data, limitado ao último dia desse mês. */
export function dayOfNextMonth(iso: string, day: number): string {
  const date = toUtc(iso);
  const year = date.getUTCFullYear() + (date.getUTCMonth() === 11 ? 1 : 0);
  const month = ((date.getUTCMonth() + 1) % 12) + 1;
  const clamped = Math.min(day, lastDayOf(year, month));
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`;
}
