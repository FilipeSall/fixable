import type { DemoAccountSeed, DemoApplicationSeed, DemoClientSeed, DemoLeadSeed } from '../types/demo.types.ts';

export const DEMO_TIME_ZONE = 'America/Sao_Paulo';

export const DEMO_ADMIN: DemoAccountSeed = {
  nome: 'Administração Fixable',
  email: 'admin.demo@fixable.com.br',
  role: 'admin',
  telefone: null,
  cidade: 'São Paulo',
  descricao: 'Acompanha os leads de diagnóstico, as candidaturas e a equipe.',
};

export const DEMO_ENGINEER: DemoAccountSeed = {
  nome: 'Rafael Lima',
  email: 'rafael.demo@fixable.com.br',
  role: 'engenheiro',
  telefone: '(11) 98811-2200',
  cidade: 'São Paulo',
  descricao: 'Engenheiro responsável pelos três clientes da demonstração.',
};

const ANA: DemoClientSeed = {
  nome: 'Ana Souza',
  email: 'ana.demo@fixable.com.br',
  role: 'cliente',
  telefone: '(11) 99654-1020',
  cidade: 'São Paulo',
  descricao: 'Sobrado de dois andares na Vila Mariana, com serviços em andamento.',
  clienteHaDias: 90,
  imovel: { tipo: 'sobrado', cidade: 'São Paulo', apelido: 'Sobrado · Vila Mariana' },
  diagnostico: {
    descricao: 'Disjuntor desarmando, fissuras na sala e mancha de umidade no box da suíte.',
    preferenciaContato: 'whatsapp',
    plano: '12m',
  },
  residencia: [
    ['Tipo de imóvel', 'Sobrado'],
    ['Endereço', 'Rua das Acácias, 214 — Vila Mariana'],
    ['Cidade', 'São Paulo'],
    ['Telefone', '(11) 99654-1020'],
    ['E-mail', 'ana.demo@fixable.com.br'],
    ['Preferência de contato', 'WhatsApp'],
    ['Área construída', '186 m²'],
    ['Ano de construção', '2004'],
    ['Plano contratado', 'Plano anual'],
  ],
  servicos: [
    {
      titulo: 'Adequação do quadro elétrico',
      descricao: 'Quadro antigo com fusíveis e sem DR. Substituição completa em andamento.',
      status: 'prioridade',
      andar: 0,
      comodo: 'Área de serviço',
      percentual: 45,
      prazoEmDias: 9,
    },
    {
      titulo: 'Pintura da sala de estar',
      descricao: 'Tratamento de fissuras e pintura acetinada.',
      status: 'execucao',
      andar: 0,
      comodo: 'Sala de estar',
      percentual: 10,
      prazoEmDias: 17,
    },
    {
      titulo: 'Infiltração no box da suíte',
      descricao: 'Rejunte comprometido. Avaliar impermeabilização antes de nova pintura.',
      status: 'atencao',
      andar: 1,
      comodo: 'Suíte',
      percentual: 0,
      prazoEmDias: 29,
    },
    {
      titulo: 'Desentupimento do lavabo',
      descricao: 'Desobstrução da caixa sifonada.',
      status: 'concluido',
      andar: 0,
      comodo: 'Lavabo',
      percentual: 100,
      prazoEmDias: -46,
      concluidoHaHoras: 47 * 24,
    },
    {
      titulo: 'Limpeza das calhas da varanda',
      descricao: 'Remoção de folhas e teste de escoamento das calhas.',
      status: 'concluido',
      andar: 1,
      comodo: 'Varanda',
      percentual: 100,
      prazoEmDias: -20,
      concluidoHaHoras: 21 * 24,
    },
  ],
  solicitacoes: [
    { descricao: 'Diagnóstico geral do sobrado', status: 'concluido', diasAtras: 88 },
    { descricao: 'Disjuntor desarmando ao ligar o chuveiro', status: 'em_execucao', diasAtras: 14 },
    { descricao: 'Pintar sala e parede da escada', status: 'agendado', diasAtras: 8 },
    { descricao: 'Mancha de umidade no box da suíte', status: 'em_analise', diasAtras: 4 },
  ],
  agendamentos: [
    {
      servico: 'Montagem do novo quadro elétrico',
      quando: { mes: 'atual', deslocamentoDias: 1 },
      hora: '08:30',
      status: 'confirmado',
      descricao: 'Desmontagem do quadro antigo e montagem do novo quadro com DR.',
    },
    {
      servico: 'Pintura — primeira demão',
      quando: { mes: 'atual', deslocamentoDias: 6 },
      hora: '08:00',
      status: 'confirmado',
      descricao: 'Proteção do piso, correção de fissuras e primeira demão.',
    },
    {
      servico: 'Testes e entrega do quadro',
      quando: { mes: 'atual', deslocamentoDias: 8 },
      hora: '09:00',
      status: 'pendente',
      descricao: 'Teste de todos os circuitos, identificação e entrega do laudo.',
    },
    {
      servico: 'Avaliação da infiltração do box',
      quando: { mes: 'proximo', dia: 3 },
      hora: '14:00',
      status: 'adiado',
      descricao: 'Inspeção do rejunte e teste de estanqueidade do box.',
    },
    {
      servico: 'Revisão semestral — ar-condicionado',
      quando: { mes: 'proximo', dia: 15 },
      hora: '10:00',
      status: 'pendente',
      descricao: 'Higienização dos 3 splits e verificação de dreno.',
    },
  ],
};

