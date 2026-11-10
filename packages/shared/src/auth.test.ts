import { describe, expect, it } from 'vitest';
import { emailSchema, passwordSchema } from './auth.ts';

describe('emailSchema', () => {
  it('normaliza espaços e maiúsculas', () => {
    expect(emailSchema.parse('  Ana@Fixable.COM ')).toBe('ana@fixable.com');
  });
  it('rejeita e-mail inválido com a mensagem fixa', () => {
    expect(emailSchema.safeParse('ana@').error?.issues[0]?.message).toBe('Informe um e-mail válido.');
  });
});
describe('passwordSchema', () => {
  it.each([
    ['abc12', 'A senha precisa ter pelo menos 8 caracteres.'],
    ['abcdefgh', 'Use letras e números na senha.'],
    ['12345678', 'Use letras e números na senha.'],
  ])('rejeita %s', (senha, msg) => {
    expect(passwordSchema.safeParse(senha).error?.issues[0]?.message).toBe(msg);
  });
  it.each(['senha123', 'ção12345'])('aceita %s', (senha) => {
    expect(passwordSchema.safeParse(senha).success).toBe(true);
  });
});
