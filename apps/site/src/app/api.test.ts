import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiFetch } from './api.ts';

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('devolve o JSON em 200', async () => {
    stubFetch(Response.json({ ok: true }));
    await expect(apiFetch('/api/x')).resolves.toEqual({ ok: true });
  });

  it('devolve undefined em 204', async () => {
    stubFetch(new Response(null, { status: 204 }));
    await expect(apiFetch('/api/x', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('lança ApiRequestError com status, code e fields a partir do corpo de erro', async () => {
    stubFetch(
      Response.json(
        { error: { code: 'validation', message: 'Dados inválidos.', fields: { email: 'Informe um e-mail válido.' } } },
        { status: 400 },
      ),
    );
    const error = await apiFetch('/api/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      status: 400,
      code: 'validation',
      message: 'Dados inválidos.',
      fields: { email: 'Informe um e-mail válido.' },
    });
  });

  it('corpo não-JSON vira ApiRequestError internal "Algo deu errado. Tente de novo."', async () => {
    stubFetch(new Response('<html>502</html>', { status: 502 }));
    const error = await apiFetch('/api/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 502, code: 'internal', message: 'Algo deu errado. Tente de novo.' });
  });

  it('envia credentials include e content-type json quando há body', async () => {
    const fetchMock = stubFetch(Response.json({}));
    await apiFetch('/api/x', { method: 'POST', body: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"a":1}');
  });

  it('não envia content-type sem body', async () => {
    const fetchMock = stubFetch(Response.json({}));
    await apiFetch('/api/x');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(init.headers).toBeUndefined();
  });
});
