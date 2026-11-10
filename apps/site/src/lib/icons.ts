import sprite from '../icons/sprite.svg?raw';
import type { IconSymbol } from '../types/site.types.ts';

const ICON_NAME = /^[a-z0-9-]+$/;

/** Lê os atributos de uma tag SVG, para o ícone inline herdar viewBox e traço do símbolo. */
export function parseAttributes(source: string): Record<string, string> {
  const parts = source.split('"');
  const attributes: Record<string, string> = {};
  for (let index = 0; index + 1 < parts.length; index += 2) {
    const name = (parts[index] ?? '').trim();
    if (name.endsWith('=')) attributes[name.slice(0, -1)] = parts[index + 1] ?? '';
  }
  return attributes;
}

/** Busca no sprite do modelo o símbolo fx4-{nome} e falha o build se o ícone não existir. */
export function iconSymbol(name: string): IconSymbol {
  if (!ICON_NAME.test(name)) throw new Error(`Nome de ícone inválido: ${name}`);
  const open = `<symbol id="fx4-${name}"`;
  const start = sprite.indexOf(open);
  if (start < 0) throw new Error(`O ícone fx4-${name} não existe no sprite.`);
  const tagEnd = sprite.indexOf('>', start);
  const end = sprite.indexOf('</symbol>', tagEnd);
  return { attributes: parseAttributes(sprite.slice(start + open.length, tagEnd)), body: sprite.slice(tagEnd + 1, end) };
}
