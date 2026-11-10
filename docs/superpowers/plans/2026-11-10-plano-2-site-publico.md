# Plano 2 — Site público: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site público do Modelo 4 em Astro, aberto sem login, com os formulários de diagnóstico e de candidatura gravando na API (lead, cliente, imóvel com maquete padrão, solicitação, atribuição por menor carga e e-mails), páginas serviço × cidade e SEO técnico.

**Architecture:** As seções do Modelo 4 viram componentes Astro estáticos, sem JS. Há duas exceções: o menu mobile, com um `<script>` pequeno, e os dois formulários, que são ilhas React `client:visible` e validam com os mesmos schemas Zod da API. O conteúdo editável (pacotes, FAQ, serviços e cidades) fica em Content Collections. A API ganha o módulo `public`, com duas rotas que gravam tudo numa transação, e as tabelas mínimas de cliente, imóvel, maquete e solicitação, que o plano 3 vai estender.

**Tech Stack:** o do plano 1, mais `@astrojs/sitemap` e as fontes self-hosted (`@fontsource-variable/manrope`, `@fontsource/dm-serif-display`, `@fontsource/sora`).

**Spec:** `docs/superpowers/specs/2026-11-09-plataforma-fixable.md`. A referência visual é `docs/referencia/modelo-4-plataforma.html`; as pendências herdadas estão em `docs/superpowers/plans/2026-11-09-plano-1-pendencias.md`.

## Global Constraints

- Todas as regras do plano 1 continuam valendo:
  - commits na branch atual, nunca criar branch;
  - Conventional Commits em pt-BR, com o rodapé `Co-Authored-By`;
  - sem comentários no código;
  - `Readonly<Props>` nas props;
  - callbacks passados direto (S7770);
  - `pnpm lint`, `pnpm typecheck` e `pnpm test` passando antes de cada commit.
- O site público (`/`, `/servicos/**` e as páginas legais) **nunca** depende de sessão e não chama `/api/auth/me`.
- Fora as ilhas dos formulários e o script do menu mobile, nenhuma página pública carrega JS.
- Mensagens fixas, copiadas do modelo:
  - `Informe seu nome completo.`
  - `Informe um e-mail válido.`
  - `Informe um telefone válido.`
  - `Informe sua cidade.`
  - `Selecione o tipo de imóvel.`
  - `Selecione a preferência de contato.`
  - `Selecione sua área de atuação.`
  - `Aceite os termos de uso e a política de privacidade para continuar.`
  - `Muitas tentativas. Aguarde alguns minutos e tente de novo.`
  - `Não foi possível enviar agora. Tente de novo em instantes.` (erro de rede ou 5xx)
- Copy de sucesso do diagnóstico:
  - título: `Solicitação registrada.`
  - texto: `Um engenheiro da Fixable vai entrar em contato para agendar a visita. Se este for o seu primeiro diagnóstico, você também vai receber um e-mail para criar sua senha.`
- Copy de sucesso da candidatura:
  - título: `Cadastro recebido.`
  - texto: `A equipe Fixable vai analisar sua candidatura e entrar em contato pelo e-mail informado.`
- Os avisos de "modo demonstração" do modelo **não** entram.
- As duas rotas públicas respondem `204` sem corpo em todos os ramos: e-mail novo, e-mail existente, honeypot preenchido. Erros de validação respondem `400` no formato padrão, e o excesso de envios responde `429`.
- Rate limit: **5 envios por 15 minutos por IP**, contados separadamente por rota.
- Validações:
  - telefone: 10 a 13 dígitos depois de remover o que não é dígito; é gravado só com os dígitos;
  - nome: 3 a 120 caracteres;
  - cidade: 1 a 80;
  - descrição: até 2000;
  - todos os textos passam por `trim`.
- URLs sem barra final (`trailingSlash: 'never'`, `build.format: 'directory'`). O canonical é absoluto, a partir de `SITE_URL`, cujo padrão é `https://www.fixable.com.br`.

## Convenções de arquitetura (decididas pelo usuário em 2026-11-10; valem para este plano e os próximos)

- **Backend em MVC + services** (`apps/api/src`):
  - `routes/`: só declaram caminho, schema Zod, rate limit e preHandlers, e apontam para um controller. `routes/index.ts` registra tudo sob `/api`.
  - `controllers/`: leem `request`, chamam services, definem status e cookies e devolvem a resposta. Não usam Drizzle.
  - `services/`: regra de negócio e acesso ao banco via Drizzle e models.
  - `models/`: só as tabelas Drizzle (`*.model.ts`), com um `models/index.ts` que reexporta.
  - `views/emails/`: os templates de e-mail.
  - `middlewares/`: hooks do Fastify (auth, Origin, tratamento de erro).
  - `mailers/`: drivers SMTP e memória.
  - `workers/`: worker do outbox.
  - `utils/`: funções puras (senha, hash de token, escape de HTML, redação de log, `AppError`).
  - `config/`: leitura do env.
  - `db/`: client e migrate.
  - `cli/`: comandos de linha.
  - `types/`: as interfaces e os tipos.
- **Nomes de arquivo:** `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `user.model.ts`, `auth.middleware.ts`, `smtp.mailer.ts`, `outbox.worker.ts`, `*.types.ts`.
- **Testes da API** em `apps/api/tests/`, espelhando `src/`: `tests/services/…`, `tests/routes/…` (integração via `inject`), `tests/utils/…`. Os helpers ficam em `tests/helpers.ts` e `tests/global-setup.ts`.
- **Interfaces e tipos em pastas dedicadas:** toda `interface` ou `type` nomeado fica em `types/`:
  - API: `apps/api/src/types/`;
  - site: `apps/site/src/types/`, incluindo as `Props` dos componentes;
  - shared: `packages/shared/src/types/`, incluindo os `z.infer`.
  - Exceção: a declaração `declare module 'fastify'` fica em `apps/api/src/types/fastify.d.ts`.
- **JSDoc em pt-BR em todas as funções** (declarações, arrow functions atribuídas a constante, métodos, componentes React e classes):
  - bloco `/** */` logo acima, de 1 a 4 linhas, dizendo **o que** a função faz e **para quê**;
  - o Global Constraint "sem comentários no código" passa a valer só para comentários soltos (`//` e `/* */` dentro de corpo ou acima de linha);
  - callbacks anônimos passados como argumento e arquivos de teste não precisam de JSDoc;
  - a regra vem do ESLint `jsdoc/require-jsdoc`.
