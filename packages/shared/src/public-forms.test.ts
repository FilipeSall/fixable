import { describe, expect, it } from 'vitest';
import { planName } from './catalog.ts';
import { applicationInput, diagnosticInput } from './public-forms.ts';

const valido = {
  nome: '  Ana Souza ',
  email: ' Ana@Ex.com ',
  telefone: '(11) 90000-0000',
  cidade: 'Santo André',
  tipoImovel: 'sobrado',
  preferenciaContato: 'whatsapp',
  plano: '3m',
  aceiteTermos: true,
};

const mensagem = (resultado: { error?: { issues: { message: string }[] } }) => resultado.error?.issues[0]?.message;

describe('diagnosticInput', () => {
  it('aceita o envio válido e normaliza', () => {
    const dados = diagnosticInput.parse(valido);
    expect(dados.nome).toBe('Ana Souza');
    expect(dados.email).toBe('ana@ex.com');
    expect(dados.telefone).toBe('11900000000');
  });
  it.each(['1234-5678', '+55 (11) 90000-00000'])('telefone %s falha', (telefone) => {
    expect(mensagem(diagnosticInput.safeParse({ ...valido, telefone }))).toBe('Informe um telefone válido.');
  });
  it('nome com 2 letras falha', () => {
    expect(mensagem(diagnosticInput.safeParse({ ...valido, nome: 'An' }))).toBe('Informe seu nome completo.');
  });
  it.each([
    ['tipoImovel', '', 'Selecione o tipo de imóvel.'],
    ['tipoImovel', undefined, 'Selecione o tipo de imóvel.'],
    ['preferenciaContato', '', 'Selecione a preferência de contato.'],
    ['preferenciaContato', undefined, 'Selecione a preferência de contato.'],
  ])('%s %j falha', (campo, valor, esperado) => {
    expect(mensagem(diagnosticInput.safeParse({ ...valido, [campo]: valor }))).toBe(esperado);
  });
  it.each([false, undefined])('aceiteTermos %j falha', (aceiteTermos) => {
    expect(mensagem(diagnosticInput.safeParse({ ...valido, aceiteTermos }))).toBe(
      'Aceite os termos de uso e a política de privacidade para continuar.',
    );
  });
  it('plano desconhecido falha', () => {
    expect(diagnosticInput.safeParse({ ...valido, plano: '99m' }).success).toBe(false);
  });
  it('descricao vazia vira undefined', () => {
    expect(diagnosticInput.parse({ ...valido, descricao: '  ' }).descricao).toBeUndefined();
  });
  it('website aceita qualquer texto até 200 caracteres', () => {
    expect(diagnosticInput.safeParse({ ...valido, website: 'x'.repeat(200) }).success).toBe(true);
    expect(diagnosticInput.safeParse({ ...valido, website: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('applicationInput', () => {
  const candidatura = {
    nome: 'Ana Souza',
    email: 'ana@ex.com',
    telefone: '11900000000',
    cidade: 'Santo André',
    area: 'engenheiro',
    aceiteTermos: true,
  };
  it('aceita o envio válido', () => {
    expect(applicationInput.safeParse(candidatura).success).toBe(true);
  });
  it.each(['', undefined])('area %j falha', (area) => {
    expect(mensagem(applicationInput.safeParse({ ...candidatura, area }))).toBe('Selecione sua área de atuação.');
  });
});

describe('planName', () => {
  it('devolve o nome do plano', () => {
    expect(planName('12m')).toBe('Plano anual');
  });
});
