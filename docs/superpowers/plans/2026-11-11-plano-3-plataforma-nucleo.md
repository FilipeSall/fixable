# Plano 3 — Plataforma núcleo e deploy mínimo: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A plataforma logada fica funcional para três perfis, no visual do Modelo 4, e o sistema sobe num servidor real com HTTPS:
- **admin:** leads, candidaturas e convites;
- **engenheiro:** clientes, imóveis, maquete, serviços, solicitações e agendamentos;
- **cliente:** acompanha o próprio imóvel.

**Architecture:**
- **API:** segue o MVC + services, com um módulo central de políticas de acesso. Quem não pode ver um recurso recebe 404.
- **SPA `/app`:** organizada por feature (`features/<área>/{pages,components,hooks,api.ts}` mais `shared/`), com React Query para os dados e o shell, as abas, os modais e a maquete portados do modelo.
- **Engenheiro e cliente:** usam a **mesma página do cliente**. O engenheiro vê com edição e o cliente só leitura, como no modelo.
- **Deploy:** um `compose` de produção com Caddy (HTTPS automático, arquivos estáticos e proxy de `/api`), a API, o Postgres e um backup diário.

**Tech Stack:** a dos planos 1 e 2, mais o Caddy 2 no deploy. Nenhuma lib de UI nova.

**Spec:** `docs/superpowers/specs/2026-11-09-plataforma-fixable.md`. Escopo revisado em `docs/superpowers/plans/2026-11-09-roadmap-fixable.md` (seção "Revisão de escopo"). Referência das telas: `docs/referencia/modelo-4-mapa-plataforma.md`, mapa do HTML aprovado com textos, classes CSS e linhas do modelo.

## Global Constraints

- Tudo do `CLAUDE.md` da raiz vale aqui:
  - MVC + services na API;
  - tipos em `types/`;
  - JSDoc em pt-BR em toda função;
  - no máximo 700 linhas por arquivo;
  - sem comentários soltos;
  - testes da API em `apps/api/tests/`.
