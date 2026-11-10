import { describe, expect, it } from 'vitest';
import { floorplanFor } from './floorplan-template.ts';

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
