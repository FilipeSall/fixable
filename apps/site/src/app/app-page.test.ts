import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FRONTMATTER = /^---[\s\S]*?---\s*/;
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

function pageDocument(): Document {
  const source = readFileSync(join(SRC, 'pages/app/index.astro'), 'utf8');
  return new DOMParser().parseFromString(source.replace(FRONTMATTER, ''), 'text/html');
}

describe('página /app', () => {
  it('força o tema claro, mesmo com o sistema no modo escuro', () => {
    expect(pageDocument().documentElement.dataset['theme']).toBe('light');
  });

  it('o tema escuro dos tokens só vale quando a página não força o claro', () => {
    const tokens = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
    expect(tokens).toContain(":root:not([data-theme='light'])");
  });
});
