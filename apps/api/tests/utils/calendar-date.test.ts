import { describe, expect, it } from 'vitest';
import { addDays, dayInMonth, dayOfNextMonth, todayIn } from '../../src/utils/calendar-date.ts';

describe('calendar-date', () => {
  it('todayIn usa o fuso informado para achar a data do dia', () => {
    const quaseMeiaNoiteEmSaoPaulo = new Date('2026-11-12T02:30:00Z');
    expect(todayIn('America/Sao_Paulo', quaseMeiaNoiteEmSaoPaulo)).toBe('2026-11-11');
    expect(todayIn('UTC', quaseMeiaNoiteEmSaoPaulo)).toBe('2026-11-12');
  });

  it('addDays soma e subtrai dias atravessando meses e anos', () => {
    expect(addDays('2026-11-11', 9)).toBe('2026-11-20');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('dayInMonth desloca dentro do mês e espelha ou limita quando sairia dele', () => {
    expect(dayInMonth('2026-11-11', 8)).toBe('2026-11-19');
    expect(dayInMonth('2026-11-28', 8)).toBe('2026-11-20');
    expect(dayInMonth('2026-11-02', -5)).toBe('2026-11-07');
    expect(dayInMonth('2026-02-15', 20)).toBe('2026-02-28');
  });

  it('dayOfNextMonth devolve o dia pedido do mês seguinte, limitado ao último dia', () => {
    expect(dayOfNextMonth('2026-11-11', 3)).toBe('2026-12-03');
    expect(dayOfNextMonth('2026-12-20', 15)).toBe('2027-01-15');
    expect(dayOfNextMonth('2027-01-31', 30)).toBe('2027-02-28');
  });
});
