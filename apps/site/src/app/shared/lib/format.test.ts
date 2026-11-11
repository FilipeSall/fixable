import { describe, expect, it } from 'vitest';
import { firstName, formatDate, formatDateTime, initials } from './format.ts';

describe('format', () => {
  it('formata data ISO como dd/mm/aaaa', () => {
    expect(formatDate('2026-11-05')).toBe('05/11/2026');
  });

  it('devolve travessão para vazio ou inválido', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('xx')).toBe('—');
  });

  it('formata data e hora', () => {
    const local = new Date(2026, 10, 5, 9, 7).toISOString();
    expect(formatDateTime(local)).toBe('05/11/2026 às 09:07');
  });

  it('extrai primeiro nome e iniciais', () => {
    expect(firstName('  Ana Souza Lima ')).toBe('Ana');
    expect(initials('Ana Souza Lima')).toBe('AL');
    expect(initials('Rafael')).toBe('R');
  });
});