- **Nenhum arquivo de componente ou módulo passa de 700 linhas** (ESLint `max-lines: 700` para `.ts`/`.tsx`; nos `.astro`, a revisão confere).

## Review Focus

1. **Duplo clique ou dois envios simultâneos do mesmo e-mail novo:** cria um usuário e um cliente só, e as duas respostas são `204`. Teste na Task 6.
2. **E-mail de cliente existente digitado com maiúsculas ou espaços:** cai no ramo "diagnóstico adicional" e não cria conta nova. Teste na Task 6.
3. **Nenhum engenheiro ativo** (só convidados ou bloqueados): o cliente nasce sem engenheiro, o lead fica sem atribuição, o convite sai mesmo assim e o aviso à equipe diz `Sem atribuição`. Teste nas Tasks 2 e 6.
4. **Honeypot preenchido:** responde `204` e não grava nada nem envia e-mail. Teste na Task 6.
5. **`?plano=` inválido ou adulterado na URL:** é ignorado, sem chip. Um plano válido aparece no chip e pode ser removido. Teste na Task 9.

---

### Task 1: Catálogo e schemas públicos em `packages/shared`

**Files:**
- Create: `packages/shared/src/catalog.ts`, `packages/shared/src/public-forms.ts`, `packages/shared/src/public-forms.test.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/routes.ts`

**Interfaces:**
- Produces:
  - `PLANS = [{ id: '1m', nome: 'Plano para 1 mês' }, { id: '3m', nome: 'Plano para 3 meses' }, { id: '6m', nome: 'Plano para 6 meses' }, { id: '12m', nome: 'Plano anual' }] as const`, `PlanId`, `planName(id: PlanId): string`.
  - `PROPERTY_TYPES = ['casa_terrea', 'sobrado', 'apartamento', 'empresa'] as const`, `PROPERTY_TYPE_LABELS: Record<PropertyType, string>` (`Casa térrea`, `Sobrado`, `Apartamento`, `Para empresas`).
  - `CONTACT_PREFERENCES = ['whatsapp', 'telefone', 'email'] as const`, com rótulos `WhatsApp`, `Telefone`, `E-mail`.
  - `APPLICATION_AREAS = ['engenheiro', 'outro'] as const`, com rótulos `Engenheiro`, `Outro`.
  - `SERVICE_REQUEST_STATUSES = ['em_analise', 'agendado', 'em_execucao', 'concluido'] as const`, com rótulos `Em análise`, `Agendado`, `Em execução`, `Concluído`.
  - `APPLICATION_STATUSES = ['pendente', 'aprovada', 'recusada'] as const`.
  - `phoneSchema` (devolve só os dígitos), `diagnosticInput`, `applicationInput` e os tipos inferidos `DiagnosticInput` e `ApplicationInput`.
  - `API.publicDiagnostics = '/api/public/diagnostics'` e `API.publicApplications = '/api/public/applications'`.

**Campos:**
- `diagnosticInput`: `nome`, `email` (`emailSchema`), `telefone`, `cidade`, `tipoImovel`, `descricao` (opcional; vazio vira `undefined`), `preferenciaContato`, `plano` (opcional), `aceiteTermos: z.literal(true)` e `website` (honeypot, string opcional de até 200 caracteres).
- `applicationInput`: `nome`, `email`, `telefone`, `cidade`, `area`, `aceiteTermos` e `website`.
- Mensagens dos enums: `Selecione o tipo de imóvel.`, `Selecione a preferência de contato.` e `Selecione sua área de atuação.`, inclusive quando o valor vem vazio (`''`).

- [ ] **Step 1: Escrever os testes em `public-forms.test.ts`**
  - `diagnosticInput aceita o envio válido e normaliza`: `{ nome: '  Ana Souza ', email: ' Ana@Ex.com ', telefone: '(11) 90000-0000', cidade: 'Santo André', tipoImovel: 'sobrado', preferenciaContato: 'whatsapp', plano: '3m', aceiteTermos: true }` vira `nome: 'Ana Souza'`, `email: 'ana@ex.com'` e `telefone: '11900000000'`.
  - `telefone com menos de 10 ou mais de 13 dígitos falha com "Informe um telefone válido."`: `'1234-5678'` e `'+55 (11) 90000-00000'`.
  - `nome com 2 letras falha com "Informe seu nome completo."`.
  - `tipoImovel vazio falha com "Selecione o tipo de imóvel."` e `preferenciaContato vazio falha com "Selecione a preferência de contato."`.
  - `aceiteTermos false ou ausente falha com "Aceite os termos de uso e a política de privacidade para continuar."`.
  - `plano desconhecido ('99m') falha` e `descricao '' vira undefined`.
  - `applicationInput com area vazia falha com "Selecione sua área de atuação."`.
  - `planName('12m') === 'Plano anual'`.
- [ ] **Step 2:** `pnpm --filter @fixable/shared test` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `catalog.ts` e `public-forms.ts`, exportar no `index.ts` e adicionar as rotas em `routes.ts`.
- [ ] **Step 4:** `pnpm --filter @fixable/shared test` → PASS.
- [ ] **Step 5:** Commit `feat(shared): catálogo de planos e schemas dos formulários públicos`.

### Task 2: Tabelas de cliente, imóvel, maquete, solicitação, lead e candidatura

**Files:**
- Create: `apps/api/src/db/schema/clients.ts`, `apps/api/src/db/schema/public-intake.ts`, `apps/api/src/modules/clients/floorplan-template.ts`, `apps/api/src/modules/clients/assignment.ts`, `apps/api/src/modules/clients/assignment.test.ts`, `apps/api/src/modules/clients/floorplan-template.test.ts`
- Create (gerada): `apps/api/drizzle/0002_*.sql` via `pnpm --filter api db:generate`
- Modify: `apps/api/src/db/schema/index.ts`

