# Auditoria de segurança — Fixable (API e site)

- **Data:** 2026-11-11
- **Escopo autorizado:** código do repositório (commit `85da28d` + working tree) e testes ativos **somente em localhost**.
- **Fora do escopo:** domínio público, servidor de produção e serviços de terceiros. Nada foi testado fora da máquina local.

## Resumo executivo

O núcleo de autorização da API está bem construído. Toda checagem de acesso a cliente, imóvel, andar, cômodo, serviço, solicitação e agendamento passa por `access-policy.service.ts`, que resolve o dono do recurso no banco e responde 404 quando o acesso é negado. Nas 47 requisições de controle de acesso executadas, mais a checagem das listas e do calendário (anônimo, cliente, engenheiro demo e admin demo), **nenhum IDOR, escalada horizontal ou vertical foi reproduzido**. CSRF (checagem de `Origin`), sessões (token aleatório com hash, revogação no logout e no re-login), senhas (argon2id), links de e-mail (token com hash, uso único, no fragmento da URL) e escape de HTML nos e-mails também resistiram aos testes.

Os riscos reais estão **na borda pública**, não no controle de acesso:

1. **O formulário público de diagnóstico grava na conta de um cliente existente sem autenticação** (Média, confirmada). Basta saber o e-mail do cliente para criar uma solicitação com texto arbitrário no painel dele e disparar um e-mail da Fixable para ele: um vetor pronto de phishing com aparência oficial.
2. **O mesmo formulário cria contas para qualquer e-mail** e o `forgot-password` **invalida convites pendentes de terceiros** (Baixa, confirmadas).
3. **Ambiente de desenvolvimento exposto na rede**: Postgres com `fixable/fixable`, Mailpit (que mostra links de convite e redefinição) e a API escutam em `0.0.0.0` (Média só em dev, confirmada pelo IP da LAN).

O restante é hardening: falta de CSP e `Permissions-Policy`, rate limit só por IP e em memória, enumeração de contas por tempo de resposta no `forgot-password`, modo demo ligado no exemplo de produção e uma dependência (`drizzle-orm`) com CVE não explorável aqui.

**Nenhuma vulnerabilidade Crítica ou Alta foi encontrada.**

## 1. Arquitetura e superfície mapeada

```
Internet ─443/80─▶ Caddy (deploy/Caddyfile) ─┬─ site estático Astro (apps/site/dist) + SPA React em /app
                                             └─ /api/* ─▶ Fastify (apps/api) ─▶ Postgres 17
                                                         └─ worker da outbox ─▶ SMTP
```

| Camada | Tecnologia | Proteções observadas |
|---|---|---|
| Proxy | Caddy 2 | HTTPS automático, HSTS, `nosniff`, `X-Frame-Options DENY`, `Referrer-Policy same-origin`, remove `Server`, sobrescreve `X-Forwarded-For` com o IP real, filtra query string, `Cookie` e `Set-Cookie` dos logs |
| API | Fastify 5, Zod 4, Drizzle 0.44, argon2id | Validação Zod em params/body/query (remove campos desconhecidos), hook global de `Origin` em POST/PUT/PATCH/DELETE, sessão por cookie `HttpOnly; SameSite=Lax; Secure`, rate limit por IP nas rotas públicas e de auth, handler de erro que nunca devolve detalhes internos, logs com token e parâmetros SQL mascarados |
| Site | Astro 7 (estático) + React 19 + React Router 8 | Sem `dangerouslySetInnerHTML`; `set:html` só em SVG estático e JSON-LD com `<` escapado; `next` do login validado como caminho interno; token de convite lido do fragmento e apagado da URL |
| Banco | Postgres 17 | Sem porta publicada em produção; tokens de sessão e de e-mail guardados só como SHA-256 |

### Rotas da API (prefixo `/api`)

