import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>(['./*.ts', './*.tsx', '!./*.test.*'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('ilhas dos formulários públicos', () => {
  it('não importam código da SPA em src/app', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
    const offenders = Object.entries(sources)
      .filter(([, source]) => /from '[^']*\/app\//.test(source))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