**Interfaces:**
- Tabelas, todas com `id uuid defaultRandom` e `created_at timestamptz defaultNow`:
  - `clients`: `user_id` (unique, FK users, cascade) e `engineer_id` (FK users, `set null`, nullable).
  - `properties`: `client_id` (FK, cascade), `tipo` (enum `property_type`), `cidade` text e `apelido` text.
  - `property_attributes`: `property_id` (FK, cascade), `chave`, `valor` e `posicao` int.
  - `floors`: `property_id` (FK, cascade), `nome` e `posicao`.
  - `rooms`: `floor_id` (FK, cascade), `nome`, `largura` int, `altura` int e `posicao`.
  - `service_requests`: `client_id` (FK, cascade), `property_id` (FK, `set null`, **nullable**), `descricao` text e `status` (enum `service_request_status`, default `em_analise`).
  - `diagnostic_leads`:
    - os campos de `DiagnosticInput`, exceto `aceiteTermos` e `website`, em snake_case;
    - `consent_at timestamptz not null`;
    - `client_id` (FK, `set null`, nullable) e `engineer_id` (FK users, `set null`, nullable).
  - `applications`: `nome`, `email`, `telefone`, `cidade`, `area` (enum), `status` (enum `application_status`, default `pendente`) e `consent_at`.
- Índices: `clients.engineer_id`, `properties.client_id`, `service_requests.client_id` e `diagnostic_leads.created_at`.
- `floorplanFor(tipo: PropertyType): { nome: string; comodos: { nome: string; largura: number; altura: number }[] }[]`, com exatamente as plantas de `roomsFor` do modelo (linhas 1362–1370). `casa_terrea` usa o caso padrão.
- `pickEngineer(db: Db | Tx): Promise<{ id: string; nome: string } | null>`. Escolhe o usuário com `role = 'engenheiro'` e `status = 'ativo'` que tem menos linhas em `clients`. O empate vai para o `users.created_at` mais antigo e depois para o `id`. Sem engenheiro ativo, devolve `null`.

- [ ] **Step 1: Escrever os testes**
  - `floorplanFor('sobrado')` tem 2 andares (`Andar 1` com 5 cômodos e `Andar 2` com 5); `Sala de estar` mede 3×2.
  - `floorplanFor('empresa')[0].comodos[1]` é `{ nome: 'Escritório', largura: 4, altura: 2 }`.
  - `pickEngineer devolve null sem engenheiro ativo`: um engenheiro `convidado` e outro `bloqueado` não contam.
  - `pickEngineer escolhe o de menor carga`: A tem 2 clientes e B tem 1, então devolve B.
  - `pickEngineer desempata pelo mais antigo`.
- [ ] **Step 2:** `pnpm --filter api test -- clients` → FAIL.
- [ ] **Step 3:** Criar os schemas, gerar a migration, implementar `floorplanFor` e `pickEngineer`, e acrescentar as novas tabelas ao `resetDb` se ele não as pegar sozinho (ele trunca tudo de `public`, então deve pegar).
- [ ] **Step 4:** `pnpm --filter api db:migrate` num banco limpo e `pnpm --filter api test` → PASS.
- [ ] **Step 5:** Commit `feat(api): tabelas de cliente, imóvel, maquete, solicitação, lead e candidatura`, com a migration no mesmo commit.

### Task 3: Backend em MVC + services e testes em `apps/api/tests/`

Refatoração **sem mudança de comportamento**. Todos os testes existentes continuam passando, só mudam de lugar.

**Files:** move ou divide todo o `apps/api/src` atual conforme "Convenções de arquitetura". Mapa mínimo:
- `config.ts` → `config/env.ts`
- `db/schema/*.ts` → `models/*.model.ts`:
  - `identity` → `user`, `session` e `email-token`;
  - `outbox` → `email-outbox`;
  - `clients` → `client`, `property` (com os atributos), `floorplan` (andares e cômodos) e `service-request`;
  - `public-intake` → `diagnostic-lead` e `application`;
  - mais `models/index.ts`.
- `drizzle.config.ts` passa a apontar para `src/models/index.ts`. Rodar `pnpm --filter api db:generate` deve dizer que não há mudanças: **nenhuma migration nova**.
- `modules/auth/routes.ts` → `routes/auth.routes.ts` + `controllers/auth.controller.ts` + `services/auth.service.ts` (login, aceitar convite, esqueci a senha, redefinir senha).
- `modules/auth/sessions.ts` → `services/session.service.ts`; os helpers de cookie vão para o controller ou para `utils/session-cookie.ts`.
- `modules/auth/email-tokens.ts` → `services/email-token.service.ts`; `modules/auth/invites.ts` → `services/invite.service.ts`.
- `modules/auth/passwords.ts` → `utils/password.ts`; `hashToken` → `utils/token.ts`.
- `modules/mail/outbox.ts`:
  - `enqueueEmail` e `processOutbox` vão para `services/outbox.service.ts`;
  - `startOutboxWorker` vai para `workers/outbox.worker.ts`.
- `modules/mail/templates.ts` → `views/emails/` (um arquivo por template mais `render.ts`), com o escape de HTML em `utils/html.ts`.
- `modules/mail/{smtp,memory}-mailer.ts` → `mailers/smtp.mailer.ts` e `mailers/memory.mailer.ts`; a interface `Mailer` vai para `types/`.
- `modules/clients/assignment.ts` → `services/assignment.service.ts`; `floorplan-template.ts` → `services/floorplan.service.ts`.
- `plugins/` → `middlewares/`:
  - `auth.middleware.ts`, `origin-check.middleware.ts` e `error-handler.middleware.ts`;
  - `AppError` e as mensagens fixas vão para `utils/app-error.ts`;
  - `log-redaction.ts` vai para `utils/log-redaction.ts`.