| Rota | Proteção | Regra de objeto |
|---|---|---|
| `POST /auth/login` | Origin + 10/15 min por IP | — |
| `POST /auth/logout` | Origin | revoga o token do cookie |
| `POST /auth/tokens/lookup`, `/auth/invite/accept`, `/auth/password/reset` | Origin + 20/15 min por IP | token de 256 bits, uso único |
| `POST /auth/password/forgot` | Origin + 5/h por IP | resposta 204 sempre |
| `GET /auth/me` | sessão | — |
| `POST /public/diagnostics`, `/public/applications` | Origin + 5/15 min por IP + honeypot | **nenhuma (ver V-01)** |
| `GET /public/demo-accounts` | 404 sem `DEMO_MODE` | — |
| `GET /health` | pública | — |
| `GET /me/client` | papel `cliente` | o próprio |
| `GET /clients`, `GET /appointments` | papel `engenheiro`/`admin` | `visibleClients()` |
| `GET /clients/:id`, `/clients/:id/requests`, `/clients/:id/appointments` | sessão | `requireClientAccess(read)` |
| `POST /clients/:id/properties`, `/requests`, `/appointments` | sessão | `requireClientAccess(write)`: cliente nunca escreve |
| `/properties/:id/*`, `/floors/:id*`, `/rooms/:id`, `/services/:id*`, `/requests/:id`, `/appointments/:id` | sessão | resolve o imóvel/cliente dono no banco e reaplica a regra |
| `/admin/*` | papel `admin` | admin demo filtrado ao domínio `.demo@fixable.com.br`; convite bloqueado |

Regra de leitura (`access-policy.service.ts:32-37`): admin vê todos (o demo só clientes demo), engenheiro só os clientes atribuídos a ele, cliente só o próprio, `profissional` nada. Escrita: só engenheiro dono e admin.

## 2. Método

1. Leitura integral de `apps/api/src` (rotas, controllers, services, middlewares, utils, mailer, worker), dos schemas de `packages/shared`, das telas de auth do site e de `deploy/`, `compose.yml`, `Dockerfile` e `infra/`.
2. O container `fixable-api-1` estava um commit atrás (`maquete.service.ts` diferente). Para testar o código atual, subi uma instância do HEAD em `localhost:3334` com os valores de produção (`NODE_ENV=production`, `TRUST_PROXY_HOPS=1`, limites 5/20/10, `DEMO_MODE=true`) e outra em `localhost:3335` com `DEMO_MODE=false`, ambas no banco local de desenvolvimento.
3. Para validar o proxy de produção, rodei o `deploy/Caddyfile` real num container `caddy:2` em `localhost:8090`, trocando só o upstream para `localhost:3334`.
4. Testes HTTP com `curl` usando só as contas demo e contas sintéticas `@example.test` criadas pelo próprio formulário. Taxa baixa, sem força bruta além de 12 tentativas de login.
5. `pnpm audit` no monorepo.

A matriz de controle de acesso está resumida na seção 4.

## 3. Vulnerabilidades

### V-01 — Formulário público de diagnóstico grava na conta de cliente existente sem autenticação

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Escrita não autenticada em conta de terceiro (falha de autenticação de origem dos dados / *business logic abuse*) |
| Severidade | **Média** |
| Localização | `POST /api/public/diagnostics` → `apps/api/src/services/diagnostic.service.ts:63-79` (`handleExistingAccount`), `:48-60` (`notifyExistingClient`), `:82-89` (`resolveAssignment`) |
| Evidência | Conta sintética `audit-vitima-…@example.test` ativada pelo convite. Antes: 1 solicitação (`Diagnóstico inicial — Sobrado`). Um envio **anônimo** com o e-mail da vítima e `descricao` maliciosa devolveu `204`. Depois, no painel da vítima: `em_analise \| Diagnóstico adicional — Casa térrea: URGENTE: seu imovel tem risco. Confirme seus dados em fixable-suporte.example e ligue 0800 000 0000`. A vítima recebeu o e-mail `Recebemos sua nova solicitação`. |
| Impacto | Quem conhece o e-mail de um cliente cria solicitações com texto livre (até 120 caracteres no resumo; 2000 no lead e no e-mail à equipe) no painel do cliente e do engenheiro dele, e faz a Fixable mandar um e-mail ao cliente. É um canal de phishing e engenharia social com aparência oficial ("ligue para…", "acesse…") nos dois sentidos: o cliente acha que a Fixable registrou aquilo, e o engenheiro acha que o cliente pediu. Também permite poluir o histórico e assediar o cliente por e-mail (limitado a 5 envios por IP a cada 15 min, contornável com vários IPs). |
| Reprodução | 1) Crie uma conta de teste pelo formulário e aceite o convite pelo Mailpit. 2) Sem cookie: `curl -X POST /api/public/diagnostics -H 'Origin: <APP_ORIGIN>' -H 'Content-Type: application/json' -d '{"nome":"Equipe Fixable","email":"<e-mail da conta>","telefone":"11988887777","cidade":"X","tipoImovel":"casa_terrea","preferenciaContato":"whatsapp","aceiteTermos":true,"descricao":"<texto>"}'`. 3) Logado na conta: `GET /api/clients/<id>/requests` mostra a solicitação nova. |
| Correção | O comportamento está na spec (o engenheiro decide o destino do "Diagnóstico adicional"), então a correção preserva o fluxo, mas tira o conteúdo não verificado da frente do cliente: (a) gravar o envio só como lead vinculado ao cliente (`diagnostic_leads.client_id`) e deixar o engenheiro converter em solicitação; ou (b) criar a solicitação com uma origem `site_nao_verificado` que o painel do cliente não lista até a triagem. Em qualquer caso, o e-mail ao cliente ativo não deve existir ou deve ser genérico, sem refletir dados do envio. Alternativa mais forte: confirmação por link enviado ao e-mail antes de anexar à conta. |
| Status | **Confirmada** |

