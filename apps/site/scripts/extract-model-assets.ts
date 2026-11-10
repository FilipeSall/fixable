import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const SITE_DIR = resolve(import.meta.dirname, '..');
const MODEL_PATH = resolve(SITE_DIR, '../../docs/referencia/modelo-4-plataforma.html');
const HERO_PATH = resolve(SITE_DIR, 'src/assets/hero.webp');
const SPRITE_PATH = resolve(SITE_DIR, 'src/icons/sprite.svg');
const MIN_SYMBOLS = 30;
const WEBP_PATTERN = /data:image\/webp;base64,([A-Za-z0-9+/=]+)/g;
const SYMBOL_PATTERN = /<symbol id="fx4-[\w-]+"[^>]*>.*?<\/symbol>/gs;

/** Extrai a única foto WebP embutida no modelo, que vira a imagem do hero do site. */
function extractHero(html: string): Buffer {
  const matches = [...html.matchAll(WEBP_PATTERN)];
  const base64 = matches[0]?.[1];
  if (matches.length !== 1 || !base64) {
    throw new Error(`Esperava exatamente 1 imagem WebP no modelo e encontrei ${matches.length}.`);
  }
  return Buffer.from(base64, 'base64');
}

/** Junta os símbolos fx4-* do modelo num sprite SVG, que o componente Icon lê no build. */
function extractSymbols(html: string): string[] {
  const symbols = [...html.matchAll(SYMBOL_PATTERN)].map(([symbol]) => symbol);
  if (symbols.length < MIN_SYMBOLS) {
    throw new Error(`Esperava pelo menos ${MIN_SYMBOLS} símbolos fx4-* no modelo e encontrei ${symbols.length}.`);
  }
  return symbols;
}

/** Grava um arquivo de saída criando a pasta antes, para o script rodar num checkout limpo. */
function writeOutput(path: string, data: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(`gravado ${relative(SITE_DIR, path)} (${Buffer.byteLength(data)} bytes)`);
}

const html = readFileSync(MODEL_PATH, 'utf8');
const symbols = extractSymbols(html);
writeOutput(HERO_PATH, extractHero(html));
writeOutput(SPRITE_PATH, `<svg xmlns="http://www.w3.org/2000/svg">\n${symbols.join('\n')}\n</svg>\n`);
console.log(`${symbols.length} símbolos no sprite`);