- O health check vira `routes/health.routes.ts` e `controllers/health.controller.ts`. O `app.ts` fica só com a montagem dos plugins e dos middlewares e `register(routes)`.
- Testes: todos os `src/**/*.test.ts` e `test/*` vão para `tests/`, espelhando `src/`. Atualizar `vitest.config.ts` (`include: ['tests/**/*.test.ts']`, globalSetup), `tsconfig.json` (`include` com `tests`), o `eslint.config.js` (o override do smtp-mailer, agora no novo caminho), o `Dockerfile` (se algum caminho mudou) e o `README.md` (se cita caminhos).

**Regras:**
- Controllers não importam `drizzle-orm` nem `models/`.
- Routes não têm lógica além de declarar a rota.
- Services não importam `fastify`, com exceção dos tipos.

- [ ] **Step 1:** Rodar `pnpm --filter api test` e anotar o total de testes no relatório; é a linha de base.
- [ ] **Step 2:** Mover e dividir, ajustando os imports (com extensão `.ts`).
- [ ] **Step 3:** `pnpm lint`, `pnpm typecheck` e `pnpm --filter api test` → PASS, com o **mesmo total** da linha de base. `pnpm --filter api db:generate` não gera arquivo. `docker compose build api` → OK.
- [ ] **Step 4:** `grep -rn "drizzle-orm\|models/" apps/api/src/controllers` → vazio.
- [ ] **Step 5:** Commit `refactor(api): estrutura MVC com services e testes em tests/`.

### Task 4: Tipos em pastas dedicadas, JSDoc em pt-BR e limite de 700 linhas

**Files:**
- `eslint.config.js` e `package.json` da raiz (devDependency `eslint-plugin-jsdoc`).
- Todo `apps/api/src`, `apps/site/src` e `packages/shared/src` (código, não testes).
- Create: `apps/api/src/types/*.types.ts`, `apps/api/src/types/fastify.d.ts`, `apps/site/src/types/*.types.ts` e `packages/shared/src/types/*.types.ts`.

**Regras de lint** (só para arquivos que não são de teste):
- `jsdoc/require-jsdoc` com `require: { FunctionDeclaration: true, MethodDefinition: true, ClassDeclaration: true, ArrowFunctionExpression: false, FunctionExpression: false }` e `contexts: ['VariableDeclarator > ArrowFunctionExpression', 'VariableDeclarator > FunctionExpression']`.
- `jsdoc/require-description`.
- `max-lines: ['error', { max: 700 }]`.
- Os testes (`**/*.test.{ts,tsx}`, `**/tests/**`, `**/e2e/**`) ficam fora do `require-jsdoc`.

**Conteúdo:**
- Mover toda `interface` e `type` nomeado para a pasta `types/` do pacote, agrupados por assunto (ex.: `session.types.ts`, `mail.types.ts`, `forms.types.ts`, `auth-screens.types.ts`), e importar de lá.
- No shared, os `z.infer` vão para `src/types/` e o `index.ts` continua exportando tudo.
- Escrever o JSDoc em pt-BR, de 1 a 4 linhas, em cada função e componente. Exemplo: `/** Cria a sessão do usuário e devolve o token opaco que vai no cookie. */`.

- [ ] **Step 1:** Configurar o ESLint e rodar `pnpm lint`. A falha é esperada e lista as funções sem JSDoc; anotar a contagem no relatório.
- [ ] **Step 2:** Mover os tipos.
- [ ] **Step 3:** Escrever os JSDoc.
- [ ] **Step 4:** `pnpm lint`, `pnpm typecheck` e `pnpm test` → PASS, com os mesmos totais de antes. Rodar também `grep -rnE "^\s*(export )?(interface|type) [A-Z]" apps/api/src apps/site/src packages/shared/src | grep -v "/types/"`; deve vir vazio, salvo os reexports.
- [ ] **Step 5:** Commit `refactor: tipos em pastas dedicadas, JSDoc em pt-BR e limite de 700 linhas`.

### Task 5: E-mails de lead, candidatura e diagnóstico adicional

**Files:**
- Create: `apps/api/src/views/emails/{novo-lead,nova-candidatura,diagnostico-recebido}.ts`
- Modify:
  - `apps/api/src/config/env.ts`, `apps/api/src/views/emails/render.ts`, `apps/api/src/types/mail.types.ts` e `apps/api/src/services/outbox.service.ts`
  - os testes `apps/api/tests/views/emails/*.test.ts` e `apps/api/tests/config/env.test.ts`
  - `apps/api/tests/helpers.ts`, `.env.example`, `compose.yml`, `apps/site/e2e/env.ts` e `README.md`
- Os caminhos exatos são os que a Task 3 criou; confira com `ls apps/api/src/*`.

**Interfaces:**
- Config:
  - `TEAM_EMAIL: z.email().optional()`.
  - Novo `refine`: é obrigatório quando `NODE_ENV=production`, com a mensagem `TEAM_EMAIL é obrigatório quando NODE_ENV=production`.
  - Em dev e teste, o padrão é `equipe@fixable.local`, definido em `.env.example`, `compose.yml`, nos helpers e no `e2e/env.ts`.
- `TemplateName` passa a ser `'convite' | 'redefinicao' | 'novo-lead' | 'nova-candidatura' | 'diagnostico-recebido'`.
- `TemplateDataMap`:
  - `convite` e `redefinicao`: `{ nome, link }`.
  - `novo-lead`: `{ nome, email, telefone, cidade, tipoImovel, preferenciaContato, plano, descricao, engenheiro }`, tudo string e já com os rótulos legíveis. Plano ausente vira `—`; sem engenheiro, `Sem atribuição`.
  - `nova-candidatura`: `{ nome, email, telefone, cidade, area }`.
  - `diagnostico-recebido`: `{ nome }`.
- `renderTemplate<N extends TemplateName>(name: N, data: TemplateDataMap[N])` e `enqueueEmail` passam a ser tipados por template. O `outbox` continua apagando `link` dos dados depois do envio.
- Assuntos:
  - `novo-lead`: `Novo diagnóstico: {nome} ({cidade})`
  - `nova-candidatura`: `Nova candidatura: {nome} ({area})`
  - `diagnostico-recebido`: `Recebemos sua nova solicitação`
