import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import './index.ts';

describe('mensagens padrão do zod', () => {
  it('saem em português ao importar o pacote compartilhado', () => {
    const message = z.string().min(1).safeParse('').error?.issues[0]?.message ?? '';
    expect(message).not.toContain('Too small');
    expect(message).toMatch(/pequeno demais/i);
  });
});
