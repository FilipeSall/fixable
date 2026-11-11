import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, type ReactElement } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationForm } from './ApplicationForm.tsx';
import { DiagnosticForm } from './DiagnosticForm.tsx';

const roots: Root[] = [];

const serverHtml = (element: ReactElement) => {
  const container = document.createElement('div');
  container.innerHTML = renderToString(element);
  document.body.appendChild(container);
  return container;
};

const hydrate = (container: HTMLElement, element: ReactElement) => {
  act(() => {
    roots.push(hydrateRoot(container, element));
  });
};

const field = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const typeBeforeHydration = (values: Record<string, string>) => {
  for (const [id, value] of Object.entries(values)) {
    field<HTMLInputElement>(id).value = value;
  }
};

beforeEach(() => window.history.pushState({}, '', '/'));

afterEach(() => {
  act(() => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('formulários públicos digitados antes da hidratação', () => {
  it('o HTML do servidor traz o botão de envio desabilitado, e a hidratação o habilita', () => {
    const container = serverHtml(<DiagnosticForm />);
    const button = () => screen.getByRole('button', { name: 'Solicitar diagnóstico' });
    expect(button()).toBeDisabled();
    hydrate(container, <DiagnosticForm />);
    expect(button()).toBeEnabled();
  });

  it('o diagnóstico mantém nome, tipo, aceite e honeypot preenchidos antes da hidratação e os envia', async () => {
    const fn = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal('fetch', fn);
    const container = serverHtml(<DiagnosticForm cidadeInicial="Santo André" />);
    typeBeforeHydration({
      'd-nome': 'Maria Souza',
      'd-tipoImovel': 'sobrado',
      'd-website': 'robo',
    });
    field<HTMLInputElement>('d-aceiteTermos').checked = true;
    hydrate(container, <DiagnosticForm cidadeInicial="Santo André" />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('E-mail'), 'maria@exemplo.com');
    expect(screen.getByLabelText('Nome completo')).toHaveValue('Maria Souza');
    expect(screen.getByLabelText('Tipo de imóvel')).toHaveValue('sobrado');
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(field<HTMLInputElement>('d-website')).toHaveValue('robo');

    await user.type(screen.getByLabelText('Telefone'), '(11) 90000-0000');
    await user.selectOptions(screen.getByLabelText('Preferência de contato'), 'WhatsApp');
    await user.click(screen.getByRole('button', { name: 'Solicitar diagnóstico' }));
    await screen.findByText('Solicitação registrada.');
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      nome: 'Maria Souza',
      cidade: 'Santo André',
      tipoImovel: 'sobrado',
      aceiteTermos: true,
      website: 'robo',
    });
  });

  it('com ?plano=3m o nome digitado antes da hidratação continua depois da troca do plano', async () => {
    window.history.pushState({}, '', '/?plano=3m');
    const container = serverHtml(<DiagnosticForm />);
    typeBeforeHydration({ 'd-nome': 'Maria Souza' });
    hydrate(container, <DiagnosticForm />);
    await waitFor(() => expect(screen.getByText('Plano para 3 meses')).toBeInTheDocument());
    expect(screen.getByLabelText('Nome completo')).toHaveValue('Maria Souza');
    await userEvent.setup().type(screen.getByLabelText('E-mail'), 'maria@exemplo.com');
    expect(screen.getByLabelText('Nome completo')).toHaveValue('Maria Souza');
  });

  it('a candidatura mantém nome e área digitados antes da hidratação', async () => {
    const container = serverHtml(<ApplicationForm />);
    typeBeforeHydration({ 't-nome': 'João Engenheiro', 't-area': 'engenheiro' });
    hydrate(container, <ApplicationForm />);
    await userEvent.setup().type(screen.getByLabelText('E-mail'), 'joao@exemplo.com');
    expect(screen.getByLabelText('Nome completo')).toHaveValue('João Engenheiro');
    expect(screen.getByLabelText('Área de atuação')).toHaveValue('engenheiro');
  });
});