- Corpo do `diagnostico-recebido`: `Recebemos sua nova solicitação de diagnóstico. Seu engenheiro responsável vai entrar em contato. Você também acompanha tudo pela plataforma.`, mais o link `${APP_ORIGIN}/app/login`. Como ele não leva `link` de token, use o campo `loginUrl`.

- [ ] **Step 1: Escrever os testes**
  - `novo-lead` escapa HTML no nome (`<b>`) e mostra `Sem atribuição`.
  - `nova-candidatura` traz a área no assunto.
  - `loadConfig exige TEAM_EMAIL em produção`.
- [ ] **Step 2:** `pnpm --filter api test -- templates config` → FAIL.
- [ ] **Step 3:** Implementar. Cada template continua sendo um `Content` declarativo; o texto e o HTML vêm do mesmo conteúdo. Todo código novo leva JSDoc em pt-BR, e os tipos vão para `types/`.
- [ ] **Step 4:** `pnpm --filter api test` → PASS.
- [ ] **Step 5:** Commit `feat(api): e-mails de novo lead, nova candidatura e diagnóstico adicional`.

### Task 6: Módulo `public` — rotas de diagnóstico e candidatura

**Files:**
- Create:
  - `apps/api/src/routes/public.routes.ts` e `apps/api/src/controllers/public.controller.ts`
  - `apps/api/src/services/diagnostic.service.ts` e `apps/api/src/services/application.service.ts`
  - `apps/api/src/types/public.types.ts` (se precisar)
  - `apps/api/tests/routes/public-diagnostics.test.ts` e `apps/api/tests/routes/public-applications.test.ts`
- Modify: `apps/api/src/routes/index.ts`

**Interfaces:**
- Consumes:
  - `diagnosticInput` e `applicationInput` (Task 1);
  - `pickEngineer` e `floorplanFor` (Task 2);
  - `enqueueEmail` tipado (Task 5);
  - `sendInvite(db, config, userId)` (plano 1).
- Produces:
  - `publicRoutes(deps: { db: Db; config: Config })` em `routes/public.routes.ts`, registrado pelo `routes/index.ts`; os handlers ficam no `public.controller.ts`;
  - `submitDiagnostic(db: Db, config: Config, input: DiagnosticInput, now?: Date): Promise<void>`;
  - `submitApplication(db: Db, config: Config, input: ApplicationInput, now?: Date): Promise<void>`.

**Regras de `submitDiagnostic`** (tudo numa única transação):
1. Grava o lead com `consent_at = now`.
2. Procura um usuário com o e-mail. O e-mail chega normalizado pelo schema. Há três casos:
   - **Não existe:**
     - `insert users (role 'cliente', status 'convidado', nome, email, telefone, cidade) on conflict (email) do nothing returning id`. Se não voltar linha, porque um envio concorrente criou o usuário, segue pelo ramo "cliente existente".
     - Cria `clients` com `engineer_id = pickEngineer()?.id ?? null`.
     - Cria o `properties` (`apelido = '{rótulo do tipo} · {cidade}'`), os `property_attributes` com a ordem do modelo (`Tipo de imóvel`, `Cidade`, `Telefone`, `E-mail`, `Preferência de contato` e, se houver, `Descrição do problema` e `Plano de interesse`) e a maquete de `floorplanFor`.
     - Cria a `service_requests` com `property_id` do imóvel e `descricao = 'Diagnóstico inicial — {tipo}{ · plano}{: descrição até 120 caracteres}'`.
     - Envia `sendInvite`.
   - **É cliente:**
     - Não altera dados da conta.
     - Cria a `service_requests` com `property_id null` e `descricao` começando com `Diagnóstico adicional — `.
     - Se o cliente está `convidado`, envia `sendInvite` (reenvio); se está `ativo`, enfileira `diagnostico-recebido`; se está `bloqueado`, não envia nada ao cliente.
   - **É outro perfil:** não cria cliente nem solicitação; só o lead.
3. O lead recebe `client_id` e `engineer_id` (o do cliente, quando houver).
4. Sempre enfileira `novo-lead` para `TEAM_EMAIL`.

**Regras de `submitApplication`:** grava a candidatura `pendente` e enfileira `nova-candidatura`. Não cria usuário em nenhum caso.

**Rotas:**
- `POST /api/public/diagnostics` e `POST /api/public/applications`.
- `config.rateLimit = { max: 5, timeWindow: '15 minutes', keyGenerator: (r) => r.ip }`.
- Com `website` não vazio, respondem `204` sem chamar o serviço; caso contrário, chamam o serviço e respondem `204`.

- [ ] **Step 1: Escrever os testes de integração** (Postgres real e `testApp`; enviam `Origin`)
  - `diagnóstico novo cria lead, cliente, imóvel, 2 andares do sobrado, solicitação "Em análise" e enfileira convite + aviso à equipe`.
  - `atribui ao engenheiro ativo com menos clientes`.
  - `sem engenheiro ativo: cliente sem engenheiro, lead sem atribuição, convite e aviso com "Sem atribuição"`.
  - `e-mail de cliente existente com maiúsculas e espaços: nenhuma conta nova, solicitação adicional sem imóvel, dados da conta intactos`.
  - `cliente existente ativo recebe "diagnostico-recebido"; convidado recebe novo convite; bloqueado não recebe nada`.
  - `e-mail de engenheiro: só grava o lead, resposta 204`.
  - `dois envios simultâneos do mesmo e-mail novo criam 1 usuário e 1 cliente` (`Promise.all`).
  - `honeypot preenchido: 204, nenhuma linha em diagnostic_leads nem em email_outbox`.
  - `corpo inválido: 400 com fields.telefone = "Informe um telefone válido."`.
  - `6º envio do mesmo IP em 15 min: 429`.
  - `sem Origin: 403` (garante que a checagem global vale para as rotas públicas).
  - `candidatura cria registro pendente, avisa a equipe e não cria usuário`, inclusive com e-mail de usuário já existente.
