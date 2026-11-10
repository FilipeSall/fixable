import type { PropertyType } from '@fixable/shared';

type Comodo = { nome: string; largura: number; altura: number };
type Andar = { nome: string; comodos: Comodo[] };

const comodo = (nome: string, largura: number, altura: number): Comodo => ({ nome, largura, altura });

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
