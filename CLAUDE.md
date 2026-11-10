# Fixable — convenções do projeto

Monorepo pnpm: `apps/api` (Fastify + Drizzle + Postgres), `apps/site` (Astro + SPA React em `/app`) e `packages/shared` (Zod).
PRD: `docs/superpowers/specs/2026-11-09-plataforma-fixable.md`. Planos: `docs/superpowers/plans/`.

## Arquitetura (decidida pelo responsável do projeto)

- **Backend em MVC + services** (`apps/api/src`):
  - `routes/` só declaram a rota (schema, rate limit e preHandler);
  - `controllers/` tratam request e reply e não usam Drizzle;
  - `services/` têm a regra de negócio e as queries;
  - `models/` têm só as tabelas Drizzle (`*.model.ts`);
  - `views/emails/`, `middlewares/`, `mailers/`, `workers/`, `utils/`, `config/`, `db/`, `cli/` e `types/` completam a estrutura.
- **Testes da API** em `apps/api/tests/`, espelhando `src/`.
- **Interfaces e tipos em pastas `types/`** de cada pacote (`apps/api/src/types`, `apps/site/src/types` e `packages/shared/src/types`), incluindo as `Props` dos componentes.
- **JSDoc em pt-BR em todas as funções:** declarações, arrow functions atribuídas, métodos, classes e componentes. O bloco `/** */` fica acima da função, tem de 1 a 4 linhas e diz o que a função faz e para quê. Testes e callbacks anônimos ficam fora. Comentários soltos (`//`, `/* */` no corpo) continuam proibidos.
- **Nenhum arquivo de componente ou módulo passa de 700 linhas.**
- Os checks vêm do ESLint (`jsdoc/require-jsdoc` e `max-lines`). Rode `pnpm lint`, `pnpm typecheck` e `pnpm test` antes de commitar.