- [ ] **Step 2:** `pnpm --filter api test -- public` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm --filter api test` → PASS.
- [ ] **Step 5:** Commit `feat(api): rotas públicas de diagnóstico e candidatura`.

### Task 7: Base do site — layout, estilos, assets e conteúdo

**Files:**
- Create:
  - `apps/site/src/content.config.ts`
  - `apps/site/src/content/{pacotes,faq,servicos,cidades}.json`
  - `apps/site/src/layouts/SiteLayout.astro`
  - `apps/site/src/components/site/{Header,Footer,Icon,Logo,Seo}.astro`
  - `apps/site/src/styles/site.css`
  - `apps/site/src/assets/hero.webp`
  - `apps/site/src/icons/sprite.svg`
  - `apps/site/scripts/extract-model-assets.ts`
- Modify: `apps/site/astro.config.mjs`, `apps/site/package.json`, `apps/site/src/styles/tokens.css`

**Interfaces:**
- `scripts/extract-model-assets.ts` lê `docs/referencia/modelo-4-plataforma.html` e grava:
  - `src/assets/hero.webp`, a partir do único `data:image/webp`;
  - `src/icons/sprite.svg`, com os 30 `<symbol id="fx4-*">` e também o símbolo do logo usado no header.
  - Roda uma vez (`node apps/site/scripts/extract-model-assets.ts`). As saídas entram no git.
- Collections (loader `file()`):
  - `pacotes`: `{ id: PlanId, nome, preco, descricao, itens: string[], destaque: boolean, ordem }`, com os 4 cards do modelo; `3m` é o destaque.
  - `faq`: `{ id, pergunta, resposta, ordem }`, com as 10 perguntas do modelo.
  - `servicos`: `{ id: slug, nome, busca, descricao, icone, ordem }`, com os 12 serviços do grid do modelo. O campo `busca` é o termo de busca local:
    - `eletrica` → `Eletricista`;
    - `hidraulica` → `Encanador`;
    - `gas` → `Instalador de gás`;
    - `ar-condicionado` → `Técnico de ar-condicionado`;
    - `pintura` → `Pintor`;
    - `marcenaria` → `Marceneiro`;
    - `alvenaria` → `Pedreiro`;
    - `portas-e-janelas` → `Instalação de portas e janelas`;
    - `impermeabilizacao` → `Impermeabilização`;
    - `seguranca-residencial` → `Segurança residencial`;
    - `area-externa` → `Manutenção de área externa`;
    - `pequenos-reparos` → `Pequenos reparos`.
  - `cidades`: `{ id: slug, nome, uf }`. É uma lista provisória até o cliente confirmar: São Paulo, Santo André, São Bernardo do Campo, São Caetano do Sul, Guarulhos e Osasco, todas `SP`.
- `astro.config.mjs`:
  - `site: process.env.SITE_URL ?? 'https://www.fixable.com.br'`, `trailingSlash: 'never'` e `build.format: 'directory'`;
  - integração `@astrojs/sitemap`, com filtro que exclui `/app` e as páginas legais.
- `SiteLayout.astro`: props `{ title: string; description: string; jsonLd?: object[]; noindex?: boolean }`.
- `Seo.astro`:
  - `<title>`, meta description e canonical (`new URL(Astro.url.pathname, Astro.site)`);
  - `og:title`, `og:description`, `og:url`, `og:image` (hero otimizado), `og:locale=pt_BR`, `twitter:card=summary_large_image`;
  - `robots noindex` quando pedido, e `<script type="application/ld+json">` para cada objeto de `jsonLd`.
- Fontes: as `@fontsource` são importadas em `site.css` e em `tokens.css`, substituindo o `@import` do Google Fonts.
- `site.css`: as regras de seção do modelo (`#nav`, `.editorial-*`, `.report-*`, `.card`, `.pkg-*`, `.fixid-*`, `.pros-*`, `.biz-*`, `.form-*`, `.faq-*` e `footer`) e o modo escuro do modelo.
- Header: os links do modelo apontam para âncoras da home (`/#how` etc.).
  - "Entrar" é `<a href="/app/login">`.
  - "Solicitar diagnóstico" é `<a href="/#solicitar">`.
  - O menu mobile é um `<button aria-expanded aria-controls>` controlado por um `<script>` no componente.
- Footer: o do modelo, com `Termos de uso`, `Privacidade` e `LGPD` levando a `/termos-de-uso`, `/privacidade` e `/privacidade#lgpd`.

- [ ] **Step 1:** Instalar as dependências e escrever e rodar o script de extração. Conferir que `hero.webp` abre e que o sprite tem 30 símbolos ou mais.
- [ ] **Step 2:** Criar as collections e os JSON. `pnpm --filter site astro sync` deve passar sem erro de schema.
- [ ] **Step 3:** Criar o layout, os componentes e o CSS. Trocar o `index.astro` placeholder por uma página com `SiteLayout`, só header e footer por enquanto.
- [ ] **Step 4:** `pnpm --filter site build` → PASS. Conferir que `dist/index.html` não tem `<script` além do menu mobile.
- [ ] **Step 5:** Commit `feat(site): layout público, conteúdo em collections e assets do modelo`.

### Task 8: Seções da home

**Files:**
- Create: `apps/site/src/components/site/sections/{Hero,Checkup,HowItWorks,Services,Problem,Packages,FixableId,Guarantee,Professionals,ForBusiness,Faq}.astro`
- Modify: `apps/site/src/pages/index.astro`

**Interfaces:**
- A ordem e os textos são os do modelo (linhas 33–210 do HTML de referência), e os ids das seções ficam iguais (`hero`, `checkup`, `how`, `services`, `problem`, `packages`, `fixable-id`, `guarantee`, `professionals`, `for-business`, `solicitar`, `time-fixable`, `faq`).
- `Hero` usa `<Picture>` de `astro:assets` com `hero.webp`, `loading="eager"`, `fetchpriority="high"`, larguras `[640, 1024, 1440]` e o `alt` do modelo.
- `Services` lê a collection `servicos`. O "Saiba mais" de cada card leva a `/servicos/{id}`.
- `Packages` lê `pacotes`. O botão é `<a href="/?plano={id}#solicitar">`.
- `Faq` lê `faq` e usa `<details>`/`<summary>` nativos, sem JS.
- `#solicitar` e `#time-fixable` ficam com o título, o texto do modelo e um `<div>` onde a Task 9 monta a ilha.
- A home recebe o JSON-LD `Organization` (`name: 'Fixable'`, `url`, `email: 'contato@fixable.com.br'`, `telephone: '+55 11 90000-0000'`, `logo`).

