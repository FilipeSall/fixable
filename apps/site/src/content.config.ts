import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import { PLANS } from '@fixable/shared';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const texto = z.string().trim().min(1);
const ordem = z.number().int().positive();

const pacotes = defineCollection({
  loader: file('src/content/pacotes.json'),
  schema: z.object({
    id: z.enum(PLANS.map(({ id }) => id)),
    nome: texto,
    preco: texto,
    descricao: texto,
    itens: z.array(texto).min(1),
    destaque: z.boolean(),
    ordem,
  }),
});

const faq = defineCollection({
  loader: file('src/content/faq.json'),
  schema: z.object({ id: slug, pergunta: texto, resposta: texto, ordem }),
});

const servicos = defineCollection({
  loader: file('src/content/servicos.json'),
  schema: z.object({ id: slug, nome: texto, busca: texto, descricao: texto, icone: slug, ordem }),
});

const cidades = defineCollection({
  loader: file('src/content/cidades.json'),
  schema: z.object({ id: slug, nome: texto, uf: z.string().regex(/^[A-Z]{2}$/) }),
});

export const collections = { pacotes, faq, servicos, cidades };
