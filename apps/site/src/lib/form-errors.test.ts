import { describe, expect, it } from 'vitest';
import { fieldErrorsOf } from './form-errors.ts';

describe('fieldErrorsOf', () => {
  it('fica com a primeira mensagem de cada campo e usa "form" quando não há caminho', () => {
    expect(
      fieldErrorsOf({
        issues: [
          { path: ['email'], message: 'Informe um e-mail válido.' },
          { path: ['email'], message: 'outra' },
          { path: [], message: 'geral' },
        ],
      }),
    ).toEqual({ email: 'Informe um e-mail válido.', form: 'geral' });
  });
});