### V-02 — Formulário público cria contas para qualquer e-mail sem prova de posse

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Cadastro em nome de terceiros (*account pre-provisioning*) e envio de e-mail a endereços arbitrários |
| Severidade | Baixa |
| Localização | `apps/api/src/services/client-onboarding.service.ts:53-86` (`insertInvitedClientUser`, `onboardClient`) |
| Evidência | Envio anônimo com `audit-convidado-…@example.test` criou usuário `convidado`, cliente atribuído a um engenheiro real, imóvel com maquete, solicitação e convite entregue no Mailpit. |
| Impacto | Qualquer pessoa cria contas de cliente em nome de terceiros, com nome, telefone e cidade escolhidos por ela, e faz a Fixable mandar convites a quem não pediu: risco de reputação do domínio remetente (SPF/DKIM) e lista de clientes dos engenheiros poluída. O nome passa por regex de letras (`public-forms.ts:8`), o que limita o phishing no corpo do convite. |
| Reprodução | `POST /api/public/diagnostics` com um e-mail novo; conferir o convite no Mailpit e o cliente novo em `GET /api/clients` do engenheiro atribuído. |
| Correção | Criar só o lead no envio. Criar usuário, cliente e imóvel quando a pessoa confirmar pelo link do e-mail ou quando a equipe aprovar o lead. Somar um limite por e-mail de destino (ex.: 1 envio por e-mail a cada 30 min). |
| Status | **Confirmada** |

### V-03 — Terceiros invalidam convites pendentes

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Negação de serviço do fluxo de convite |
| Severidade | Baixa |
| Localização | `apps/api/src/services/auth.service.ts:130-134` (`forgotPassword` reenvia convite a `convidado`), `diagnostic.service.ts:49-51`, `email-token.service.ts:21-24` (emitir invalida os anteriores) |
| Evidência | Token de convite de `audit-convidado-…`: `lookup` → `200`. Um `POST /api/auth/password/forgot` anônimo com o e-mail dele → `204`. Mesmo token: `410 "Este link expirou ou já foi usado."` |
| Impacto | Um atacante que sabe o e-mail de um convidado (ex.: admin recém-criado pelo `create-admin`) invalida o link dele sempre que quiser e enche a caixa dele de convites. Limitado a 5/h por IP no `forgot` e 5/15 min no diagnóstico. |
| Reprodução | Como na evidência: `lookup` do token, `forgot` com o e-mail, `lookup` de novo. |
| Correção | Antes de emitir, reaproveitar o convite aberto emitido há menos de N minutos (reenviar o mesmo link guardado na outbox não é possível porque só o hash fica no banco; então simplesmente não emitir outro e não enviar e-mail dentro de uma janela de cooldown por usuário, ex.: 10 min). |
| Status | **Confirmada** |

### V-04 — Serviços de desenvolvimento expostos na rede com credenciais padrão

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Exposição de serviços internos (banco, caixa de e-mail de teste, API) |
| Severidade | **Média (somente ambiente de desenvolvimento)** |
| Localização | `compose.yml:8-9` (`5432:5432`), `:20-22` (`1025`, `8025`), `:32-33` (`3333`) |
| Evidência | `ss -ltn` mostra `0.0.0.0:5432`, `0.0.0.0:8025`, `0.0.0.0:1025`, `0.0.0.0:3333`. Pelo IP da LAN desta máquina: `GET http://172.16.102.63:8025/api/v1/messages` → `200` e `GET http://172.16.102.63:3333/api/public/demo-accounts` → `200`. |
| Impacto | Qualquer máquina da mesma rede (escritório, Wi-Fi de faculdade) acessa o Postgres com `fixable/fixable` e lê no Mailpit os links de convite e redefinição, o que permite tomar qualquer conta do ambiente de desenvolvimento. Produção não é afetada (`compose.prod.yml` só publica 80/443). |
| Reprodução | De outra máquina da rede: `curl http://<ip-do-dev>:8025/api/v1/messages`; `psql postgres://fixable:fixable@<ip-do-dev>:5432/fixable`. |
| Correção | Publicar só no loopback: `"127.0.0.1:5432:5432"`, `"127.0.0.1:8025:8025"`, `"127.0.0.1:1025:1025"`, `"127.0.0.1:3333:3333"`. |
| Status | **Confirmada** |

