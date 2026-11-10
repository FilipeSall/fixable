# Plano 1 — Fundação e acesso: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo funcionando, com a API Fastify autenticando os 4 perfis (login, logout, convite, reset de senha e fila de e-mail) e a área `/app` do Astro com as telas de acesso, ponta a ponta.

**Architecture:** Monorepo pnpm com `packages/shared` (schemas Zod e constantes usados pelos dois lados), `apps/api` (Fastify 5 + Drizzle + Postgres) e `apps/site` (Astro estático com uma SPA React em `/app`). Sessão opaca em tabela e cookie HttpOnly no mesmo domínio: em dev o Vite faz proxy de `/api`; em produção quem faz o proxy é o nginx. E-mails passam por uma tabela de saída processada por um worker no próprio processo da API.

**Tech Stack:** Node 24, pnpm 9, TypeScript (strict), Fastify 5, `fastify-type-provider-zod` (versão compatível com Zod 4), Zod 4, Drizzle ORM + drizzle-kit, `postgres` (postgres.js), `@node-rs/argon2`, `@fastify/cookie`, `@fastify/rate-limit`, nodemailer, Astro 5 + `@astrojs/react`, React 19, React Router 7, TanStack Query 5, Vitest, Testing Library, Playwright, Postgres 17, Mailpit.

**Spec:** `docs/superpowers/specs/2026-11-09-plataforma-fixable.md` (roadmap: `docs/superpowers/plans/2026-11-09-roadmap-fixable.md`)

## Global Constraints

- Commits na branch atual. **Nunca criar branch.** Conventional Commits em português (ex.: `feat(api): ...`), com rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Sem comentários no código** (nada de `//`, `/* */` ou JSDoc). Nomes bons substituem comentários.
- Props de componente React tipadas como `Readonly<Props>`. Callbacks equivalentes passados direto (`.map(Number)`, não `.map((v) => Number(v))`). Para NaN, usar `Number.isNaN` / `Number.isFinite`.
- `pnpm lint`, `pnpm typecheck` e `pnpm test` passando antes de cada commit.
- Textos visíveis ao usuário em pt-BR. Mensagens fixas:
  - `Informe um e-mail válido.`
  - `Informe sua senha.`
  - `A senha precisa ter pelo menos 8 caracteres.`
  - `Use letras e números na senha.`
  - `E-mail ou senha incorretos.`
  - `Sua conta está bloqueada. Fale com a Fixable.`
  - `Este link expirou ou já foi usado.`
  - `Muitas tentativas. Aguarde alguns minutos e tente de novo.`
- Senha: no mínimo 8 caracteres, com pelo menos uma letra (`[A-Za-zÀ-ÿ]`) e um dígito.
- Convite expira em **48h**; link de redefinição expira em **1h**. Ambos são de uso único e guardados só como hash SHA-256.
- Sessão: cookie `fx_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` controlado por `COOKIE_SECURE`. Validade de 30 dias, renovada para mais 30 quando faltarem menos de 15.
- Respostas públicas nunca revelam se um e-mail existe.
- Todas as rotas da API ficam sob o prefixo `/api`.
- Erro da API sempre no formato `{ "error": { "code": string, "message": string, "fields"?: Record<string,string> } }`.

## Review Focus

1. **E-mail com maiúsculas ou espaços** (`"  Ana@Fixable.com "`): login, convite e "esqueci a senha" tratam como o mesmo usuário. Teste na Task 5.
2. **Dois envios simultâneos do mesmo token** (duplo clique em "Criar senha"): só um consome o token, o outro recebe `410`. Teste na Task 6.
3. **Usuário bloqueado com sessão ainda aberta:** a próxima requisição autenticada responde `401`. Teste na Task 5.
4. **SMTP fora do ar:** o pedido de redefinição responde `204` mesmo assim, e o e-mail é reenviado depois com backoff. Testes nas Tasks 4 e 6.
5. **Abrir ou recarregar direto `/app/redefinir-senha?token=...`:** a SPA carrega em dev e atrás do nginx, sem 404. Teste E2E na Task 9.

---

## Estrutura de arquivos

```
package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js  .gitignore  .env.example
compose.yml   docker/postgres-init.sql
docs/referencia/modelo-4-plataforma.html
packages/shared/src/{index.ts, roles.ts, auth.ts, errors.ts, routes.ts}  + auth.test.ts
apps/api/
  src/{server.ts, app.ts, config.ts}
  src/db/{client.ts, migrate.ts, schema/{identity.ts, outbox.ts, index.ts}}  drizzle/
  src/plugins/{errors.ts, origin-check.ts, auth.ts}
  src/modules/auth/{passwords.ts, sessions.ts, email-tokens.ts, invites.ts, routes.ts}
  src/modules/mail/{mailer.ts, smtp-mailer.ts, memory-mailer.ts, templates.ts, outbox.ts}
  src/cli/create-admin.ts
  test/{global-setup.ts, helpers.ts}
  Dockerfile  drizzle.config.ts  vitest.config.ts
apps/site/
  astro.config.mjs  vitest.config.ts  playwright.config.ts
  src/integrations/spa-fallback.ts
  src/styles/tokens.css
  src/pages/{index.astro, app/index.astro}
  src/app/{App.tsx, api.ts}
  src/app/auth/{AuthProvider.tsx, RequireAuth.tsx, LoginPage.tsx, InvitePage.tsx,
                ForgotPasswordPage.tsx, ResetPasswordPage.tsx, SetPasswordForm.tsx}
  src/app/home/RoleHome.tsx
  e2e/auth.spec.ts
infra/nginx/fixable.conf
```