const CARLOS: DemoClientSeed = {
  nome: 'Carlos Mendes',
  email: 'carlos.demo@fixable.com.br',
  role: 'cliente',
  telefone: '(11) 97412-3388',
  cidade: 'São Paulo',
  descricao: 'Apartamento na Pompeia, com um serviço concluído há poucas horas.',
  clienteHaDias: 40,
  imovel: { tipo: 'apartamento', cidade: 'São Paulo', apelido: 'Apartamento · Pompeia' },
  diagnostico: {
    descricao: 'Vazamento constante embaixo da pia da cozinha.',
    preferenciaContato: 'telefone',
    plano: '3m',
  },
  residencia: [
    ['Tipo de imóvel', 'Apartamento'],
    ['Endereço', 'Av. Pompeia, 1550, ap. 82'],
    ['Cidade', 'São Paulo'],
    ['Telefone', '(11) 97412-3388'],
    ['E-mail', 'carlos.demo@fixable.com.br'],
    ['Preferência de contato', 'Telefone'],
    ['Plano contratado', 'Plano para 3 meses'],
  ],
  servicos: [
    {
      titulo: 'Vazamento na pia',
      descricao: 'Troca de sifão e flexíveis.',
      status: 'execucao',
      andar: 0,
      comodo: 'Cozinha',
      percentual: 70,
      prazoEmDias: 1,
    },
    {
      titulo: 'Tomada aquecendo no quarto',
      descricao: 'Verificar aperto de bornes e capacidade do circuito.',
      status: 'atencao',
      andar: 0,
      comodo: 'Quarto 1',
      percentual: 0,
      prazoEmDias: 24,
    },
    {
      titulo: 'Troca do chuveiro do banheiro',
      descricao: 'Chuveiro novo instalado e circuito testado.',
      status: 'concluido',
      andar: 0,
      comodo: 'Banheiro',
      percentual: 100,
      prazoEmDias: 0,
      concluidoHaHoras: 5,
    },
  ],
  solicitacoes: [
    { descricao: 'Vazamento embaixo da pia', status: 'em_execucao', diasAtras: 9 },
    { descricao: 'Tomada do quarto esquentando', status: 'em_analise', diasAtras: 2 },
  ],
  agendamentos: [
    {
      servico: 'Troca do sifão e flexíveis',
      quando: { mes: 'atual', deslocamentoDias: -2 },
      hora: '15:00',
      status: 'confirmado',
      descricao: 'Troca de peças e teste de estanqueidade.',
    },
    {
      servico: 'Verificação da tomada do quarto',
      quando: { mes: 'atual', deslocamentoDias: 14 },
      hora: '10:30',
      status: 'pendente',
      descricao: 'Medição de temperatura e reaperto de conexões.',
    },
  ],
};