- [ ] **Step 1:** Implementar as seções.
- [ ] **Step 2:** `pnpm --filter site build` → PASS. `pnpm --filter site preview` e conferir manualmente, contra o modelo, em 375, 768 e 1440 px (o PRD exclui teste automatizado de fidelidade visual).
- [ ] **Step 3:** Commit `feat(site): seções da home do modelo 4`.

### Task 9: Formulários de diagnóstico e candidatura (ilhas React)

**Files:**
- Create:
  - `apps/site/src/components/forms/DiagnosticForm.tsx` e `DiagnosticForm.test.tsx`
  - `apps/site/src/components/forms/ApplicationForm.tsx` e `ApplicationForm.test.tsx`
  - `apps/site/src/components/forms/public-submit.ts` e `public-submit.test.ts`
  - `apps/site/src/components/forms/ConsentField.tsx`
- Modify: `apps/site/src/components/site/sections/` (montagem das ilhas em `#solicitar` e `#time-fixable`)

**Interfaces:**
- `submitPublicForm(url: string, body: unknown): Promise<{ ok: true } | { ok: false; fields?: Record<string, string>; message: string }>` faz um `fetch` com `credentials: 'same-origin'` e trata as respostas assim:
  - `204` → `ok: true`;
  - `400` → `fields` da API mais a mensagem `Confira os campos destacados.`;
  - `429` → `Muitas tentativas. Aguarde alguns minutos e tente de novo.`;
  - qualquer outra resposta ou erro de rede → `Não foi possível enviar agora. Tente de novo em instantes.`
- `DiagnosticForm` (props `Readonly<{ cidadeInicial?: string }>`):
  - Valida com `diagnosticInput.safeParse` antes de enviar e mostra o erro de cada campo em `<span class="err">`, ligado ao campo por `aria-describedby`. O foco vai para o primeiro campo inválido.
  - Lê `?plano=` de `window.location.search` na montagem. Um id de `PLANS` mostra o chip `Plano de interesse: {nome}` com o botão `Remover`; qualquer outro valor é ignorado.
  - `cidadeInicial` preenche Cidade.
  - O honeypot `website` é um campo fora da tela (`aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`).
  - Enquanto envia, o botão fica desabilitado com o texto `Enviando...`.
  - Depois do sucesso, mostra a copy de sucesso e o botão `Enviar outra solicitação`, que limpa o formulário.
- `ApplicationForm`: os mesmos padrões, com os campos do modelo e o botão `Fazer meu cadastro`.
- `ConsentField`: checkbox obrigatório com o texto `Li e aceito os <a href="/termos-de-uso">termos de uso</a> e a <a href="/privacidade">política de privacidade</a>.`
- Montagem: `<DiagnosticForm client:visible />` e `<ApplicationForm client:visible />`.

- [ ] **Step 1: Escrever os testes** (Vitest + Testing Library; `fetch` mockado)
  - `enviar vazio mostra os erros por campo e não chama fetch`.
  - `envio válido manda o corpo normalizado para /api/public/diagnostics e mostra "Solicitação registrada."`.
  - `?plano=3m mostra o chip "Plano para 3 meses"; Remover tira o chip e o plano do corpo`.
  - `?plano=xyz não mostra chip`.
  - `400 da API marca o campo devolvido em fields`.
  - `429 mostra "Muitas tentativas..."`.
  - `cidadeInicial preenche Cidade`.
  - `sem aceitar os termos mostra a mensagem de consentimento`.
  - `candidatura válida mostra "Cadastro recebido."`.
- [ ] **Step 2:** `pnpm --filter site test` → FAIL.
- [ ] **Step 3:** Implementar e montar as ilhas.
- [ ] **Step 4:** `pnpm --filter site test` e `pnpm --filter site build` → PASS.
- [ ] **Step 5:** Commit `feat(site): formulários de diagnóstico e candidatura ligados à API`.

### Task 10: Páginas serviço × cidade, páginas legais e checagem de SEO

**Files:**
- Create:
  - `apps/site/src/pages/servicos/[servico]/index.astro`
  - `apps/site/src/pages/servicos/[servico]/[cidade].astro`
  - `apps/site/src/pages/termos-de-uso.astro` e `apps/site/src/pages/privacidade.astro`
  - `apps/site/src/pages/404.astro` e `apps/site/src/pages/robots.txt.ts`
  - `apps/site/scripts/seo-check.ts` e `apps/site/scripts/seo-check.test.ts`
- Modify: `apps/site/package.json` (script `seo:check`), `package.json` da raiz (script `seo:check`), `infra/nginx/fixable.conf`

**Interfaces:**
- `/servicos/{servico}`:
  - título `{busca} | Fixable`;
  - H1 `{nome}`;
  - a descrição do serviço, os 4 passos de "Como funciona" e a lista de links para as cidades.
- `/servicos/{servico}/{cidade}`:
  - título `{busca} em {cidade} - {uf} | Fixable`;
  - description `{descricao} Atendimento em {cidade} com engenheiro responsável e profissionais certificados. Solicite seu diagnóstico.`;
  - H1 `{busca} em {cidade}`;
  - o `<DiagnosticForm client:visible cidadeInicial={cidade.nome} />`;
  - JSON-LD `Service` (`serviceType: nome`, `areaServed: { '@type': 'City', name }` e `provider` do tipo `LocalBusiness`, com nome, url, e-mail e telefone da Fixable).
- Páginas legais: `noindex`, com o texto `Documento em elaboração. Dúvidas: contato@fixable.com.br.`; a privacidade tem a âncora `lgpd`.
- `robots.txt`: `User-agent: *`, `Allow: /`, `Disallow: /app/` e `Sitemap: {site}/sitemap-index.xml`.
- `404.astro`: usa o `SiteLayout` com `noindex` e um link para a home.
- nginx:
  - `location / { try_files $uri $uri/index.html =404; }`;
  - `error_page 404 /404.html;`.
