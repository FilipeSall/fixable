import { describe, expect, it } from 'vitest';
import { firstFreeSpot, floorplanFor, overlaps } from '../../src/services/floorplan.service.ts';

describe('floorplanFor', () => {
  it('sobrado tem dois andares com cinco cômodos cada', () => {
    const andares = floorplanFor('sobrado');
    expect(andares.map((andar) => andar.nome)).toEqual(['Andar 1', 'Andar 2']);
    expect(andares[0]!.comodos).toHaveLength(5);
    expect(andares[1]!.comodos).toHaveLength(5);
    expect(andares[0]!.comodos[0]).toEqual({ nome: 'Sala de estar', largura: 3, altura: 2 });
  });

  it('empresa tem o escritório 4x2', () => {
    expect(floorplanFor('empresa')[0]!.comodos[1]).toEqual({ nome: 'Escritório', largura: 4, altura: 2 });
  });

  it('apartamento tem um andar com seis cômodos', () => {
    const andares = floorplanFor('apartamento');
    expect(andares).toHaveLength(1);
    expect(andares[0]!.comodos.map((comodo) => comodo.nome)).toEqual([
      'Sala',
      'Cozinha',
      'Área de serviço',
      'Quarto 1',
      'Banheiro',
      'Quarto 2',
    ]);
  });

  it('casa térrea usa o caso padrão', () => {
    const andares = floorplanFor('casa_terrea');
    expect(andares).toHaveLength(1);
    expect(andares[0]!.comodos.at(-1)).toEqual({ nome: 'Banheiro', largura: 2, altura: 1 });
  });
});

describe('firstFreeSpot', () => {
  it('grade vazia devolve a origem', () => {
    expect(firstFreeSpot([], 3, 2)).toEqual({ x: 0, y: 0 });
  });

  it('cômodo 2x1 vai ao lado de uma sala 3x2', () => {
    expect(firstFreeSpot([{ x: 0, y: 0, largura: 3, altura: 2 }], 2, 1)).toEqual({ x: 3, y: 0 });
  });

  it('cômodo 4x1 desce de linha quando só sobram 3 colunas', () => {
    expect(firstFreeSpot([{ x: 0, y: 0, largura: 3, altura: 1 }], 4, 1)).toEqual({ x: 0, y: 1 });
  });

  it('aproveita o vão abaixo de um cômodo mais baixo', () => {
    const ocupados = [
      { x: 0, y: 0, largura: 3, altura: 2 },
      { x: 3, y: 0, largura: 3, altura: 1 },
    ];
    expect(firstFreeSpot(ocupados, 2, 1)).toEqual({ x: 3, y: 1 });
  });
});

describe('overlaps', () => {
  const base = { x: 0, y: 0, largura: 3, altura: 2 };

  it('bordas encostadas não se sobrepõem', () => {
    expect(overlaps(base, { x: 3, y: 0, largura: 2, altura: 1 })).toBe(false);
    expect(overlaps(base, { x: 0, y: 2, largura: 2, altura: 1 })).toBe(false);
  });

  it('áreas que se cruzam se sobrepõem', () => {
    expect(overlaps(base, { x: 2, y: 1, largura: 2, altura: 1 })).toBe(true);
  });
});
