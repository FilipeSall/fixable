import { MAQUETE_COLUMNS, type PropertyType } from '@fixable/shared';
import type { Andar, Comodo, Ponto, Retangulo } from '../types/floorplan.types.ts';

/** Cria um cômodo da planta com nome e dimensões em módulos. */
const comodo = (nome: string, largura: number, altura: number): Comodo => ({ nome, largura, altura });

/** Gera a planta de exemplo do imóvel conforme o tipo, em andares e cômodos. */
export function floorplanFor(tipo: PropertyType): Andar[] {
  if (tipo === 'sobrado') {
    return [
      {
        nome: 'Andar 1',
        comodos: [
          comodo('Sala de estar', 3, 2),
          comodo('Cozinha', 2, 1),
          comodo('Lavabo', 1, 1),
          comodo('Área de serviço', 2, 1),
          comodo('Garagem', 1, 1),
        ],
      },
      {
        nome: 'Andar 2',
        comodos: [
          comodo('Suíte', 3, 2),
          comodo('Quarto 2', 2, 1),
          comodo('Banheiro', 1, 1),
          comodo('Escritório', 2, 1),
          comodo('Varanda', 1, 1),
        ],
      },
    ];
  }
  if (tipo === 'apartamento') {
    return [
      {
        nome: 'Andar 1',
        comodos: [
          comodo('Sala', 3, 2),
          comodo('Cozinha', 2, 1),
          comodo('Área de serviço', 1, 1),
          comodo('Quarto 1', 2, 1),
          comodo('Banheiro', 1, 1),
          comodo('Quarto 2', 3, 1),
        ],
      },
    ];
  }
  if (tipo === 'empresa') {
    return [
      {
        nome: 'Andar 1',
        comodos: [
          comodo('Recepção', 2, 1),
          comodo('Escritório', 4, 2),
          comodo('Copa', 2, 1),
          comodo('Banheiro', 1, 1),
          comodo('Depósito', 1, 1),
        ],
      },
    ];
  }
  return [
    {
      nome: 'Andar 1',
      comodos: [
        comodo('Sala', 3, 2),
        comodo('Cozinha', 2, 1),
        comodo('Área de serviço', 1, 1),
        comodo('Quarto 1', 2, 1),
        comodo('Quarto 2', 2, 1),
        comodo('Banheiro', 2, 1),
      ],
    },
  ];
}

/** Diz se dois retângulos da grade ocupam alguma célula em comum; bordas encostadas não contam. */
export function overlaps(a: Retangulo, b: Retangulo): boolean {
  return a.x < b.x + b.largura && b.x < a.x + a.largura && a.y < b.y + b.altura && b.y < a.y + a.altura;
}

/** Acha a primeira posição livre, varrendo linha a linha e coluna a coluna; recusa tamanho que não cabe na grade. */
export function firstFreeSpot(ocupados: Retangulo[], largura: number, altura: number): Ponto {
  if (!Number.isInteger(largura) || largura < 1 || largura > MAQUETE_COLUMNS) {
    throw new RangeError(`largura do cômodo fora da grade: ${largura}`);
  }
  if (!Number.isInteger(altura) || altura < 1) throw new RangeError(`altura do cômodo inválida: ${altura}`);
  for (let y = 0; ; y++) {
    for (let x = 0; x + largura <= MAQUETE_COLUMNS; x++) {
      const candidato = { x, y, largura, altura };
      if (!ocupados.some((outro) => overlaps(candidato, outro))) return { x, y };
    }
  }
}
