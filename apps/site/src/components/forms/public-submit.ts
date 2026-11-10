import type { SubmitResult } from '../../types/public-forms.types.ts';

const INVALID_MESSAGE = 'Confira os campos destacados.';
const RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
const GENERIC_MESSAGE = 'Não foi possível enviar agora. Tente de novo em instantes.';

/** Lê os erros por campo do corpo de um 400 da API, ignorando formatos inesperados. */
async function readFieldErrors(response: Response): Promise<Record<string, string> | undefined> {
  try {
    const body = (await response.json()) as { error?: { fields?: Record<string, string> } };
    return body.error?.fields;
  } catch {
    return undefined;
  }
}

/** Envia o formulário público em JSON e converte a resposta da API em um resultado tipado. */
export async function submitPublicForm(url: string, body: unknown): Promise<SubmitResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 204) return { ok: true };
    if (response.status === 400) return { ok: false, fields: await readFieldErrors(response), message: INVALID_MESSAGE };
    if (response.status === 429) return { ok: false, message: RATE_LIMIT_MESSAGE };
    return { ok: false, message: GENERIC_MESSAGE };
  } catch {
    return { ok: false, message: GENERIC_MESSAGE };
  }
}