- `seo-check.ts` (`checkSeo(distDir: string): string[]`, que devolve a lista de problemas) lê os HTML de `dist/` e confere:
  - cada página indexável tem `<title>`, description e canonical, todos únicos;
  - o JSON-LD faz `JSON.parse` sem erro;
  - todas as páginas `servicos/*/*` e a home estão no sitemap;
  - nenhuma página `noindex` nem `/app` está no sitemap;
  - a home tem um `<h1>` só.
  - `pnpm seo:check` roda o build e sai com código 1 se houver problema.

- [ ] **Step 1:** Testes de `checkSeo` com uma `dist` de fixture em diretório temporário:
  - título duplicado é apontado;
  - JSON-LD inválido é apontado;
  - página de serviço fora do sitemap é apontada;
  - fixture correta devolve `[]`.
- [ ] **Step 2:** `pnpm --filter site test -- seo-check` → FAIL.
- [ ] **Step 3:** Implementar as páginas e o script.
- [ ] **Step 4:** `pnpm seo:check` → sem problemas, com 12 páginas de serviço e 72 de serviço × cidade. Lighthouse mobile na home pelo `pnpm --filter site preview` (`npx lighthouse http://localhost:4321 --form-factor=mobile --only-categories=performance,seo,accessibility`) deve dar ≥ 90 nas três categorias. Registrar as notas no relatório.
- [ ] **Step 5:** Commit `feat(site): páginas serviço × cidade, sitemap, robots e checagem de SEO`.

### Task 11: Pendências do plano 1

**Files:**
- Modify:
  - `apps/site/src/app/App.tsx` e `apps/site/src/app/api.ts`
  - `apps/site/src/app/auth/ForgotPasswordPage.tsx` e o teste dela
  - `apps/api/src/utils/log-redaction.ts` e `apps/api/tests/utils/log-redaction.test.ts`
- Create: `apps/site/src/app/NotFoundPage.tsx`, `apps/site/src/app/App.test.tsx`
- Todo arquivo novo ou alterado segue as Convenções de arquitetura (JSDoc e tipos em `types/`).

**Interfaces e regras:**
- 401 global: `QueryCache({ onError })` e `MutationCache({ onError })`. Quando o erro é `ApiError` com status 401 e a query não é `['me']`, fazem `queryClient.setQueryData(['me'], null)`, e o `RequireAuth` leva ao login com `?next`.
- Rota `*` em `/app` renderiza `NotFoundPage`, com o texto `Página não encontrada.` e um link `Voltar ao início` para `/app`.
- `serializeError(value)` devolve o valor intacto quando ele não é `Error`.
- Erros do Postgres: `cause.detail` e `detail` são trocados por `[redacted]`.
- Copy do "esqueci a senha": `Se houver uma conta com este e-mail, enviamos um link para você criar ou redefinir sua senha.`

- [ ] **Step 1: Escrever os testes**
  - uma query que recebe 401 limpa `me` e leva a `/login?next=...`;
  - `/app/qualquer-coisa` mostra `Página não encontrada.`;
  - `serializeError('texto') === 'texto'`;
  - um erro com `cause.detail` sai com `[redacted]`;
  - a nova copy do "esqueci a senha".
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm test` → PASS.
- [ ] **Step 5:** Commit `fix: pendências do plano 1 (401 global, rota 404, redação de logs e texto do esqueci a senha)`.

### Task 12: E2E do site público e smoke atrás do nginx

**Files:**
- Create: `apps/site/e2e/public.spec.ts`, `apps/site/e2e/nginx-smoke.spec.ts`, `apps/site/playwright.nginx.config.ts`
- Modify: `compose.yml` (serviço `web` no profile `smoke`), `package.json` da raiz (script `e2e:nginx`), `README.md`

**Interfaces:**
- `public.spec.ts`, contra o dev (mesmo `playwright.config.ts` do plano 1):
  1. `visitante solicita diagnóstico com plano e cria a senha pelo convite`:
     - abre `/`, clica em "Solicitar orçamento" do Plano para 3 meses e vê o chip;
     - preenche, aceita os termos, envia e vê `Solicitação registrada.`;
     - lê o convite no Mailpit, cria a senha e cai em `/app/cliente`.
  2. `candidato envia o cadastro e vê "Cadastro recebido."`.
  3. `página Eletricista em Santo André tem a cidade pré-preenchida`.
  4. `home abre sem login e sem chamar /api/auth/me` (verificado pelo `page.on('request')`).
- `web` no compose:
  - `nginx:1.27-alpine`, porta `8080:80`;
  - monta `apps/site/dist` em `/usr/share/nginx/html` e `infra/nginx/fixable.conf` em `/etc/nginx/conf.d/default.conf`;
  - depende de `api`; `profiles: [smoke]`.
- `pnpm e2e:nginx` faz, em ordem:
  1. `pnpm --filter site build`;
  2. `docker compose --profile smoke up -d web`;
  3. Playwright com `playwright.nginx.config.ts` (`baseURL http://localhost:8080`, projetos `chromium` e `webkit`).
- `nginx-smoke.spec.ts`: o admin criado pelo CLI faz login em `http://localhost:8080/app/login` e chega a `/app/admin`, o que prova que `Referrer-Policy` e a checagem de Origin convivem. Também abre `/servicos/eletrica/santo-andre` com status 200 e `/nao-existe` com 404.

- [ ] **Step 1:** Escrever os specs.
- [ ] **Step 2:** `pnpm e2e` → PASS (3 do plano 1 e 4 novos).
- [ ] **Step 3:** `pnpm --filter site exec playwright install webkit` e `pnpm e2e:nginx` → PASS nos dois navegadores.
- [ ] **Step 4:** Atualizar o README com `pnpm seo:check` e `pnpm e2e:nginx`.
- [ ] **Step 5:** Commit `test(e2e): fluxo público de diagnóstico e candidatura, e smoke atrás do nginx`.
