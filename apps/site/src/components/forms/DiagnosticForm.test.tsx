import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagnosticForm } from './DiagnosticForm.tsx';

const mockFetch = (response: Response) => {
  const fn = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal('fetch', fn);
  return fn;
};

const fillValid = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Nome completo'), '  Maria Souza ');
  await user.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com');
  await user.type(screen.getByLabelText('Telefone'), '(11) 90000-0000');
  const cidade = screen.getByLabelText('Cidade');
  if (!(cidade as HTMLInputElement).value) await user.type(cidade, 'São Paulo');
  await user.selectOptions(screen.getByLabelText('Tipo de imóvel'), 'Sobrado');
  await user.selectOptions(screen.getByLabelText('Preferência de contato'), 'WhatsApp');
  await user.click(screen.getByRole('checkbox'));
};

beforeEach(() => window.history.pushState({}, '', '/'));
afterEach(() => vi.unstubAllGlobals());

describe('DiagnosticForm', () => {
  it('enviar vazio mostra os erros por campo e não chama fetch', async () => {
    const fn = mockFetch(new Response(null, { status: 204 }));
    const user = userEvent.setup();
    render(<DiagnosticForm />);
    await user.click(screen.getByRole('button', { name: 'Solicitar diagnóstico' }));
    expect(screen.getByText('Informe seu nome completo.')).toBeInTheDocument();
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('Informe um telefone válido.')).toBeInTheDocument();
    expect(screen.getByText('Informe sua cidade.')).toBeInTheDocument();
    expect(screen.getByText('Selecione o tipo de imóvel.')).toBeInTheDocument();
    expect(screen.getByText('Selecione a preferência de contato.')).toBeInTheDocument();
    const nome = screen.getByLabelText('Nome completo');
    expect(nome).toHaveAttribute('aria-describedby', 'd-nome-err');
    expect(nome).toHaveFocus();
    expect(fn).not.toHaveBeenCalled();
  });

  it('envio válido manda o corpo normalizado para /api/public/diagnostics e mostra "Solicitação registrada."', async () => {
    const fn = mockFetch(new Response(null, { status: 204 }));
    const user = userEvent.setup();
    render(<DiagnosticForm />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Solicitar diagnóstico' }));
    expect(await screen.findByText('Solicitação registrada.')).toBeInTheDocument();
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/public/diagnostics');
    expect(JSON.parse(init.body as string)).toMatchObject({
      nome: 'Maria Souza',
      email: 'maria@exemplo.com',
      telefone: '11900000000',
      cidade: 'São Paulo',
      tipoImovel: 'sobrado',
      preferenciaContato: 'whatsapp',
      aceiteTermos: true,
    });
    expect(JSON.parse(init.body as string)).not.toHaveProperty('plano');
    expect(screen.getByText(/Um engenheiro da Fixable vai entrar em contato/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar outra solicitação' }));
    expect(screen.getByLabelText('Nome completo')).toHaveValue('');
  });

  it('?plano=3m mostra o chip "Plano para 3 meses"; Remover tira o chip e o plano do corpo', async () => {
    window.history.pushState({}, '', '/?plano=3m');
    const fn = mockFetch(new Response(null, { status: 204 }));
    const user = userEvent.setup();
    render(<DiagnosticForm />);
    expect(await screen.findByText('Plano para 3 meses')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remover' }));
    expect(screen.queryByText('Plano para 3 meses')).not.toBeInTheDocument();
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Solicitar diagnóstico' }));
    await screen.findByText('Solicitação registrada.');
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty('plano');
  });

  it('?plano=3m envia o plano no corpo e limpa o chip após o sucesso', async () => {
    window.history.pushState({}, '', '/?plano=3m');
    const fn = mockFetch(new Response(null, { status: 204 }));
    const user = userEvent.setup();
    render(<DiagnosticForm />);
    await screen.findByText('Plano para 3 meses');
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Solicitar diagnóstico' }));
    await screen.findByText('Solicitação registrada.');
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ plano: '3m' });
    expect(screen.queryByText('Plano para 3 meses')).not.toBeInTheDocument();
  });

  it('?plano=xyz não mostra chip', () => {
    window.history.pushState({}, '', '/?plano=xyz');
    render(<DiagnosticForm />);
    expect(screen.queryByText(/Plano de interesse/)).not.toBeInTheDocument();
  });

  it('400 da API marca o campo devolvido em fields', async () => {
    mockFetch(Response.json({ error: { code: 'validation', message: 'x', fields: { email: 'Informe um e-mail válido.' } } }, { status: 400 }));
    const user = userEvent.setup();
    render(<DiagnosticForm />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Solicitar diagnóstico' }));
    await waitFor(() => expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('Confira os campos destacados.')).toBeInTheDocument();
  });

  it('429 mostra "Muitas tentativas..."', async () => {
    mockFetch(new Response(null, { status: 429 }));
    const user = userEvent.setup();
    render(<DiagnosticForm />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: 'Solicitar diagnóstico' }));
    expect(await screen.findByText('Muitas tentativas. Aguarde alguns minutos e tente de novo.')).toBeInTheDocument();
  });

  it('cidadeInicial preenche Cidade', () => {
    render(<DiagnosticForm cidadeInicial="Campinas" />);
    expect(screen.getByLabelText('Cidade')).toHaveValue('Campinas');
  });

  it('sem aceitar os termos mostra a mensagem de consentimento', async () => {
    const fn = mockFetch(new Response(null, { status: 204 }));
    const user = userEvent.setup();
    render(<DiagnosticForm />);
    await fillValid(user);
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Solicitar diagnóstico' }));
    expect(screen.getByText('Aceite os termos de uso e a política de privacidade para continuar.')).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });

  it('o honeypot website fica fora da tela e fora do foco', () => {
    render(<DiagnosticForm />);
    const honeypot = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(honeypot).toHaveAttribute('tabindex', '-1');
    expect(honeypot).toHaveAttribute('autocomplete', 'off');
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
