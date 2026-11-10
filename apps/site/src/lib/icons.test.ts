import { describe, expect, it } from 'vitest';
import { iconSymbol, parseAttributes } from './icons.ts';

describe('parseAttributes', () => {
  it('lê os pares nome="valor" da tag', () => {
    expect(parseAttributes(' viewBox="0 0 24 24" fill="none" stroke-width="1.25"')).toEqual({
      viewBox: '0 0 24 24',
      fill: 'none',
      'stroke-width': '1.25',
    });
  });
});

describe('iconSymbol', () => {
  it('devolve os atributos e o corpo do símbolo fx4 do sprite', () => {
    const { attributes, body } = iconSymbol('electric');
    expect(attributes).toMatchObject({ viewBox: '0 0 24 24', stroke: 'currentColor' });
    expect(attributes).not.toHaveProperty('id');
    expect(body).toMatch(/^<path /);
    expect(body).not.toContain('</symbol>');
  });

  it('falha para ícone inexistente ou nome inválido', () => {
    expect(() => iconSymbol('nao-existe')).toThrow('fx4-nao-existe');
    expect(() => iconSymbol('../x')).toThrow('inválido');
  });
});