const JULIANA: DemoClientSeed = {
  nome: 'Juliana Prado',
  email: 'juliana.demo@fixable.com.br',
  role: 'cliente',
  telefone: '(11) 98120-7745',
  cidade: 'Santo André',
  descricao: 'Casa térrea recém-cadastrada, aguardando a visita de diagnóstico.',
  clienteHaDias: 5,
  imovel: { tipo: 'casa_terrea', cidade: 'Santo André', apelido: 'Casa térrea · Santo André' },
  diagnostico: {
    descricao: 'Manchas de umidade no quarto e disjuntor desarmando.',
    preferenciaContato: 'email',
    plano: null,
  },
  residencia: [
    ['Tipo de imóvel', 'Casa térrea'],
    ['Endereço', 'Rua Itambé, 77'],
    ['Cidade', 'Santo André'],
    ['Telefone', '(11) 98120-7745'],
    ['E-mail', 'juliana.demo@fixable.com.br'],
    ['Preferência de contato', 'E-mail'],
    ['Descrição do problema', 'Manchas de umidade no quarto e disjuntor desarmando.'],
  ],
  servicos: [],
  solicitacoes: [{ descricao: 'Diagnóstico inicial — Casa térrea', status: 'em_analise', diasAtras: 5 }],
  agendamentos: [
    {
      servico: 'Visita de diagnóstico inicial',
      quando: { mes: 'atual', deslocamentoDias: 0 },
      hora: '09:30',
      status: 'pendente',
      descricao: 'Visita do engenheiro para avaliar umidade e quadro elétrico.',
    },
  ],
};

export const DEMO_CLIENTS: DemoClientSeed[] = [ANA, CARLOS, JULIANA];

export const DEMO_ACCOUNTS: DemoAccountSeed[] = [DEMO_ADMIN, DEMO_ENGINEER, ...DEMO_CLIENTS];

export const DEMO_UNASSIGNED_LEADS: DemoLeadSeed[] = [
  {
    nome: 'Marina Costa',
    email: 'marina.costa.demo@fixable.com.br',
    telefone: '(11) 99231-4410',
    cidade: 'Guarulhos',
    tipoImovel: 'apartamento',
    descricao: 'Infiltração no teto do banheiro depois das chuvas.',
    preferenciaContato: 'whatsapp',
    plano: '6m',
    horasAtras: 20,
  },
  {
    nome: 'Roberto Almeida',
    email: 'roberto.almeida.demo@fixable.com.br',
    telefone: '(11) 98765-3301',
    cidade: 'São Bernardo do Campo',
    tipoImovel: 'empresa',
    descricao: 'Manutenção preventiva da parte elétrica e hidráulica do escritório.',
    preferenciaContato: 'telefone',
    plano: null,
    horasAtras: 3,
  },
];

export const DEMO_APPLICATIONS: DemoApplicationSeed[] = [
  {
    nome: 'Beatriz Fonseca',
    email: 'beatriz.fonseca.demo@fixable.com.br',
    telefone: '(11) 97733-1290',
    cidade: 'São Paulo',
    area: 'engenheiro',
    status: 'pendente',
    diasAtras: 2,
  },
  {
    nome: 'Marcos Ribeiro',
    email: 'marcos.ribeiro.demo@fixable.com.br',
    telefone: '(11) 94731-1067',
    cidade: 'São Paulo',
    area: 'outro',
    status: 'pendente',
    diasAtras: 1,
  },
  {
    nome: 'Paulo Andrade',
    email: 'paulo.andrade.demo@fixable.com.br',
    telefone: '(11) 95128-4470',
    cidade: 'São Paulo',
    area: 'outro',
    status: 'aprovada',
    diasAtras: 20,
  },
  {
    nome: 'Ricardo Nunes',
    email: 'ricardo.nunes.demo@fixable.com.br',
    telefone: '(11) 96402-8815',
    cidade: 'São Bernardo do Campo',
    area: 'outro',
    status: 'recusada',
    diasAtras: 12,
  },
];
