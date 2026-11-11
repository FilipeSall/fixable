import type {
  ApplicationArea,
  ApplicationStatus,
  AppointmentStatus,
  ContactPreference,
  PlanId,
  PropertyType,
  Role,
  ServiceRequestStatus,
  ServiceStatus,
} from '@fixable/shared';
import type { Config } from './config.types.ts';
import type { Db } from './db.types.ts';

export type DemoServiceSeed = {
  titulo: string;
  descricao: string;
  status: ServiceStatus;
  andar: number;
  comodo: string;
  percentual: number;
  prazoEmDias: number | null;
  concluidoHaHoras?: number;
};

export type DemoRequestSeed = { descricao: string; status: ServiceRequestStatus; diasAtras: number };

export type DemoAppointmentDate = { mes: 'atual'; deslocamentoDias: number } | { mes: 'proximo'; dia: number };

export type DemoAppointmentSeed = {
  servico: string;
  quando: DemoAppointmentDate;
  hora: string;
  status: AppointmentStatus;
  descricao: string;
};

export type DemoAccountSeed = {
  nome: string;
  email: string;
  role: Role;
  telefone: string | null;
  cidade: string | null;
  descricao: string;
};

export type DemoDiagnosticSeed = {
  descricao: string;
  preferenciaContato: ContactPreference;
  plano: PlanId | null;
};

export type DemoLeadSeed = DemoDiagnosticSeed & {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  tipoImovel: PropertyType;
  horasAtras: number;
};

export type DemoApplicationSeed = {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  area: ApplicationArea;
  status: ApplicationStatus;
  diasAtras: number;
};

export type DemoClientSeed = DemoAccountSeed & {
  role: 'cliente';
  telefone: string;
  clienteHaDias: number;
  imovel: { tipo: PropertyType; cidade: string; apelido: string };
  diagnostico: DemoDiagnosticSeed;
  residencia: [chave: string, valor: string][];
  servicos: DemoServiceSeed[];
  solicitacoes: DemoRequestSeed[];
  agendamentos: DemoAppointmentSeed[];
};

export type DemoSeedSummary = {
  usuarios: number;
  clientes: number;
  servicos: number;
  solicitacoes: number;
  agendamentos: number;
  leads: number;
  candidaturas: number;
};

export type DemoConfig = Pick<Config, 'DEMO_MODE'>;

export type DemoDeps = { db: Db; config: DemoConfig };