### V-05 — Ausência de Content-Security-Policy e Permissions-Policy

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Cabeçalhos de defesa em profundidade ausentes |
| Severidade | Baixa |
| Localização | `deploy/Caddyfile:5-13` |
| Evidência | Respostas de `/`, `/app/login`, `/api/health`, 404 e `/_astro/*` pelo Caddyfile real: há HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`; **não há** `Content-Security-Policy` nem `Permissions-Policy`. |
| Impacto | Nenhum XSS foi encontrado, então não há exploração direta. Sem CSP, um XSS futuro (dependência, componente novo) roda sem barreira e pode exfiltrar dados das telas do cliente. |
| Reprodução | `curl -sI https://<dominio>/app/login`. |
| Correção | Começar com `Content-Security-Policy-Report-Only` e depois aplicar: `default-src 'self'; script-src 'self' <hashes dos 2 <script> inline do build>; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. O `<script type="application/ld+json">` não executa e não precisa de hash. Verificar se o suporte de CSP do Astro calcula os hashes no build; senão, gerar no `deploy/build-site.sh`. Somar `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`. |
| Status | **Confirmada** (ausência) |

### V-06 — Modo demo ligado no exemplo de produção

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Login público como admin/engenheiro em produção |
| Severidade | Baixa |
| Localização | `deploy/.env.prod.example:12` (`DEMO_MODE=true`), `docs/hospedagem-infra.md` (seção 4) |
| Evidência | Isolamento confirmado: o admin demo recebeu `404` em cliente, atributos, cômodo e candidatura reais e `403` no convite; listas só com dados demo (5 leads, 4 candidaturas, 3 clientes, 0 registros reais). Com `DEMO_MODE=false` (porta 3335): `demo-accounts` `404`, sessão demo já emitida `401`, login demo `401`. |
| Impacto | O isolamento funciona, mas o modo demo dá a qualquer visitante uma sessão autenticada com papel admin e engenheiro: toda a superfície autenticada fica exposta a anônimos, e qualquer um altera os dados demo compartilhados (renomear cômodos, apagar agendamentos), o que pode desfigurar uma apresentação. |
| Reprodução | `POST /api/auth/login` com `admin.demo@fixable.com.br` / `fixable123`. |
| Correção | `DEMO_MODE=false` no exemplo; ligar só na janela da apresentação e rodar `seed-demo` antes dela. Opcional: deixar contas demo só leitura (recusar escrita quando `viewer.isDemo`). |
| Status | **Confirmada** (comportamento documentado; risco aceito parcialmente) |

### V-07 — Enumeração de contas pelo tempo de resposta do `forgot-password`

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Enumeração de usuários por *timing* |
| Severidade | Baixa |
| Localização | `apps/api/src/services/auth.service.ts:130-134` |
| Evidência | 6 pares de amostras locais: e-mail existente 8,1–10,9 ms; inexistente 1,9–3,0 ms (a conta existente grava token e outbox antes de responder). O login, ao contrário, tem tempo igual graças ao `DUMMY_PASSWORD_HASH`. |
| Impacto | Descobrir se um e-mail tem conta. Pela internet a variação de rede atrapalha e o limite de 5/h por IP freia, mas com amostras repetidas a diferença é estatisticamente visível. |
| Reprodução | Medir `time_total` de `POST /api/auth/password/forgot` com um e-mail conhecido e um inexistente, alternando. |
| Correção | Responder `204` antes de emitir o link (`reply.send()` e emitir sem `await`, ou enfileirar um job) para o tempo não depender da conta existir. |
| Status | **Confirmada** (em localhost) |

### V-08 — Rate limit só por IP e em memória

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Proteção insuficiente contra força bruta distribuída |
| Severidade | Baixa |
| Localização | `apps/api/src/routes/auth.routes.ts:37-50`, `:66-79`; `app.ts:25` (store padrão em memória) |
| Evidência | 10 logins errados → 11º `429`. Não há chave por conta: trocar de IP zera a contagem. O estado some ao reiniciar a API e não é compartilhado entre instâncias (já citado em `docs/hospedagem-infra.md`). |
| Impacto | Ataque de senha distribuído (botnet, várias saídas) contra uma conta específica não é freado. A política exige 8+ caracteres com letras e números e a senha é argon2id, o que limita o dano. |
| Reprodução | Repetir o login errado de IPs distintos. |
| Correção | Somar um limite por e-mail no login e no `forgot` (ex.: `keyGenerator: (r) => 'login:' + normalizar(r.body.email)` num segundo registro do limiter, ou contador em tabela) com atraso progressivo. Não precisa de dependência nova. |
| Status | **Potencial** (comportamento confirmado; ataque distribuído não executado) |

### V-09 — Confiança em `X-Forwarded-For` depende da topologia (padrão da imagem)

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Falsificação do IP do cliente quando a API recebe tráfego direto |
| Severidade | Baixa |
| Localização | `apps/api/Dockerfile:17` (`ENV TRUST_PROXY_HOPS=1`), `apps/api/src/app.ts:13-15` |
| Evidência | Instância acessada direto com `TRUST_PROXY_HOPS=1`: após `429` no IP `192.0.2.50`, trocar o `X-Forwarded-For` para `192.0.2.51` voltou a responder `401` (limite contornado). **Pelo Caddyfile de produção não reproduz:** 12 logins com `X-Forwarded-For` e `X-Real-IP` forjados diferentes resultaram em `401`×10 e `429`×2, e a API registrou `remoteAddress: ::1` nos 12. |
| Impacto | Só existe se alguém publicar a porta 3333 da imagem sem o Caddy na frente (a imagem já vem com 1 salto confiável). Aí o rate limit de login, tokens e formulários vira decorativo. |
| Reprodução | Subir a imagem expondo a 3333 e repetir logins variando `X-Forwarded-For`. |
| Correção | Padrão `0` na imagem e `1` só no `compose.prod.yml` (já está lá). Melhor ainda: confiar por endereço, não por contagem (`trustProxy` com a sub-rede da rede Docker do Compose). |
| Status | **Não reproduzida** na configuração de produção; **Confirmada** com acesso direto |

### V-10 — Dependências com vulnerabilidades conhecidas

| Campo | Descrição |
|---|---|
| Vulnerabilidade | Componentes desatualizados |
| Severidade | Baixa |
| Localização | `apps/api/package.json` (`drizzle-orm ^0.44` → 0.44.7) |
| Evidência | `pnpm audit`: **alta** `drizzle-orm <0.45.2` (SQL injection por identificadores mal escapados); moderada `esbuild <=0.24.2` (via `drizzle-kit`, só servidor de dev); moderada `minimatch` (via ESLint, só dev). |
| Impacto | O CVE do Drizzle só é explorável quando entrada do usuário vira identificador (`sql.identifier`, alias ou nome de coluna dinâmico). O código não faz isso: o único `sql.raw` usa constantes (`models/floorplan.model.ts:16-19`) e todo valor vai como parâmetro. Sem impacto atual, mas a proteção depende de ninguém introduzir esse padrão. |
| Reprodução | `pnpm audit`. |
| Correção | Atualizar `drizzle-orm` para `>=0.45.2` (e `drizzle-kit` compatível) e rodar a suíte. As de dev podem esperar o próximo update do ESLint. |
| Status | **Confirmada** (presença); exploração **não reproduzida** |

### V-11 — Hardening e itens informativos

| Item | Localização | Recomendação |
|---|---|---|
| Sessão deslizante sem vida máxima: renova para +30 dias sempre que faltam menos de 15, então uma sessão usada a cada 2 semanas nunca expira | `session.service.ts:61-69` | Guardar `created_at` e recusar sessões com mais de N dias (ex.: 90) |
| Respostas da API com dados pessoais sem `Cache-Control: no-store` | todas as rotas `/api` | Hook `onSend` que define `no-store` |
| HSTS sem `includeSubDomains` | `Caddyfile:7` | Somar quando todos os subdomínios tiverem HTTPS |
| `Via: 1.1 Caddy` nas respostas da API | Caddy | `-Via` no bloco de cabeçalhos |
| `/api/health` público informa se o banco caiu | `health.routes.ts` | Aceitável; opcionalmente restringir ao healthcheck interno |
| Imagens sem versão fixa (`caddy:2`, `postgres:17`, `node:24-slim`) | compose/Dockerfile | Fixar versão menor ou digest |
| Backup `pg_dump` sem criptografia no mesmo disco | `deploy/backup/pg-backup.sh` | Criptografar antes de copiar para fora |
| Link de convite/redefinição fica em claro na `email_outbox.data` até o envio | `outbox.service.ts` | Aceitável (removido após envio ou descarte); lembrar disso em dumps |
| Senha demo `fixable123` no bundle do site | `_astro/form-errors.*.js` | Por design; sem efeito com `DEMO_MODE=false` |
| Listagens sem paginação (`/admin/leads`, `/clients`) crescem sem limite com spam do formulário | `admin.service.ts`, `client.service.ts` | Paginar quando o volume crescer |

## 4. Testes que não reproduziram vulnerabilidade

| Hipótese | Teste | Resultado |
|---|---|---|
| Rotas privadas sem login | 14 rotas GET/PATCH/POST anônimas | `401` em todas |
| IDOR horizontal (cliente → outro cliente) | Ana lendo cliente, solicitações, agendamentos, maquete, atributos e histórico de Carlos | `404` em todas (6/6) |
| IDOR em escrita | Ana alterando solicitação, agendamento, serviço, andar, cômodo e atributo de Carlos | `404` em todas (7/7) |
| Cliente escrevendo nos próprios dados | `POST` de solicitação e imóvel na própria conta | `404` (cliente só lê) |
| Escalada vertical | Ana em `/clients`, `/appointments`, `/admin/*`, convite | `403` em todas (5/5) |
| Engenheiro fora da carteira | Engenheiro demo em cliente real não atribuído (leitura e escrita) e no admin | `404` / `403` (6/6) |
| Filtro por `propertyId` no calendário | `GET /appointments?propertyId=<imóvel real>` pelo engenheiro demo | `[]` |
| Admin demo alcançando dados reais | leitura, escrita, aprovar/recusar candidatura real, convidar | `404` / `403` (7/7) |
| CSRF | PATCH com sessão válida sem `Origin`, com `Origin` malicioso, `null` e `http://localhost:4321.evil.example`; `text/plain` | `403` ×4; `text/plain` recusado com `400` |
| CORS | `GET` com `Origin` externo e preflight `OPTIONS` | nenhum `Access-Control-Allow-*` |
| Mass assignment | `PATCH /appointments/:id` com `clientId` de outro cliente e `id` | campos ignorados (Zod remove), `client_id` intacto no banco |
| Sessão revogada | cookie reutilizado após logout; cookie anterior após re-login; cookie forjado | `401` ×3 |
| SQL injection | revisão de todas as queries | só query builder parametrizado; `sql.raw` só com constantes |
| XSS (armazenado/DOM) | revisão do SPA e das páginas Astro | sem `dangerouslySetInnerHTML`; `set:html` só com SVG estático e JSON-LD escapado; e-mails escapam todo texto (`views/emails/render.ts`) |
| Injeção de cabeçalho em e-mail | `cidade` com `\r\nBcc: …\r\nX-Audit: …` no diagnóstico | assunto codificado numa linha; sem `Bcc`/`X-Audit`; 0 mensagens ao Bcc injetado |
| Open redirect | `?next=` do login | aceita só `/` seguido de algo que não seja `/` ou `\`, e a navegação é interna ao React Router |
| Host header injection nos links | revisão de `invite.service.ts` e `appointment.service.ts` | links montados com `APP_ORIGIN`, nunca com `Host` |
| Arquivos sensíveis e source maps | `/.env`, `/.git/config`, `/deploy/.env.prod`, `/package.json`, `/api/.env`; busca de `.map` no build | `404` (em `/app/*` o fallback devolve o `index.html` da SPA); 0 source maps |
| Vazamento em erros | JSON malformado, UUID inválido, path traversal, corpo de 2 MB | mensagens genéricas `400`/`404`/`413`, sem stack ou SQL |
| Enumeração no login | tempo e mensagem com e-mail existente e inexistente | mesma mensagem e tempo equivalente (hash fictício) |
| Segredos no repositório | `git grep` e histórico de `.env` | só credenciais de dev/smoke; `.env.prod` fora do Git |
| Token de link | entropia e armazenamento | 256 bits, SHA-256 no banco, uso único, fragmento da URL apagado após leitura |

## 5. Priorização

**Vulnerabilidades exploráveis confirmadas**

1. **V-01** (Média) — escrita anônima na conta de cliente pelo formulário de diagnóstico. Exposta a qualquer pessoa na internet, exige só um e-mail.
2. **V-04** (Média, dev) — banco e Mailpit expostos na rede. Fácil de explorar na mesma rede; correção de 4 linhas.
3. **V-02** (Baixa) — contas e convites para e-mails arbitrários.
4. **V-03** (Baixa) — invalidação de convites por terceiros.
5. **V-07** (Baixa) — enumeração por tempo no `forgot-password`.

**Riscos potenciais que exigem validação ou dependem de configuração**

6. **V-06** (Baixa) — modo demo em produção.
7. **V-08** (Baixa) — força bruta distribuída.
8. **V-09** (Baixa) — `X-Forwarded-For` com a API exposta sem o Caddy.
9. **V-10** (Baixa) — `drizzle-orm` com CVE não explorável hoje.

**Configurações que podem ser fortalecidas**

10. **V-05** — CSP e `Permissions-Policy`.
11. **V-11** — vida máxima da sessão, `no-store`, HSTS, versões fixas, backup.

## 6. Plano de correção

| Ordem | Item | Mudança proposta (sem dependências novas) | Teste de regressão |
|---|---|---|---|
| 1 | V-01 | Em `handleExistingAccount`, parar de inserir em `service_requests` e de enviar `diagnostico-recebido` com conteúdo; gravar o lead com `client_id` e, se o produto quiser a solicitação, marcá-la com uma coluna de origem não verificada e filtrá-la do painel do cliente até a triagem. | `tests/routes/public-diagnostics.test.ts`: envio anônimo com e-mail de cliente **ativo** não cria solicitação visível em `GET /clients/:id/requests` logado como o cliente e não enfileira e-mail com o texto enviado. Ajustar o teste atual da linha 222, que hoje garante o comportamento vulnerável. |
| 2 | V-04 | `compose.yml`: prefixar as portas com `127.0.0.1:`. | `deploy/check-compose.sh` (ou teste novo) falha se `compose.yml` publicar porta sem `127.0.0.1`. |
| 3 | V-02 | No diagnóstico de e-mail novo, gravar só o lead; criar usuário/cliente/imóvel quando a equipe aprovar o lead ou quando a pessoa confirmar por link. Limite por e-mail de destino. | Envio com e-mail novo não cria linha em `users`; o segundo envio ao mesmo e-mail dentro da janela não enfileira outro e-mail. |
| 4 | V-03 | Cooldown por usuário na emissão de convite/redefinição (não emitir nem enviar se houver link aberto emitido há menos de 10 min). | `tests/routes/auth/tokens.test.ts`: `forgot` com e-mail de convidado logo após o convite não invalida o token original. |
| 5 | V-07 | Responder o `forgot-password` antes de emitir o link (ou enfileirar). | Teste que mede que a rota responde sem esperar a emissão (mock lento em `sendPasswordReset` não atrasa a resposta). |
| 6 | V-06 | `DEMO_MODE=false` em `deploy/.env.prod.example`; opcionalmente recusar escrita de contas demo. | `tests/config/env.test.ts`: exemplo de produção com `DEMO_MODE=false`; se adotar só leitura, `demo-scope.test.ts` cobre `403` em escrita. |
| 7 | V-08 | Segundo rate limit com chave por e-mail normalizado no login e no `forgot`. | `tests/routes/auth/login.test.ts`: 11ª tentativa no mesmo e-mail com IPs diferentes responde `429`. |
| 8 | V-09 | `ENV TRUST_PROXY_HOPS=0` no Dockerfile (produção já define `1` no compose) ou `trustProxy` pela sub-rede do Compose. | `tests/app.test.ts`: com `TRUST_PROXY_HOPS=0`, `X-Forwarded-For` não muda `request.ip`. `e2e/caddy-smoke.spec.ts`: XFF forjado não contorna o limite. |
| 9 | V-10 | `drizzle-orm >=0.45.2`. | Suíte completa da API + `pnpm audit --prod` sem alertas altos no CI. |
| 10 | V-05 | CSP em `Report-Only`, depois aplicada; `Permissions-Policy`. | `e2e/caddy-smoke.spec.ts`: resposta de `/app/login` tem `Content-Security-Policy` com `frame-ancestors 'none'` e a página hidrata sem violações no console. |
| 11 | V-11 | Vida máxima da sessão; hook `no-store` em `/api`; `-Via`; versões fixas; backup criptografado. | `tests/services/auth.service.test.ts`: sessão com mais de 90 dias recusada mesmo se renovada; `tests/app.test.ts`: `/api/auth/me` com `Cache-Control: no-store`. |

## 7. Limitações

- Nada foi testado no domínio público ou no servidor de produção; a configuração de TLS (certificado, versões, cifras) do Caddy não foi verificada, só os cabeçalhos em HTTP local.
- XSS foi avaliado por revisão de código, sem execução no navegador.
- Força bruta distribuída e DoS não foram executados, por estarem fora do escopo.
- O container `fixable-api-1` está um commit atrás do HEAD; os testes rodaram numa instância do HEAD, e o container não foi alterado.
- Não foi usada ferramenta de SAST além do `pnpm audit` e da revisão manual.

## 8. Correções aplicadas (2026-11-11)

| Item | Situação | O que mudou | Teste de regressão |
|---|---|---|---|
| V-01 | Corrigida | A solicitação "Diagnóstico adicional" criada em conta existente leva só tipo de imóvel e plano, sem o texto livre do formulário (`client-onboarding.service.ts`). O texto completo continua no lead e no aviso à equipe. O e-mail ao cliente já era genérico. Quem conhece o e-mail ainda consegue criar uma solicitação sem conteúdo livre: o fluxo da spec (o engenheiro decide o destino) foi mantido. | `public-diagnostics.test.ts`: envio anônimo com texto de phishing não chega à solicitação nem ao e-mail do cliente |
| V-02 | Pendente | Exigir confirmação do e-mail antes de criar a conta muda o fluxo de cadastro da spec; fica para decisão de produto. | — |
| V-03 | Corrigida | `forgot-password` e o diagnóstico de convidado só emitem link novo se não houver link aberto da mesma finalidade emitido há menos de 10 min (`resendPublicLink`). A checagem roda depois de travar o usuário, na mesma transação da emissão, para pedidos simultâneos não passarem juntos por ela. Convite e reenvio feitos pelo admin continuam imediatos. | `tokens.test.ts` e `public-diagnostics.test.ts`: pedido dentro de 10 min não invalida o link anterior; depois de 10 min reemite; 4 pedidos simultâneos geram 1 link e 1 e-mail |
| V-04 | Corrigida | `compose.yml` publica Postgres, Mailpit e API só em `127.0.0.1`. Os containers já em execução só mudam depois de `docker compose up -d`. | `docker compose config` |
| V-05 | Parcial | Caddy envia `Content-Security-Policy: object-src 'none'; base-uri 'self'; form-action 'self'` e `Permissions-Policy`. `script-src` ficou de fora porque o build tem `<script>` inline que exigiria hashes, e `frame-ancestors` ficou de fora para não bloquear o iframe do Mailpit em `/emails` (o `X-Frame-Options DENY` continua no resto). | `e2e/caddy-smoke.spec.ts` |
| V-06 | Pendente | O modo demo faz parte do roteiro da apresentação; desligar depois dela segue documentado em `docs/hospedagem-infra.md`. | — |
| V-07 | Corrigida | `forgot-password` responde em no mínimo 250 ms, com ou sem conta (`utils/min-duration.ts`). | `tokens.test.ts` e `utils/min-duration.test.ts` |
| V-08 | Corrigida | Login ganhou limite por e-mail (2 × `LOGIN_RATE_LIMIT` em 15 min, 20 em produção), somado ao limite por IP (`middlewares/email-rate-limit.middleware.ts`). | `login.test.ts`: 7ª tentativa no mesmo e-mail com IPs diferentes dá `429` quando o limite é 3 |
| V-09 | Corrigida | A imagem Docker não define mais `TRUST_PROXY_HOPS=1`; o valor `1` fica só no `compose.prod.yml`. | `login.test.ts` (teste existente de `TRUST_PROXY_HOPS`) |
| V-10 | Corrigida | `drizzle-orm` 0.44.7 → 0.45.4. As vulnerabilidades de dev (`esbuild` via `drizzle-kit`, `minimatch` via ESLint) continuam. | suíte completa da API |
| V-11 | Parcial | Sessão recusada 90 dias após o login mesmo com renovação; toda resposta da API sai com `Cache-Control: no-store`; Caddy remove `Via`. HSTS, versões fixas de imagem e backup criptografado não mudaram. | `login.test.ts` (sessão de 91 dias), `app.test.ts` (`no-store`) |

## 9. Dados de teste criados no ambiente local

O banco local de desenvolvimento ficou com estes registros sintéticos (usuário, cliente, imóvel, lead e mensagens no Mailpit):

- `audit-vitima-1794399797@example.test` (ativo, com a solicitação injetada da V-01)
- `audit-convidado-1794399827@example.test` (convidado)
- `audit-hdr-1794399927@example.test` (convidado)

Nenhum registro existente foi alterado: todas as tentativas de escrita em dados de outras contas foram recusadas, e o `PATCH` de mass assignment não mudou o agendamento.
