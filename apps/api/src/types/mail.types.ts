export type Mail = { to: string; subject: string; text: string; html: string };

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export type LinkData = { nome: string; link: string };

export type NovoLeadData = {
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  tipoImovel: string;
  preferenciaContato: string;
  plano: string;
  descricao: string;
  engenheiro: string;
};

export type NovaCandidaturaData = { nome: string; email: string; telefone: string; cidade: string; area: string };
export type DiagnosticoRecebidoData = { nome: string; loginUrl: string };
export type AgendamentoData = {
  nome: string;
  acao: 'criado' | 'atualizado';
  servico: string;
  imovel: string;
  data: string;
  hora: string;
  status: string;
  link: string;
};

export type TemplateDataMap = {
  convite: LinkData;
  redefinicao: LinkData;
  'novo-lead': NovoLeadData;
  'nova-candidatura': NovaCandidaturaData;
  'diagnostico-recebido': DiagnosticoRecebidoData;
  agendamento: AgendamentoData;
};

export type TemplateName = keyof TemplateDataMap;

export type EmailBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'fields'; items: [label: string, value: string][] };
export type EmailContent = { subject: string; blocks: EmailBlock[] };
export type EmailTemplate<N extends TemplateName> = (data: TemplateDataMap[N]) => EmailContent;
export type MemoryMailer = Mailer & { sent: Mail[]; failNext(times: number): void };
