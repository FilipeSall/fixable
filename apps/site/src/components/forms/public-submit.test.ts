import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitPublicForm } from './public-submit.ts';

const mockFetch = (response: Response | Error) => {
  const fn = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  vi.stubGlobal('fetch', fn);
  return fn;
};

afterEach(() => vi.unstubAllGlobals());

describe('submitPublicForm', () => {
  it('204 devolve ok e envia JSON com credentials same-origin', async () => {
    const fn = mockFetch(new Response(null, { status: 204 }));
    await expect(submitPublicForm('/api/x', { a: 1 })).resolves.toEqual({ ok: true });
    expect(fn).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin', body: '{"a":1}' }),
    );
  });

  it('400 devolve os fields da API e a mensagem fixa', async () => {
    mockFetch(Response.json({ error: { code: 'x', message: 'm', fields: { nome: 'Informe seu nome completo.' } } }, { status: 400 }));
    await expect(submitPublicForm('/api/x', {})).resolves.toEqual({
      ok: false,
      fields: { nome: 'Informe seu nome completo.' },
      message: 'Confira os campos destacados.',
    });
  });

  it('400 com corpo ilegível não quebra', async () => {
    mockFetch(new Response('oops', { status: 400 }));
    await expect(submitPublicForm('/api/x', {})).resolves.toEqual({
      ok: false,
      fields: undefined,
      message: 'Confira os campos destacados.',
    });
  });

  it('429 devolve a mensagem de excesso de tentativas', async () => {
    mockFetch(new Response(null, { status: 429 }));
    await expect(submitPublicForm('/api/x', {})).resolves.toEqual({
      ok: false,
      message: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
    });
  });

  it('5xx e erro de rede devolvem a mensagem genérica', async () => {
    const generic = { ok: false, message: 'Não foi possível enviar agora. Tente de novo em instantes.' };
    mockFetch(new Response(null, { status: 500 }));
    await expect(submitPublicForm('/api/x', {})).resolves.toEqual(generic);
    mockFetch(new TypeError('network'));
    await expect(submitPublicForm('/api/x', {})).resolves.toEqual(generic);
  });
});