Os testes da API e do front ficam ao lado do arquivo testado (`*.test.ts` / `*.test.tsx`).

---

### Task 1: Monorepo e pacote `shared`

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.gitignore`, `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/{index,roles,auth,errors,routes}.ts`
- Create: `docs/referencia/modelo-4-plataforma.html` (cópia de `/home/sea/Downloads/Fixable · Plataforma (Modelo 4 — Casa editorial).html`)
- Modify: `docs/superpowers/specs/2026-11-09-plataforma-fixable.md` (linha 4: trocar `04-casa-editorial.html` por `docs/referencia/modelo-4-plataforma.html`)
- Test: `packages/shared/src/auth.test.ts`

**Interfaces:**
- Produces (`@fixable/shared`):
  - `ROLES = ['cliente','profissional','engenheiro','admin'] as const`; `type Role`
  - `USER_STATUSES = ['convidado','ativo','bloqueado'] as const`; `type UserStatus`
  - `HOME_BY_ROLE: Record<Role, string>` = `{ cliente: '/app/cliente', engenheiro: '/app/clientes', profissional: '/app/projetos', admin: '/app/admin' }`
  - `emailSchema`: string → trim → lowercase → e-mail válido
  - `passwordSchema`
  - `loginInput = { email, senha: z.string().min(1, 'Informe sua senha.') }`
  - `setPasswordInput = { token: z.string().min(1), senha: passwordSchema }`
  - `forgotPasswordInput = { email }`
  - `meResponse = { id: uuid, nome, email, role }`; `type Me`
  - `tokenInfoResponse = { purpose: 'convite' | 'redefinicao', nome, email }`
  - `ERROR_CODES = ['validation','invalid_credentials','account_blocked','unauthorized','forbidden','token_invalid','rate_limited','not_found','internal'] as const`; `type ErrorCode`
  - `apiErrorSchema`; `type ApiError`
  - `API = { login: '/api/auth/login', logout: '/api/auth/logout', me: '/api/auth/me', tokenInfo: (t: string) => `/api/auth/tokens/${t}`, acceptInvite: '/api/auth/invite/accept', forgot: '/api/auth/password/forgot', reset: '/api/auth/password/reset' }`

- [ ] **Step 1: Montar o workspace.**
  - `pnpm-workspace.yaml` com `apps/*` e `packages/*`.
  - `packageManager: "pnpm@9.15.9"` e `engines.node: ">=24"` no `package.json` raiz.
  - Scripts raiz: `lint` (`eslint .`), `typecheck` (`pnpm -r typecheck`), `test` (`pnpm -r test`).
  - `tsconfig.base.json` com `strict`, `noUncheckedIndexedAccess`, `module`/`moduleResolution` `NodeNext` e `verbatimModuleSyntax`.
  - ESLint flat config com `typescript-eslint` (type-checked), `eslint-plugin-sonarjs` e `eslint-plugin-react-hooks`, ignorando os protótipos `*.html` e `assets/` da raiz.
  - `.gitignore`: `node_modules`, `dist`, `.astro`, `.env`, `playwright-report`, `test-results`.
  - Copiar o modelo aprovado para `docs/referencia/` e corrigir a referência no PRD.

- [ ] **Step 2: Escrever o teste que falha** em `packages/shared/src/auth.test.ts`:

```ts
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
```

- [ ] **Step 3: Rodar e ver falhar.** Run: `pnpm --filter @fixable/shared test`. Expected: FAIL (módulo `./auth` não existe).

- [ ] **Step 4: Implementar os módulos de `shared`** listados em Interfaces. No `passwordSchema`, se a senha tiver menos de 8 caracteres, apenas a mensagem de tamanho é emitida (usar `superRefine` com retorno antecipado).

- [ ] **Step 5: Rodar.** `pnpm --filter @fixable/shared test && pnpm lint && pnpm typecheck`. Expected: PASS.

- [ ] **Step 6: Commit** `chore: cria monorepo e pacote shared com schemas de acesso`.

---

### Task 2: Infra local e esqueleto da API

**Files:**
- Create: `compose.yml`, `docker/postgres-init.sql`, `.env.example`, `apps/api/{package.json,tsconfig.json,vitest.config.ts}`, `apps/api/src/{app.ts,server.ts,config.ts}`, `apps/api/src/db/client.ts`, `apps/api/src/plugins/errors.ts`, `apps/api/src/modules/mail/{mailer.ts,memory-mailer.ts}`, `apps/api/test/helpers.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Produces:
  - `loadConfig(env: NodeJS.ProcessEnv = process.env): Config`, validado com Zod. Campos:
    - `NODE_ENV` (`development | test | production`)
    - `PORT` (padrão 3333)
    - `DATABASE_URL`
    - `APP_ORIGIN` (ex.: `http://localhost:4321`)
    - `COOKIE_SECURE` (boolean, padrão `true`)
    - `MAIL_DRIVER` (`smtp | memory`)
    - `SMTP_URL` (obrigatório se o driver for `smtp`)
    - `MAIL_FROM`
  - `createDb(url: string): { db: Db; close(): Promise<void> }` (drizzle + postgres.js). Exporta `type Db` e `type Tx` (o tipo do argumento de `db.transaction`).
  - `type Mail = { to: string; subject: string; text: string; html: string }` e `interface Mailer { send(mail: Mail): Promise<void> }` em `modules/mail/mailer.ts`.
  - `createMemoryMailer(): MemoryMailer`, com `MemoryMailer = Mailer & { sent: Mail[]; failNext(times: number): void }`, em `modules/mail/memory-mailer.ts`.
  - `buildApp(deps: { config: Config; db: Db; mailer: Mailer }): Promise<FastifyInstance>`: registra o type provider Zod, `@fastify/cookie`, o plugin de erros e as rotas sob `/api`.
  - `GET /api/health` → `200 { status: 'ok', db: 'ok' }` (faz `select 1`); `503 { status: 'degraded', db: 'down' }` se o banco falhar.
  - Plugin de erros: `ZodError` vira `400 validation` (com `fields` por caminho); erro desconhecido vira `500 internal`, com a mensagem `Algo deu errado. Tente de novo.`, e o stack só no log.
  - `test/helpers.ts`: `testApp(overrides?): Promise<{ app; db; mailer: MemoryMailer; close }>` e `resetDb(db)`, que faz `TRUNCATE` de todas as tabelas do schema `public` (exceto as de migração) com `RESTART IDENTITY CASCADE`.

- [ ] **Step 1: Subir a infra local.**
  - `compose.yml` com `db` (`postgres:17`, porta 5432) e `mailpit` (`axllent/mailpit`, portas 1025 e 8025).
  - `docker/postgres-init.sql` cria os bancos `fixable` e `fixable_test`.
  - `.env.example` com todas as chaves de `Config`, apontando para esses serviços.

- [ ] **Step 2: Escrever o teste que falha** `app.test.ts`:
  - `GET /api/health` → 200 com `{ status: 'ok', db: 'ok' }`.
  - Uma rota de teste registrada só no teste e que valida `{ email: emailSchema }`, ao receber `{ email: 'x' }`, responde 400 com `error.code === 'validation'` e `error.fields.email === 'Informe um e-mail válido.'`.
  - `loadConfig({})` lança erro citando `DATABASE_URL`.

- [ ] **Step 3: Rodar e ver falhar.** `docker compose up -d db mailpit && pnpm --filter api test`. Expected: FAIL.

- [ ] **Step 4: Implementar** `config.ts`, `db/client.ts`, `plugins/errors.ts`, `app.ts` e `server.ts`. O `server.ts` faz `loadConfig`, `createDb`, `buildApp`, `listen` em `0.0.0.0:PORT` e encerra limpo com `SIGTERM`.

- [ ] **Step 5: Rodar.** `pnpm --filter api test`. Expected: PASS.

- [ ] **Step 6: Commit** `feat(api): esqueleto Fastify com health check, config e erros padronizados`.

---

### Task 3: Schema de identidade e migrations

**Files:**
- Create: `apps/api/src/db/schema/{identity.ts,outbox.ts,index.ts}`, `apps/api/drizzle.config.ts`, `apps/api/src/db/migrate.ts`, `apps/api/test/global-setup.ts`, `apps/api/drizzle/*` (gerado)
- Modify: `apps/api/test/helpers.ts` (adicionar `createUser`)
- Test: `apps/api/src/db/schema/identity.test.ts`

**Interfaces:**
- Produces (Drizzle):
  - `users`:
    - `id uuid pk default gen_random_uuid()`
    - `role` (pgEnum de `ROLES`) e `status` (pgEnum de `USER_STATUSES`, padrão `convidado`)
    - `nome text not null`, `email text not null unique`
    - `telefone text`, `cidade text`, `passwordHash text`
    - `createdAt`, `updatedAt` (`timestamptz`, `defaultNow`)
  - `sessions`:
    - `id uuid pk`
    - `userId` (fk → `users`, `on delete cascade`)
    - `tokenHash text unique not null`, `expiresAt timestamptz not null`, `createdAt`
  - `emailTokens`:
    - `id`, `userId` (fk, cascade)
    - `purpose` (pgEnum `convite | redefinicao`)
    - `tokenHash unique`, `expiresAt`, `usedAt` (nullable), `createdAt`
  - `emailOutbox`:
    - `id`, `to text`, `template text`, `data jsonb`
    - `status` (pgEnum `pendente | enviado | falhou`, padrão `pendente`)
    - `attempts int` (padrão 0), `nextAttemptAt timestamptz` (padrão now), `lastError text`, `createdAt`, `sentAt`
    - índice em `(status, nextAttemptAt)`
  - `runMigrations(url: string): Promise<void>` em `db/migrate.ts`. O script `pnpm --filter api db:migrate` chama essa função; `db:generate` chama `drizzle-kit generate`.
  - `createUser(db, p: { role: Role; status?: UserStatus; email?: string; nome?: string; senha?: string }): Promise<{ id: string; email: string }>`. Quando `senha` é informada, grava o hash com `hashPassword` da Task 5. Até lá, aceita `passwordHash` cru.

- [ ] **Step 1: Escrever o teste que falha** `identity.test.ts`:
  - Inserir dois usuários com o mesmo `email` falha com violação de unicidade.
  - Remover um usuário remove suas `sessions` e `emailTokens` (cascade).
  - Um usuário novo nasce com `status === 'convidado'`.

- [ ] **Step 2: Rodar e ver falhar.** `pnpm --filter api test identity`. Expected: FAIL.

- [ ] **Step 3: Implementar o schema e o setup de teste.**
  - Rodar `pnpm --filter api db:generate`.
  - `global-setup.ts` roda `runMigrations(DATABASE_URL_TEST)`.
  - `vitest.config.ts` com `globalSetup` e `fileParallelism: false`.
  - Cada arquivo de teste chama `resetDb` em `beforeEach`.

- [ ] **Step 4: Rodar.** `pnpm --filter api test && pnpm --filter api db:migrate`. Expected: PASS, e as migrations rodam do zero em `fixable`.

- [ ] **Step 5: Commit** `feat(api): schema de usuários, sessões, tokens e fila de e-mail`.

---

### Task 4: Mailer, templates e fila de saída

**Files:**
- Create: `apps/api/src/modules/mail/{smtp-mailer.ts,templates.ts,outbox.ts}`
- Modify: `apps/api/src/server.ts` (iniciar o worker)
- Test: `apps/api/src/modules/mail/outbox.test.ts`, `apps/api/src/modules/mail/templates.test.ts`

**Interfaces:**
- Consumes: `Mail`, `Mailer` e `createMemoryMailer` (Task 2); `Db`, `Tx` (Task 2); `emailOutbox` (Task 3).
- Produces:
  - `createSmtpMailer(smtpUrl: string, from: string): Mailer` (nodemailer)
  - `type TemplateName = 'convite' | 'redefinicao'`
  - `renderTemplate(name, data: { nome: string; link: string }): Mail-sem-to`. Assuntos fixos: `Crie sua senha na Fixable` e `Redefinição de senha da Fixable`.
  - `enqueueEmail(db: Db | Tx, msg: { to: string; template: TemplateName; data: Record<string, string> }): Promise<void>`
  - `processOutbox(db, mailer, now = new Date()): Promise<{ sent: number; failed: number }>`:
    - Pega até 20 linhas `pendente` com `nextAttemptAt <= now`, usando `FOR UPDATE SKIP LOCKED`.
    - Em caso de erro: `attempts + 1`, `nextAttemptAt = now + 2^attempts minutos`, `lastError` preenchido.
    - Ao chegar a 5 tentativas: `status = 'falhou'`.
  - `startOutboxWorker(db, mailer, intervalMs = 5000): () => void` (retorna a função que para o worker)

- [ ] **Step 1: Escrever os testes que falham.**
  - `templates.test.ts`: `renderTemplate('convite', { nome: 'Ana', link: 'http://x/app/convite?token=abc' })` tem `subject === 'Crie sua senha na Fixable'`, e tanto `text` quanto `html` contêm o link e `Ana`. O `html` escapa `<script>` vindo de `nome`.
  - `outbox.test.ts`:
    - Enfileirar 1 e processar faz `mailer.sent.length === 1`, e a linha fica `enviado` com `sentAt` preenchido.
    - Com `failNext(1)`, o resultado é `{ sent: 0, failed: 1 }`, `attempts === 1` e `nextAttemptAt` igual a `now + 2 min`. Processar com `now + 3 min` envia.
    - Após 5 falhas seguidas, o status vira `falhou` e a linha não é mais processada.
    - Uma linha com `nextAttemptAt` no futuro não é processada.

- [ ] **Step 2: Rodar e ver falhar.** `pnpm --filter api test mail`. Expected: FAIL.

- [ ] **Step 3: Implementar** os módulos. `server.ts` escolhe o driver por `MAIL_DRIVER`, chama `startOutboxWorker` e o para no `SIGTERM`.

- [ ] **Step 4: Rodar.** `pnpm --filter api test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(api): fila de e-mail com retentativa e templates de convite e redefinição`.

---

### Task 5: Login, sessão, logout e proteção de rotas

**Files:**
- Create: `apps/api/src/modules/auth/{passwords.ts,sessions.ts,routes.ts}`, `apps/api/src/plugins/{origin-check.ts,auth.ts}`
- Modify: `apps/api/src/app.ts` (registrar plugins e rotas), `apps/api/test/helpers.ts` (`createUser` com `senha`; `loginAs(app, email, senha): Promise<string>`, que retorna o header `cookie`)
- Test: `apps/api/src/modules/auth/login.test.ts`

**Interfaces:**
- Consumes: `users` e `sessions` (Task 3); `loginInput`, `meResponse` e `HOME_BY_ROLE` (Task 1).
- Produces:
  - `hashPassword(senha: string): Promise<string>`; `verifyPassword(hash: string, senha: string): Promise<boolean>` (argon2id, `@node-rs/argon2`)
  - `createSession(db, userId, now?): Promise<{ token: string; expiresAt: Date }>`: token de 32 bytes aleatórios em base64url; grava só o hash SHA-256.
  - `findSessionUser(db, token, now?): Promise<SessionUser | null>`, com `SessionUser = { id; nome; email; role; sessionId }`. Retorna `null` se a sessão expirou ou se o usuário não está `ativo`; aplica a renovação de 30 dias.
  - `revokeSession(db, token): Promise<void>`; `revokeUserSessions(db, userId): Promise<void>`
  - `setSessionCookie(reply, token, expiresAt, secure)`; `clearSessionCookie(reply)`
  - Plugin `auth`:
    - decora `request.user: SessionUser | null`, lido do cookie `fx_session`;
    - `app.requireAuth` (preHandler: `401 unauthorized` sem usuário);
    - `app.requireRole(...roles: Role[])` (preHandler: `403 forbidden` fora dos papéis).
  - Plugin `origin-check`: em `POST`, `PUT`, `PATCH` e `DELETE` sob `/api`, um header `Origin` diferente de `APP_ORIGIN` (ou ausente) gera `403 forbidden`.
  - Rotas:
    - `POST /api/auth/login`: `200 Me` + cookie. `401 invalid_credentials` para e-mail inexistente, senha errada ou conta `convidado`. `403 account_blocked` só com a senha correta em conta bloqueada. Rate limit de 10 requisições a cada 15 min por IP (`429 rate_limited`).
    - `POST /api/auth/logout`: `204`; revoga a sessão e limpa o cookie.
    - `GET /api/auth/me`: `200 Me` ou `401`.

- [ ] **Step 1: Escrever os testes que falham** `login.test.ts`. Todos os POSTs levam `origin: APP_ORIGIN`.
  - `login com credenciais corretas devolve Me e cookie fx_session HttpOnly SameSite=Lax`
  - `login normaliza o e-mail`: `"  ANA@FIXABLE.COM "` entra na conta `ana@fixable.com` (Review Focus 1)
  - `senha errada e e-mail inexistente devolvem 401 com a mesma mensagem "E-mail ou senha incorretos."`
  - `conta convidada devolve 401 invalid_credentials`
  - `conta bloqueada com senha correta devolve 403 "Sua conta está bloqueada. Fale com a Fixable."`
  - `GET /me com cookie devolve o usuário; sem cookie devolve 401`
  - `bloquear o usuário no banco faz o /me seguinte devolver 401` (Review Focus 3)
  - `logout revoga a sessão: /me com o mesmo cookie devolve 401`
  - `sessão com expiresAt a menos de 15 dias é renovada para now + 30 dias`
  - `POST sem Origin ou com Origin diferente devolve 403`
  - `a 11ª tentativa de login em 15 min devolve 429 "Muitas tentativas. Aguarde alguns minutos e tente de novo."`
  - `requireRole('admin') devolve 403 para cliente e 200 para admin` (rota registrada só no teste)

- [ ] **Step 2: Rodar e ver falhar.** `pnpm --filter api test login`. Expected: FAIL.

- [ ] **Step 3: Implementar** `passwords.ts`, `sessions.ts`, os dois plugins e `routes.ts`. Para o tempo de resposta não revelar se o e-mail existe, o login com e-mail inexistente ainda executa `verifyPassword` contra um hash fixo.

- [ ] **Step 4: Rodar.** `pnpm --filter api test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(api): login, logout e sessão com cookie HttpOnly e controle por perfil`.

---

### Task 6: Convite, redefinição de senha e `create-admin`

**Files:**
- Create: `apps/api/src/modules/auth/{email-tokens.ts,invites.ts}`, `apps/api/src/cli/create-admin.ts`
- Modify: `apps/api/src/modules/auth/routes.ts`, `apps/api/package.json` (script `create-admin`)
- Test: `apps/api/src/modules/auth/tokens.test.ts`, `apps/api/src/cli/create-admin.test.ts`

**Interfaces:**
- Consumes: `enqueueEmail` (Task 4); `createSession`, `setSessionCookie`, `revokeUserSessions` e `hashPassword` (Task 5); `setPasswordInput`, `forgotPasswordInput` e `tokenInfoResponse` (Task 1).
- Produces:
  - `issueEmailToken(db, userId, purpose: 'convite' | 'redefinicao', now?): Promise<string>`: invalida (`usedAt = now`) os tokens anteriores não usados do mesmo usuário e propósito; expira em 48h (convite) ou 1h (redefinição).
  - `peekEmailToken(db, raw, now?): Promise<{ userId; purpose; nome; email } | null>`
  - `consumeEmailToken(db | tx, raw, purpose, now?): Promise<{ userId } | null>`: um único `UPDATE ... SET used_at = now WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now RETURNING user_id`, atômico.
  - `sendInvite(db, config, userId): Promise<void>`: emite o token e enfileira o template `convite` com o link `${APP_ORIGIN}/app/convite?token=<raw>`.
  - `sendPasswordReset(db, config, userId): Promise<void>`: link `${APP_ORIGIN}/app/redefinir-senha?token=<raw>`.
  - Rotas:
    - `GET /api/auth/tokens/:token`: `200 tokenInfoResponse` ou `410 token_invalid` ("Este link expirou ou já foi usado.").
    - `POST /api/auth/invite/accept { token, senha }`: numa transação, consome o token, grava o hash, muda o status para `ativo`, cria a sessão e grava o cookie; responde `200 Me`. Token inválido gera `410`.
    - `POST /api/auth/password/forgot { email }`: sempre `204`; só enfileira se o usuário existir e estiver `ativo`. Rate limit de 5 por hora por IP.
    - `POST /api/auth/password/reset { token, senha }`: consome o token, grava o hash, revoga todas as sessões; responde `204`. Token inválido gera `410`.
  - `createAdmin(db, config, input: { nome: string; email: string }): Promise<{ userId: string }>`: cria o usuário `admin` com status `convidado` e chama `sendInvite`. O CLI `pnpm --filter api create-admin --nome "..." --email "..."` imprime `Convite enviado para <email>`. E-mail duplicado encerra com código 1 e a mensagem `Já existe um usuário com este e-mail.`

- [ ] **Step 1: Escrever os testes que falham.**
  - `tokens.test.ts`:
    - `sendInvite enfileira e-mail convite cujo link aceita a senha e ativa a conta`: extrai o token do `data.link` na `emailOutbox`; o accept devolve 200 + cookie, e `users.status === 'ativo'`.
    - `convite usado uma segunda vez devolve 410`.
    - `dois accepts simultâneos com o mesmo token: exatamente um 200 e um 410`: `Promise.all` (Review Focus 2).
    - `convite com 48h + 1min devolve 410`; `redefinição com 1h + 1min devolve 410` (via parâmetro `now`).
    - `novo convite invalida o anterior`.
    - `GET /tokens/:token devolve purpose, nome e email; token desconhecido devolve 410`.
    - `accept com senha "abcdefgh" devolve 400 com fields.senha "Use letras e números na senha."`.
    - `forgot de e-mail inexistente devolve 204 e não enfileira nada`.
    - `forgot de usuário ativo devolve 204 e enfileira redefinicao mesmo com o mailer falhando`: `failNext(1)`, depois `processOutbox` falha e o reenvio ocorre (Review Focus 4).
    - `reset troca a senha e derruba todas as sessões`: o cookie antigo dá 401 no `/me`; o login com a senha nova funciona.
  - `create-admin.test.ts`:
    - `cria admin convidado e enfileira convite`.
    - `e-mail duplicado lança "Já existe um usuário com este e-mail."`.

- [ ] **Step 2: Rodar e ver falhar.** `pnpm --filter api test tokens create-admin`. Expected: FAIL.

- [ ] **Step 3: Implementar** os módulos e o CLI (`node --env-file=.env` + `parseArgs` de `node:util`).

- [ ] **Step 4: Rodar.** `pnpm --filter api test`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(api): convite, redefinição de senha e comando create-admin`.

---

### Task 7: Projeto Astro com a SPA `/app` e os tokens visuais

**Files:**
- Create: `apps/site/{package.json,astro.config.mjs,tsconfig.json,vitest.config.ts}`, `apps/site/src/integrations/spa-fallback.ts`, `apps/site/src/styles/tokens.css`, `apps/site/src/pages/index.astro`, `apps/site/src/pages/app/index.astro`, `apps/site/src/app/{App.tsx,api.ts}`, `apps/site/src/app/home/RoleHome.tsx`
- Test: `apps/site/src/app/api.test.ts`

**Interfaces:**
- Consumes: `API`, `apiErrorSchema`, `Me` e `HOME_BY_ROLE` (Task 1).
- Produces:
  - `class ApiRequestError extends Error { status: number; code: ErrorCode; fields?: Record<string,string> }`
  - `apiFetch<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>`: usa `credentials: 'include'` e JSON; `204` vira `undefined`. Se a resposta não for ok, lança `ApiRequestError` a partir do corpo; se o corpo for inválido, `code: 'internal'` e a mensagem `Algo deu errado. Tente de novo.`
  - `App`: `BrowserRouter` com `basename="/app"` e um `QueryClientProvider` (com `retry: false` para 4xx).
  - `RoleHome`: placeholder com `Olá, <primeiro nome>.` (como no modelo) e um botão `Sair`.
  - `spaFallback()`: integração Astro que, no `astro:server:setup`, reescreve qualquer `GET /app/*` sem extensão para `/app/`.
  - `tokens.css`: as variáveis de `:root` do modelo (`docs/referencia/modelo-4-plataforma.html`, linhas 12–45 e 425), as fontes DM Serif Display, Manrope e Sora (Google Fonts) e as classes de formulário e botão usadas no painel de login do modelo (`.btn`, `.btn-primary`, `.btn-block`, `.fx-form`, `.err`).

- [ ] **Step 1: Escrever o teste que falha** `api.test.ts` (com `fetch` mockado via `vi.stubGlobal`):
  - `devolve o JSON em 200`.
  - `devolve undefined em 204`.
  - `lança ApiRequestError com status, code e fields a partir do corpo de erro`.
  - `corpo não-JSON vira ApiRequestError internal "Algo deu errado. Tente de novo."`.
  - `envia credentials include e content-type json quando há body`.

- [ ] **Step 2: Rodar e ver falhar.** `pnpm --filter site test`. Expected: FAIL.

- [ ] **Step 3: Implementar.**
  - `astro.config.mjs`: `output: 'static'`, `integrations: [react(), spaFallback()]`, `vite.server.proxy['/api'] = 'http://localhost:3333'`.
  - `pages/app/index.astro` renderiza `<App client:only="react" />`, importa `tokens.css` e define `<meta name="robots" content="noindex">`.
  - `pages/index.astro`: placeholder `Fixable` com link `Entrar` para `/app/login` (a home real vem no plano 2).

- [ ] **Step 4: Rodar.** `pnpm --filter site test && pnpm --filter site build`. Expected: PASS, com `dist/app/index.html` gerado.

- [ ] **Step 5: Commit** `feat(site): projeto Astro com SPA React em /app e cliente da API`.

---

### Task 8: Telas de acesso

**Files:**
- Create: `apps/site/src/app/auth/{AuthProvider.tsx,RequireAuth.tsx,LoginPage.tsx,SetPasswordForm.tsx,InvitePage.tsx,ForgotPasswordPage.tsx,ResetPasswordPage.tsx}`
- Modify: `apps/site/src/app/App.tsx` (rotas)
- Test: `apps/site/src/app/auth/{LoginPage,InvitePage,RequireAuth}.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` e `ApiRequestError` (Task 7); os schemas da Task 1; as rotas da API das Tasks 5 e 6.
- Produces:
  - `useAuth(): { me: Me | null; isLoading: boolean; login(email, senha): Promise<Me>; logout(): Promise<void>; setMe(me: Me): void }` (query `['me']` em `API.me`; um 401 vira `me = null`)
  - `<RequireAuth roles?: Role[]>`: sem sessão, redireciona para `/login?next=<rota>`; com papel fora da lista, redireciona para `HOME_BY_ROLE[me.role]`.
  - Rotas:
    - `/login`, `/convite`, `/esqueci-senha` e `/redefinir-senha` (públicas);
    - `/` redireciona para a home do papel;
    - `/cliente`, `/clientes`, `/projetos` e `/admin` renderizam `RoleHome` dentro de `RequireAuth` com o papel correspondente.
  - `SetPasswordForm`: campos senha e confirmação (`As senhas não conferem.`), compartilhado por convite e redefinição.
  - Textos das telas (marcação e classes do painel `#login-panel` do modelo):
    - login: título `Entrar na plataforma`, botão `Entrar`, link `Esqueci minha senha`;
    - convite: `Crie sua senha` e `Olá, <nome>. Defina uma senha para acessar a Fixable.`;
    - esqueci a senha: confirmação `Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.`;
    - redefinir a senha: sucesso leva a `/login` com o aviso `Senha redefinida. Entre com a nova senha.`;
    - token inválido: `Este link expirou ou já foi usado.` com link para `/esqueci-senha`.

- [ ] **Step 1: Escrever os testes que falham** (Testing Library, consultas por papel e rótulo; `apiFetch` mockado):
  - `LoginPage`:
    - `mostra "Informe um e-mail válido." e não chama a API com e-mail inválido`.
    - `mostra a mensagem do servidor em 401`.
    - `após login vai para HOME_BY_ROLE do papel ou para ?next`.
    - `desabilita o botão e mostra "Entrando..." durante o envio`.
  - `InvitePage`:
    - `com token válido mostra "Olá, Ana."`.
    - `token 410 mostra "Este link expirou ou já foi usado."`.
    - `senhas diferentes mostram "As senhas não conferem."`.
    - `sucesso leva à home do papel`.
  - `RequireAuth`:
    - `sem sessão redireciona para /login?next=/clientes`.
    - `cliente acessando /admin vai para /cliente`.

- [ ] **Step 2: Rodar e ver falhar.** `pnpm --filter site test`. Expected: FAIL.

- [ ] **Step 3: Implementar** os componentes e as rotas.

- [ ] **Step 4: Rodar.** `pnpm --filter site test && pnpm lint && pnpm typecheck`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(site): telas de login, convite e redefinição de senha`.

---

### Task 9: E2E de acesso, Dockerfile da API e nginx de referência

**Files:**
- Create: `apps/site/playwright.config.ts`, `apps/site/e2e/auth.spec.ts`, `apps/api/Dockerfile`, `infra/nginx/fixable.conf`
- Modify: `package.json` raiz (script `e2e`)

**Interfaces:**
- Consumes: o CLI `create-admin` (Task 6), a API de mensagens do Mailpit (`GET http://localhost:8025/api/v1/messages` e `GET /api/v1/message/{ID}`) e as telas da Task 8.
- Produces:
  - Script `pnpm e2e`: sobe a API (`MAIL_DRIVER=smtp` → Mailpit, `COOKIE_SECURE=false`) e o site (`astro dev`) via `webServer` do Playwright, e roda os specs.
  - `infra/nginx/fixable.conf`:
    - serve `apps/site/dist`;
    - `location /api/` → `proxy_pass http://api:3333`;
    - `location /app/ { try_files $uri $uri/ /app/index.html; }`;
    - headers `X-Content-Type-Options`, `Referrer-Policy` e `X-Frame-Options DENY`.
  - `apps/api/Dockerfile`: multi-stage com Node 24 e `pnpm deploy --filter api`; o comando padrão roda as migrations e depois o servidor.

- [ ] **Step 1: Escrever o E2E** `auth.spec.ts`:
  - `admin recebe convite, cria senha, entra, sai e entra de novo`:
    1. Limpa o Mailpit (`DELETE /api/v1/messages`).
    2. Roda `create-admin` com um e-mail único.
    3. Lê o link no e-mail, abre e preenche `senha123` duas vezes.
    4. Espera o texto `Olá,` em `/app/admin`, clica em `Sair` e confere que caiu em `/app/login`.
    5. Faz login e espera `/app/admin`.
  - `deep link de redefinição carrega a SPA`: abrir direto `/app/redefinir-senha?token=invalido` mostra `Este link expirou ou já foi usado.` (Review Focus 5).
  - `rota protegida sem sessão vai para login`: `/app/clientes` redireciona para `/app/login?next=%2Fclientes`.

- [ ] **Step 2: Rodar.** `docker compose up -d && pnpm --filter api db:migrate && pnpm e2e`. Expected: PASS nos 3 cenários.

- [ ] **Step 3: Validar a imagem e o nginx.**
  - Rodar `docker build -f apps/api/Dockerfile .`. Expected: build ok.
  - Rodar `docker run --rm -v "$PWD/infra/nginx/fixable.conf:/etc/nginx/conf.d/default.conf:ro" --add-host api:127.0.0.1 nginx:stable nginx -t`. Expected: `syntax is ok`.

- [ ] **Step 4: Commit** `test(e2e): fluxo de convite e login; Dockerfile da API e nginx de referência`.

---

## Cobertura do PRD neste plano

| PRD | Onde |
|---|---|
| Histórias 10–13 (convite, login, recuperação, logout) | Tasks 5, 6 e 8, mais o E2E da Task 9 |
| História 14 (bloqueado / convite expirado) | Tasks 5 e 6 (mensagens), Task 8 (tela de token inválido) |
| Sem cadastro público | Não existe rota de cadastro (verificado pela ausência de rota na Task 5) |
| Rate limit em login | Task 5 |
| Primeiro admin por CLI | Task 6 |
| Critérios "Acesso" (48h/1h, mensagem genérica, bloqueado) | Tasks 5 e 6 |
| "`docker compose up` + `pnpm dev`", migrations do zero, `create-admin` | Tasks 2, 3, 6 e 9 |

Ficam para os planos seguintes: sessões encerradas pela ação de bloqueio do admin (plano 5, que reusa `revokeUserSessions`) e rate limit dos formulários públicos (plano 2).
