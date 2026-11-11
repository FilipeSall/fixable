import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationForm } from './ApplicationForm.tsx';

afterEach(() => vi.unstubAllGlobals());

describe('ApplicationForm', () => {
  it('o formulário usa method="post" para não levar os dados à URL se enviado antes da hidratação', () => {
    const { container } = render(<ApplicationForm />);
    expect(container.querySelector('form')).toHaveAttribute('method', 'post');
  });

  it('enviar vazio mostra os erros e não chama fetch', async () => {
    const fn = vi.fn();
    vi.stubGlobal('fetch', fn);
    const user = userEvent.setup();
    render(<ApplicationForm />);
    await user.click(screen.getByRole('button', { name: 'Fazer meu cadastro' }));
    expect(screen.getByText('Selecione sua área de atuação.')).toBeInTheDocument();
    expect(screen.getByText('Aceite os termos de uso e a política de privacidade para continuar.')).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });

  it('candidatura válida mostra "Cadastro recebido."', async () => {
    const fn = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fn);
    const user = userEvent.setup();
    render(<ApplicationForm />);
    await user.type(screen.getByLabelText('Nome completo'), 'João Engenheiro');
    await user.type(screen.getByLabelText('E-mail'), 'joao@exemplo.com');
    await user.type(screen.getByLabelText('Telefone'), '11 98888-7777');
    await user.type(screen.getByLabelText('Cidade'), 'Santos');
    await user.click(screen.getByRole('combobox', { name: 'Área de atuação' }));
    await user.click(screen.getByRole('option', { name: 'Engenheiro' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Fazer meu cadastro' }));
    expect(await screen.findByText('Cadastro recebido.')).toBeInTheDocument();
    expect(document.querySelector('.form-success .ic svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('A equipe Fixable vai analisar sua candidatura e entrar em contato pelo e-mail informado.')).toBeInTheDocument();
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/public/applications');
    expect(JSON.parse(init.body as string)).toMatchObject({ telefone: '11988887777', area: 'engenheiro', aceiteTermos: true });
    expect(screen.queryByRole('button', { name: 'Enviar outra solicitação' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enviar outro cadastro' }));
    expect(screen.getByLabelText('Nome completo')).toHaveValue('');
  });
});