- Commits na `main`, sem criar branch, com Conventional Commits em pt-BR e rodapé `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Push só quando o controller pedir.
- **SPA por feature:**
  - `apps/site/src/app/features/<area>/{pages,components,hooks}/` e `api.ts`;
  - `apps/site/src/app/shared/{components,hooks,lib}/`;
  - tipos em `apps/site/src/types/`.
  - A feature `auth` existente vai para `features/auth` na Task 7.
- **Permissões, na API:**
  - O cliente só acessa os próprios dados.
  - O engenheiro só acessa clientes com `engineer_id` igual ao dele.
  - O admin acessa tudo.
  - O profissional não acessa nada deste plano.
  - Acesso negado a um recurso específico responde **404** (`{ error: { code: 'not_found', message: 'Recurso não encontrado.' } }`), nunca 403.
  - Rota de papel errado, como o cliente chamando `/api/admin/*`, responde 403 com a mensagem padrão.
- **Status e rótulos,** exatamente os do modelo:
  - Serviço: `prioridade` "Prioridade" (vermelho), `atencao` "Precisa de atenção" (amarelo), `execucao` "Em execução" (azul), `concluido` "Concluído" (verde).
  - Solicitação: `em_analise` "Em análise", `agendado` "Agendado", `em_execucao` "Em execução", `concluido` "Concluído".
  - Agendamento: `confirmado` "Confirmado", `pendente` "Pendente · requer confirmação", `adiado` "Adiado".
- **Regra das 24 h:** um serviço concluído continua em "Serviços em andamento" por 24 h depois de `concluded_at`. Depois disso aparece só no histórico.
- **Maquete:** grade de **6 colunas**. Cada cômodo tem `x` (0–5), `y` (≥ 0), `largura` de 1 a 4 e `altura` de 1 a 2, e não pode se sobrepor a outro. **Sem arrastar:** a posição é editada no modal (campos Coluna e Linha), e um cômodo novo vai para o primeiro espaço livre. Ruling do controller: o drag fica fora do MVP.
- Textos visíveis em pt-BR, copiados do mapa do modelo quando existirem lá.
- Fora do escopo (não implementar):
  - orçamentos;
  - chat;
  - upload de arquivos;
  - projetos e ficha do profissional;
  - catálogo e perfil de profissionais;
  - visão anual do calendário;
  - painel do profissional (fica com a home atual).

## Review Focus

1. **Engenheiro A abre a URL de um cliente do engenheiro B:** recebe 404 na API e "Página não encontrada." na SPA. Teste nas Tasks 3 e 8.
2. **Cômodo movido para uma posição que encosta em outro:** a API recusa com 400 e a mensagem `Essa posição ou tamanho encosta em outro cômodo. Escolha outro lugar ou arraste o cômodo na planta.`. Teste na Task 4.
3. **Serviço concluído há 23 h e há 25 h:** aparece e some de "Serviços em andamento", respectivamente, e aparece no histórico nos dois casos. Teste na Task 4.
4. **Cliente com 2 imóveis:** alterna entre eles, e cada um mostra a própria maquete, os próprios serviços e os próprios agendamentos. Teste nas Tasks 3 e 8.
5. **Aprovar a mesma candidatura duas vezes (duplo clique):** cria uma conta só e envia um convite só. Teste na Task 6.

---

### Task 1: Schemas e constantes da plataforma em `packages/shared`

**Files:**
- Create: `packages/shared/src/platform.ts`, `packages/shared/src/types/platform.types.ts`, `packages/shared/src/platform.test.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/routes.ts`

**Interfaces (Produces):**
- Constantes e rótulos:
  - `SERVICE_STATUSES` e `SERVICE_STATUS_LABELS`;
  - `APPOINTMENT_STATUSES` e `APPOINTMENT_STATUS_LABELS`;
  - `SERVICE_REQUEST_STATUSES`, que já existe, ganha os rótulos acima;
  - `MAQUETE_COLUMNS = 6`.
- Schemas de entrada:
  - `floorInput { nome }`;
  - `roomInput { floorId, nome, largura: 1..4, altura: 1..2, x?: 0..5, y?: ≥0 }`;
  - `serviceInput { roomId, titulo, descricao?, status, prazo?: 'YYYY-MM-DD', percentual: 0..100 }`;
  - `serviceRequestInput { descricao (mín. 3: 'Descreva o que foi solicitado.'), status, propertyId? }`;
  - `appointmentInput { propertyId, servico (mín. 3: 'Informe o serviço.'), data ('Informe uma data válida.'), hora ('Informe o horário.'), status, descricao? }`;
  - `propertyAttributeInput { chave, valor }` (`'Preencha a informação e o valor.'`);
  - `propertyInput { apelido, tipo, cidade }`;
  - `teamInviteInput { nome, email, role: 'engenheiro' | 'admin' }`.
- Schemas de resposta: um `z.object` para cada recurso listado na Task 3 em diante, com os tipos em `types/platform.types.ts`.
- Rotas em `API`: `clients`, `client(id)`, `clientProperties(id)`, `property(id)`, `propertyAttributes(id)`, `floorplan(propertyId)`, `floors(propertyId)`, `floor(id)`, `rooms(floorId)`, `room(id)`, `propertyServices(id)`, `service(id)`, `serviceComplete(id)`, `propertyHistory(id)`, `clientRequests(id)`, `request(id)`, `clientAppointments(id)`, `appointment(id)`, `adminLeads`, `adminApplications`, `adminApplicationApprove(id)`, `adminApplicationRefuse(id)`, `adminInvites`, `meClient`.

- [ ] **Step 1: Testes**
  - `roomInput` recusa largura 5 e x 6;
  - `serviceInput` recusa percentual 101 e prazo `31/12/2026`;
  - `appointmentInput` vazio devolve as 3 mensagens fixas;
  - os rótulos batem com as Global Constraints.
- [ ] **Step 2:** `pnpm --filter @fixable/shared test` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(shared): schemas e constantes da plataforma núcleo`.

### Task 2: Models de serviços e agendamentos, posição dos cômodos

**Files:**
- Create: `apps/api/src/models/service.model.ts`, `apps/api/src/models/appointment.model.ts`, a migration `0004_*` via `pnpm --filter api db:generate` e `apps/api/tests/models/platform.model.test.ts`
- Modify: `apps/api/src/models/floorplan.model.ts` (rooms ganham `x` e `y` int not null default 0), `apps/api/src/models/index.ts`, `apps/api/src/services/client-onboarding.service.ts` e `apps/api/src/services/floorplan.service.ts`

**Interfaces:**
- `services` (cada serviço fica num cômodo):
  - `room_id`, FK rooms com cascade;
  - `property_id`, FK com cascade, guardado para filtrar;
  - `titulo`, `descricao` (nullable), `status` (enum `service_status`), `prazo` (date, nullable), `percentual` (int 0–100, default 0, com CHECK);
  - `concluded_at` (timestamptz, nullable), `created_at` e `updated_at`.
  - Índices: `property_id` e `room_id`.
- `appointments`:
  - `client_id` e `property_id`, FKs com cascade;
  - `servico`, `data` (date), `hora` (time), `status` (enum `appointment_status`, default `pendente`), `descricao` (nullable);
  - `created_at` e `updated_at`.
  - Índice: `(client_id, data)`.
- `rooms`: colunas novas `x` e `y`.
  - A migration preenche as posições dos cômodos existentes com o mesmo algoritmo de `firstFreeSpot`, andar por andar, na ordem de `posicao`. Se o SQL ficar complexo, pode ser um script TS chamado pela migration; descreva no relatório.
- `floorplan.service.ts` ganha `firstFreeSpot(rooms: {x,y,largura,altura}[], largura, altura): {x, y}` (varre linha a linha, coluna a coluna, dentro de 6 colunas) e `overlaps(a, b)`.
  - O onboarding da Task 6 do plano 2 passa a gravar `x` e `y` usando `firstFreeSpot`.

- [ ] **Step 1: Testes**
  - `firstFreeSpot` em grade vazia → `{0,0}`;
  - depois de uma sala 3×2, um cômodo 2×1 vai para `{3,0}`;
  - um cômodo largo 4×1 numa linha com 3 colunas ocupadas desce de linha;
  - `overlaps` com bordas encostadas → false;
  - o onboarding de um sobrado grava posições sem sobreposição.
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar. Gerar a migration e conferir que ela só traz os objetos desta task.
- [ ] **Step 4:** `pnpm --filter api test` → PASS; `pnpm --filter api db:migrate` num banco limpo → OK.
- [ ] **Step 5:** Commit `feat(api): serviços, agendamentos e posição dos cômodos na maquete`.

### Task 3: Políticas de acesso, clientes, imóveis e dados do imóvel

**Files:**
- Create:
  - `apps/api/src/services/access-policy.service.ts`
  - `apps/api/src/services/client.service.ts` e `apps/api/src/services/property.service.ts`
  - `apps/api/src/controllers/client.controller.ts` e `apps/api/src/controllers/property.controller.ts`
  - `apps/api/src/routes/client.routes.ts` e `apps/api/src/routes/property.routes.ts`
  - `apps/api/src/types/platform.types.ts`
  - `apps/api/tests/routes/clients.test.ts`, `apps/api/tests/routes/properties.test.ts` e `apps/api/tests/services/access-policy.service.test.ts`
- Modify: `apps/api/src/routes/index.ts`, `apps/api/tests/helpers.ts` (fábricas `createClientWithProperty` e `createEngineer`)

**Interfaces:**
- `access-policy.service.ts`:
  - `loadClientScope(db, user, clientId): Promise<{ clientId, engineerId } | null>` devolve null quando o usuário não pode ver aquele cliente;
  - `requireClientAccess(db, user, clientId, mode: 'read' | 'write')` lança `AppError(404, 'not_found', 'Recurso não encontrado.')`. Só engenheiro dono e admin escrevem; o cliente só lê.
  - `requirePropertyAccess(db, user, propertyId, mode)` resolve o cliente do imóvel e reaplica a mesma regra.
  - Todas as rotas de cliente e imóvel deste plano e dos seguintes usam essas funções.
- Rotas (todas com `requireAuth`):
  - `GET /api/me/client` (cliente): `{ clientId }`.
  - `GET /api/clients` (engenheiro: os seus; admin: todos):
    - `stats { clientes, solicitacoesAbertas, servicosEmAndamento, agendamentosAConfirmar }`;
    - `clients[]` com `{ id, nome, tipoImovel, cidade, novo (criado há menos de 7 dias), servicosAtivos, solicitacoesAbertas }`, ordenado por `created_at` desc.
  - `GET /api/clients/:id`: `{ id, nome, email, telefone, engenheiro: { nome } | null, properties: [{ id, apelido, tipo, cidade }] }`.
  - `POST /api/clients/:id/properties` (escrita): cria o imóvel com a planta padrão do tipo.
  - `GET /api/properties/:id/attributes`; `POST` adiciona; `PATCH /api/properties/:id/attributes/:attrId` edita; `DELETE` remove.
    - Chave duplicada responde 400 `Já existe uma informação com esse nome. Edite a existente.`.

- [ ] **Step 1: Testes de integração** (matriz de permissão)
  - cliente lê o próprio cliente → 200; lê outro → 404;
  - engenheiro A lê cliente de B → 404; escreve atributo em cliente de B → 404;
  - cliente tenta `POST` atributo no próprio imóvel → 404;
  - admin lê qualquer um → 200;
  - profissional em `GET /api/clients` → 403;
  - lista do engenheiro só com os clientes dele e as contagens certas;
  - cliente com 2 imóveis recebe os 2 em `properties`;
  - CRUD de atributos, incluindo a chave duplicada.
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(api): políticas de acesso, clientes, imóveis e dados do imóvel`.

### Task 4: Maquete e serviços

**Files:**
- Create:
  - `apps/api/src/services/maquete.service.ts` e `apps/api/src/services/room-service.service.ts`
  - os controllers e as routes correspondentes
  - `apps/api/tests/routes/maquete.test.ts` e `apps/api/tests/routes/services.test.ts`

**Interfaces:**
- Maquete:
  - `GET /api/properties/:id/floorplan`: `{ floors: [{ id, nome, posicao, rooms: [{ id, nome, x, y, largura, altura }] }], services: [...visíveis] }`. Serviços visíveis são os não concluídos e os concluídos há menos de 24 h.
  - `POST /api/properties/:id/floors`: o nome padrão é `Andar {n+1}`.
  - `PATCH /api/floors/:id`: `{ nome }`.
  - `DELETE /api/floors/:id`: recusa com 400 se for o único andar, ou se tiver serviço não concluído (`Este andar tem serviços ativos. Conclua ou mova os serviços antes de excluir.`).
- Cômodos:
  - `POST /api/floors/:id/rooms`: sem `x`/`y`, usa `firstFreeSpot`.
  - `PATCH /api/rooms/:id`: recusa sobreposição, com a mensagem do Review Focus 2, e `x + largura > 6`.
  - `DELETE /api/rooms/:id`: recusa se houver serviço não concluído (`Este cômodo tem serviços ativos. Conclua ou mova os serviços antes de excluir.`).
- Serviços:
  - `POST /api/properties/:id/services`: o `roomId` precisa ser do imóvel, senão 400.
  - `PATCH /api/services/:id`: mudar o status para `concluido` grava `concluded_at` e `percentual = 100`.
  - `POST /api/services/:id/complete` faz o mesmo e é idempotente.
  - `GET /api/properties/:id/history`: concluídos por `concluded_at` desc, com o nome do andar e do cômodo.
- O tempo vem de um relógio injetável no service (`clock: () => Date`), para os testes das 24 h.
- Todas as rotas usam `requirePropertyAccess`. Escrita é só do engenheiro dono e do admin.

- [ ] **Step 1: Testes**
  - os 5 itens do Review Focus que cabem aqui (2 e 3);
  - cômodo novo no primeiro espaço livre;
  - excluir andar ou cômodo com serviço ativo → 400;
  - excluir o único andar → 400;
  - `roomId` de outro imóvel → 400;
  - cliente vê a maquete e o histórico e recebe 404 ao tentar escrever;
  - engenheiro de outro cliente → 404.
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(api): maquete e serviços com histórico de manutenção`.

### Task 5: Solicitações e agendamentos

**Files:**
- Create:
  - `apps/api/src/services/service-request.service.ts` e `apps/api/src/services/appointment.service.ts`
  - os controllers e as routes correspondentes
  - `apps/api/src/views/emails/agendamento.ts`
  - `apps/api/tests/routes/requests.test.ts` e `apps/api/tests/routes/appointments.test.ts`
- Modify: `apps/api/src/types/mail.types.ts`, `apps/api/src/views/emails/render.ts`

**Interfaces:**
- Solicitações:
  - `GET /api/clients/:id/requests`: lista do cliente, mais recente primeiro, com `{ id, descricao, status, propertyId, propertyApelido, createdAt }`.
  - `POST`, `PATCH /api/requests/:id` e `DELETE /api/requests/:id`: escrita só do engenheiro dono e do admin. `propertyId`, se vier, precisa ser do cliente.
- Agendamentos:
  - `GET /api/clients/:id/appointments?mes=YYYY-MM`: os do mês, por data e hora, opcionalmente filtrados por `propertyId`.
  - `POST`, `PATCH /api/appointments/:id` (inclui troca de status) e `DELETE`.
- E-mail ao cliente quando um agendamento é criado ou alterado (história 23):
  - template `agendamento`, com assunto `Agendamento {criado|atualizado}: {servico}` e corpo com data `dd/mm/aaaa`, hora, status (rótulo) e link para `/app/cliente`;
  - enfileirado na mesma transação.
  - Excluir não envia e-mail.

- [ ] **Step 1: Testes**
  - matriz de permissão como na Task 3;
  - filtro por mês e ordenação;
  - criar e alterar enfileiram o e-mail certo; excluir não enfileira;
  - `propertyId` de outro cliente → 400.
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(api): solicitações e agendamentos com aviso por e-mail`.

### Task 6: Admin — leads, candidaturas e convites da equipe

**Files:**
- Create:
  - `apps/api/src/services/admin.service.ts`, que ganha estas funções somadas ao `createAdmin` existente (ou um `team.service.ts` novo, se o arquivo crescer demais)
  - `apps/api/src/controllers/admin.controller.ts` e `apps/api/src/routes/admin.routes.ts`, com `requireRole('admin')`
  - `apps/api/tests/routes/admin.test.ts`

**Interfaces:**
- `GET /api/admin/leads?atribuicao=todos|sem`: leads por `created_at` desc, com `{ id, nome, email, telefone, cidade, tipoImovel, plano, engenheiro: { nome } | null, createdAt }`.
- `GET /api/admin/applications?status=pendente|aprovada|recusada`.
- `POST /api/admin/applications/:id/approve`, numa transação com `SELECT … FOR UPDATE` na candidatura:
  - se ela não estiver mais `pendente`, responde 409 `Esta candidatura já foi analisada.`;
  - se estiver, cria o usuário (`area` engenheiro → role `engenheiro`; `outro` → role `profissional`), status `convidado`, e envia `sendInvite`;
  - se o e-mail já tiver conta, responde 409 `Já existe uma conta com este e-mail.`.
- `POST /api/admin/applications/:id/refuse`: só marca `recusada`.
- `POST /api/admin/invites` `{ nome, email, role }`:
  - cria o engenheiro ou admin convidado e envia o convite;
  - se o e-mail já tiver conta ativa, responde 409.
- Os papéis e a ordem de locks seguem os planos anteriores: usuário antes de token.

- [ ] **Step 1: Testes**
  - cliente ou engenheiro em `/api/admin/*` → 403;
  - filtro "sem atribuição";
  - aprovar cria a conta e enfileira o convite;
  - aprovar duas vezes em paralelo resulta em 1 conta e 1 convite (Review Focus 5);
  - recusar não cria conta;
  - convite de admin funciona;
  - e-mail repetido → 409.
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(api): painel admin com leads, candidaturas e convites`.

### Task 7: Base da SPA por feature — shell, componentes do modelo e CSS da plataforma

**Files:**
- Move: `apps/site/src/app/auth/*` → `apps/site/src/app/features/auth/*`, com os imports ajustados e sem mudar comportamento.
- Create:
  - `apps/site/src/app/shared/components/{AppShell,SideNav,Crumbs,Tabs,Pill,Modal,ConfirmDialog,Toast,RowCard,AddBox,EmptyState,StatRow,Avatar}.tsx`, com testes dos que têm comportamento (Tabs, Modal, ConfirmDialog e Toast)
  - `apps/site/src/app/shared/hooks/useToast.ts`
  - `apps/site/src/app/shared/lib/format.ts` (`formatDate` dd/mm/aaaa e `formatDateTime`, com testes)
  - `apps/site/src/styles/platform.css`
  - os tipos em `apps/site/src/types/platform-ui.types.ts`
- Modify: `apps/site/src/app/App.tsx` (rotas dentro do `AppShell`), `apps/site/src/app/home/*` (removido ou substituído pelas homes por perfil das próximas tasks)

**Interfaces:**
- `AppShell` (modelo §2 "Shell"):
  - `header.app-top` com o logo (link "Voltar ao site" para `/`), o `.app-role` do perfil ("Painel do cliente", "Painel do engenheiro", "Painel do administrador"), o usuário (nome e subtítulo) e o botão "Sair";
  - sidebar só para engenheiro e admin:
    - engenheiro: rótulo "Gestão", com "Clientes" e "Calendário";
    - admin: rótulo "Administração", com "Leads", "Candidaturas" e "Equipe";
  - o cliente usa o layout `.no-side`.
- `Modal`: `role="dialog"`, `aria-modal`, foco preso, Esc fecha e o foco volta ao gatilho. Tem o rodapé do modelo, com "Excluir" à esquerda, "Cancelar" e o botão principal.
- `ConfirmDialog`: título, texto e o botão de confirmar com o rótulo informado.
- `Toast`: dura 3,2 s, com `role="status"`.
- `platform.css`: as regras das linhas 465–883 do modelo, em `docs/referencia/modelo-4-mapa-plataforma.md` §8, menos o que está fora do escopo (projetos, ficha, chat, orçamentos e lightbox) e menos a `.demo-strip`.
- Rotas:
  - `/cliente` → página do cliente em leitura (Task 8);
  - `/clientes` e `/clientes/:id` → engenheiro (Task 8);
  - `/calendario` → engenheiro (Task 10);
  - `/admin/leads`, `/admin/candidaturas` e `/admin/equipe` (Task 11);
  - a home do admin passa a ser `/admin/leads`; ajustar `ROLE_HOME` no shared;
  - o profissional fica na home atual.
  - Nesta task as páginas podem ser placeholders, desde que a navegação funcione.

- [ ] **Step 1: Testes**
  - o shell de cada perfil mostra os itens certos da sidebar;
  - "Sair" desloga;
  - comportamento de Modal, ConfirmDialog e Toast;
  - `formatDate`;
  - os testes de auth existentes continuam passando depois da mudança de pasta.
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `pnpm test` e `pnpm --filter site build` → PASS.
- [ ] **Step 5:** Commit `feat(site): base da plataforma por feature com o shell e os componentes do modelo`.

### Task 8: Clientes — lista do engenheiro, página do cliente, solicitações e dados do imóvel

**Files:**
- Create:
  - `apps/site/src/app/features/clientes/{pages/ClientesPage.tsx,pages/ClientePage.tsx,pages/MeuPainelPage.tsx,components/ClientCard.tsx,components/PropertySwitcher.tsx,components/SolicitacoesTab.tsx,components/ResidenciaTab.tsx,hooks/*.ts,api.ts}` e os testes
- Modify: `App.tsx` (rotas)

**Interfaces** (textos do modelo §3.1, §3.5 e §4.1–4.2):
- **`ClientesPage`** (engenheiro):
  - `h1` "Clientes" e o subtítulo do modelo;
  - `StatRow` com os 4 números;
  - grade de `ClientCard` com a pill "Novo cliente", os serviços ativos e **as solicitações abertas** (acréscimo pedido pelo PRD);
  - o card abre "Página do cliente";
  - estado vazio do modelo.
- **`ClientePage`** (engenheiro, `/clientes/:id`):
  - crumbs "Clientes / {nome}", `h1` com o nome e o subtítulo do modelo;
  - `PropertySwitcher` (`.fx-tabs` acima das abas), que só aparece quando há mais de um imóvel, mais o botão "+ Novo imóvel" (modal: apelido, tipo e cidade);
  - abas "Solicitações", "Agendamentos", "Serviços em andamento", "Histórico de manutenção" e "Dados da residência". Agendamentos e Serviços chegam nas Tasks 9 e 10; até lá, a aba mostra um `EmptyState`.
- **`MeuPainelPage`** (cliente, `/cliente`):
  - a mesma página em modo leitura, com "Olá, {primeiro nome}." e o subtítulo com o nome do engenheiro;
  - sem botões de edição.
- **`SolicitacoesTab`:** o modal do modelo, com "O que foi solicitado", "Status da atividade" e o campo extra "Imóvel" (opcional), mais os toasts e a confirmação de exclusão.
- **`ResidenciaTab`:** as linhas `.kv`, o CRUD do modal do modelo e a dica para o cliente.
- **404:** um cliente inexistente ou de outro engenheiro mostra `NotFoundPage`.

- [ ] **Step 1: Testes** (Testing Library com a API mockada no `fetch`)
  - lista e cards com as contagens;
  - abrir o cliente;
  - trocar de imóvel muda os dados;
  - o cliente não vê botões de edição;
  - CRUD de solicitação e de atributo, com os toasts;
  - 404 da API mostra "Página não encontrada.".
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(site): clientes, página do cliente, solicitações e dados da residência`.

### Task 9: Maquete, serviços em andamento e histórico

**Files:**
- Create: `apps/site/src/app/features/maquete/{components/MaqueteTab.tsx,components/FloorColumn.tsx,components/RoomGrid.tsx,components/ServiceCard.tsx,components/RoomModal.tsx,components/FloorModal.tsx,components/ServiceModal.tsx,components/HistoricoTab.tsx,hooks/*.ts,api.ts}` e os testes
- Modify: `ClientePage` e `MeuPainelPage` (ligar as abas)

**Interfaces** (modelo §3.3 e §3.4):
- Layout `.mq-wrap`, com a planta `.mq-stage` numa grade de 6 colunas e os cômodos posicionados por `grid-column` e `grid-row`.
- Cada cômodo mostra os pontinhos de status.
- Ao lado fica a coluna de andares, com a contagem de serviços.
- Selecionar um cômodo abre o `.mq-pop` com a lista de `ServiceCard`.
- Abaixo vem "Serviços em {andar}", ordenado como no modelo.
- `ServiceCard` tem a barra de percentual, o prazo, a dica das 24 h ("Já está no histórico de manutenção. Sai desta lista em cerca de {N} h.") e os botões do engenheiro.
- Modais de cômodo, andar e serviço com os campos e as mensagens do modelo.
  - O cômodo tem Coluna e Linha, sem drag.
  - O serviço tem o campo "Progresso (%)" e o select de cômodo agrupado por andar.
- Concluir pede confirmação com o texto do modelo.
- `HistoricoTab` mostra os cards expansíveis e o estado vazio do modelo.
- Cliente: só leitura, com o texto "Toque em um cômodo para ver o andamento dos serviços.".

- [ ] **Step 1: Testes**
  - renderiza os cômodos nas posições certas;
  - os pontinhos têm as cores dos status;
  - adiciona um cômodo e ele aparece;
  - a mensagem de sobreposição vinda da API aparece no modal;
  - criar, editar e concluir um serviço;
  - o histórico lista o concluído;
  - o cliente não vê os botões.
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(site): maquete com serviços em andamento e histórico de manutenção`.

### Task 10: Agendamentos — calendário mensal do cliente e do engenheiro

**Files:**
- Create: `apps/site/src/app/features/agenda/{components/CalendarMonth.tsx,components/AppointmentCard.tsx,components/AppointmentModal.tsx,components/AgendamentosTab.tsx,pages/CalendarioPage.tsx,hooks/*.ts,api.ts}` e os testes
- Create (API, se ainda não existir): `GET /api/appointments?mes=YYYY-MM` para o engenheiro, com os agendamentos de todos os clientes dele, mais o teste de integração e a política (só os clientes dele).

**Interfaces** (modelo §3.2):
- Só a visão mensal, abrindo no mês atual, com as setas "Mês anterior" e "Próximo mês".
- `.grid7` com a cor do dia pela regra `dayColor`, mais a legenda.
- A lista "Agendamentos de {mês}" usa o `AppointmentCard` expansível.
- O engenheiro tem "Novo agendamento" e os botões Confirmar, Marcar pendente, Adiar, Editar e Excluir, com os toasts do modelo.
- O modal tem "Serviço agendado", "Data", "Horário", "Status", "Descrição do serviço a ser prestado" e "Imóvel". Não tem profissional, projeto nem orçamento.
- `CalendarioPage` (`/calendario`) é o calendário do engenheiro com todos os clientes, e cada card mostra o nome do cliente.

- [ ] **Step 1: Testes**
  - a grade de novembro de 2026 começa no domingo certo;
  - um dia com um adiado e um confirmado fica vermelho;
  - navegar entre meses;
  - criar e mudar o status com os toasts;
  - o cliente fica em só leitura;
  - a API do calendário do engenheiro não traz cliente de outro engenheiro.
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(site): agendamentos com calendário mensal`.

### Task 11: Telas do admin

**Files:**
- Create: `apps/site/src/app/features/admin/{pages/LeadsPage.tsx,pages/CandidaturasPage.tsx,pages/EquipePage.tsx,components/*,hooks/*,api.ts}` e os testes

**Interfaces** (modelo §6, que traz sugestões de reuso visual):
- **`LeadsPage`:** `StatRow` com o total e o número sem atribuição; filtro `.fx-tabs` entre "Todos" e "Sem atribuição"; `RowCard` com nome, cidade, tipo, plano, data e a pill do engenheiro ou a pill amarela "Sem atribuição".
- **`CandidaturasPage`:** abas "Pendentes", "Aprovadas" e "Recusadas". Os botões "Aprovar" (`.b-sm.green`) e "Recusar" (`.danger`) pedem confirmação. O 409 da API aparece em toast.
- **`EquipePage`:** botão "Convidar pessoa", que abre um modal com "Nome completo", "E-mail" e "Perfil" (Engenheiro ou Administrador), e o toast `Convite enviado para {email}.`.

- [ ] **Step 1: Testes**
  - o filtro "sem atribuição";
  - aprovar com confirmação remove o item da aba pendente;
  - o 409 mostra o toast;
  - o convite envia o corpo certo.
- [ ] **Step 2:** Rodar os testes → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(site): painel do administrador`.

### Task 12: E2E dos fluxos núcleo

**Files:**
- Create: `apps/site/e2e/plataforma.spec.ts`, mais os helpers de fixture em `apps/site/e2e/` para criar o admin pelo CLI e aceitar convites pelo Mailpit, buscando a mensagem pelo destinatário.

**Fluxos:**
1. O admin convida um engenheiro. O engenheiro aceita o convite e cai em `/app/clientes`.
2. Um visitante envia um diagnóstico e o cliente aparece na lista desse engenheiro. É o único engenheiro ativo; a fixture garante isso criando um engenheiro novo e conferindo a atribuição pelo nome do cliente.
3. O engenheiro abre o cliente, adiciona um cômodo, cria um serviço, cria um agendamento e muda o status da solicitação.
4. O cliente aceita o convite do diagnóstico e vê a maquete com o serviço, o agendamento no calendário e a solicitação com o status novo, tudo sem botões de edição.
5. O admin vê o lead e aprova uma candidatura.

- [ ] **Step 1:** Escrever o spec.
- [ ] **Step 2:** `pnpm e2e` → PASS em todos (os do plano 2 e os novos).
- [ ] **Step 3:** Commit `test(e2e): fluxos núcleo da plataforma`.

### Task 13: Deploy mínimo no servidor real

**Files:**
- Create:
  - `deploy/compose.prod.yml`, `deploy/Caddyfile`, `deploy/.env.prod.example`
  - `deploy/backup/pg-backup.sh` e `deploy/README.md`
  - `apps/site/e2e/caddy-smoke.spec.ts` e `apps/site/playwright.caddy.config.ts`
- Modify: `package.json` da raiz (scripts `deploy:smoke` e `build:site`), `README.md`

**Interfaces:**
- **`compose.prod.yml`:**
  - `db`: Postgres 17 com volume e healthcheck, **sem porta publicada**;
  - `api`: a imagem do Dockerfile, **sem porta publicada**, com `TRUST_PROXY_HOPS=1`, `NODE_ENV=production`, `COOKIE_SECURE=true`, `MAIL_DRIVER=smtp`, `SMTP_URL`, `MAIL_FROM`, `TEAM_EMAIL` e `APP_ORIGIN=https://${DOMAIN}`, com `stop_grace_period: 30s`;
  - `web`: `caddy:2`, publicando as portas 80 e 443, com `./Caddyfile`, o `apps/site/dist` montado em `/srv` e volumes para `data` e `config` (certificados);
  - `backup`: `postgres:17` rodando `pg-backup.sh` diário com retenção de 7 dias num volume `backups`.
- **`Caddyfile`:**
  - `{$DOMAIN}`;
  - `encode gzip zstd`;
  - os headers de segurança: `X-Content-Type-Options nosniff`, `Referrer-Policy same-origin` e `X-Frame-Options DENY`;
  - `handle /api/*` → `reverse_proxy api:3333`;
  - `handle /app/*` → `try_files {path} /app/index.html`;
  - o resto → `try_files {path} {path}/index.html`, com `file_server` e `handle_errors` 404 → `/404.html`;
  - `Cache-Control`: `no-cache` em `*.html`, e `public, max-age=31536000, immutable` em `/_astro/*`;
  - o log de acesso sem query string.
- Para validar localmente com `DOMAIN=localhost`, que usa o certificado interno do Caddy, `pnpm deploy:smoke` faz o build do site, sobe o compose de prod num nome de projeto separado (`fixable-smoke`), roda o Playwright contra `https://localhost` com `ignoreHTTPSErrors` e derruba tudo no final. O smoke cobre:
  - a home abre (200);
  - uma página de serviço × cidade abre (200);
  - um caminho inexistente responde 404;
  - o admin criado pelo CLI dentro do container faz login e chega a `/app/admin/leads`.
- **`deploy/README.md`** (pt-BR), com o passo a passo para um Ubuntu limpo:
  - instalar o Docker;
  - apontar o DNS;
  - preencher o `.env.prod`;
  - `docker compose -f deploy/compose.prod.yml up -d --build`;
  - criar o admin (`docker compose exec api node src/cli/create-admin.ts ...`);
  - restaurar um backup;
  - atualizar a versão.
  - Lista também as pendências que dependem da cliente: textos legais, telefone e razão social, e o SMTP.

- [ ] **Step 1:** Escrever os arquivos.
- [ ] **Step 2:** `pnpm deploy:smoke` → PASS.
- [ ] **Step 3:** `pnpm test` e `pnpm e2e` → PASS, porque nada de dev pode quebrar.
- [ ] **Step 4:** Commit `feat(deploy): compose de produção com Caddy, HTTPS e backup diário`.
