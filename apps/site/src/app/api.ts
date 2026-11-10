import { apiErrorSchema } from '@fixable/shared';
import type { ErrorCode } from '@fixable/shared';

const GENERIC_MESSAGE = 'Algo deu errado. Tente de novo.';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: ErrorCode, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export interface ApiInit {
  method?: string;
  body?: unknown;
}

async function toRequestError(response: Response): Promise<ApiRequestError> {
  const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return new ApiRequestError(response.status, 'internal', GENERIC_MESSAGE);
  }
  const { code, message, fields } = parsed.data.error;
  return new ApiRequestError(response.status, code, message, fields);
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const response = await fetch(path, {
    method: init.method ?? 'GET',
    credentials: 'include',
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) throw await toRequestError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
