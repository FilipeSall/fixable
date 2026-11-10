# PRD — Plataforma Fixable (site + app)

Base visual e funcional aprovada pelo cliente: **Modelo 4 — Casa editorial**
(`docs/referencia/modelo-4-plataforma.html`). O modelo é uma demonstração que grava tudo no `localStorage`;
este PRD define a versão de produção.

## Suposições e pendências

**Decisões já tomadas**

- MVP = site + plataforma inteira do modelo, mais um painel admin enxuto.
- Stack: Astro (site estático + área logada em React `client:only` na rota `/app`),
  API Node + Fastify, Postgres, schemas Zod compartilhados.
- Monorepo neste repositório (`apps/site`, `apps/api`, `packages/shared`); os protótipos HTML
  continuam na raiz.
- Conteúdo do site em Astro Content Collections (só o dev edita). Sem CMS com painel.
- Hospedagem em servidor próprio da empresa.

**Suposições (confirmar na SPEC)**

- O engenheiro responsável é definido **por cliente**, não por imóvel. Todos os imóveis do
  cliente ficam com o mesmo engenheiro.
- Quando um e-mail que já é de cliente envia um novo diagnóstico, nasce uma nova solicitação
  "Diagnóstico adicional", e o engenheiro decide se é um imóvel novo ou um existente.
- A primeira conta admin é criada por um comando de linha (`pnpm --filter api create-admin`).
- Os planos (1, 3, 6 e 12 meses) são um catálogo fixo em `packages/shared`. O preço exibido no
  site vem do conteúdo do repositório.

**Pendências com a infraestrutura da empresa (bloqueiam o deploy, não o desenvolvimento)**

1. Sistema operacional e disponibilidade de Docker / Docker Compose no servidor.
2. Postgres: no mesmo servidor ou em outro? Qual a política de backup?
3. Arquivos (fotos, notas, currículos): disco local ou MinIO (compatível com S3)? Backup?
4. Domínio, DNS e TLS: quem administra o nginx (ou outro reverse proxy) e os certificados?
5. E-mail transacional: SMTP da empresa ou provedor externo? Domínio remetente com SPF/DKIM/DMARC.
6. Deploy: CI/CD disponível (runner GitLab, acesso SSH)? Haverá ambiente de homologação?
7. Logs e monitoramento: existe stack na empresa?

**Pendências de produto**

- Analytics do site (GA4, Plausible ou nenhum).
- Anti-spam dos formulários públicos: rate limit + honeypot bastam, ou é preciso captcha?
- Lista de cidades atendidas, para as páginas serviço × cidade.
- E-mail da equipe que recebe os avisos de novo lead e nova candidatura.

## Problema

Manter uma casa em dia é difícil: o morador não sabe a quem recorrer, perde o histórico do que
já foi feito e não tem visibilidade sobre prazos, custos e andamento dos serviços. A Fixable
resolve isso com um engenheiro responsável por cliente e profissionais parceiros certificados.
Hoje, porém, só existe um protótipo que guarda tudo no navegador: não há captação real de
leads, contas seguras, dados compartilhados entre cliente, engenheiro e profissional, nem
histórico persistente da casa.

## Solução

- **Site público** (Astro, foco em SEO) com o conteúdo do Modelo 4, um formulário de diagnóstico
  que vira cliente e solicitação de verdade, um formulário "Faça parte do time" que vira
  candidatura e páginas geradas de serviço × cidade para busca local.
- **Plataforma em `/app`** com 4 perfis:
  - **Cliente:** acompanha seus imóveis (maquete por andar e cômodo), solicitações, serviços,
    histórico de manutenção, agendamentos e orçamentos, e conversa com o seu engenheiro.
  - **Engenheiro:** gerencia seus clientes e imóveis, abre serviços nos cômodos, cria projetos
    alocando profissionais do catálogo, agenda visitas, emite orçamentos, conversa com cliente
    e profissional e conclui serviços.
  - **Profissional parceiro:** vê os projetos e agendamentos atribuídos a ele, preenche a ficha
    de detalhamento (andamento, materiais, fotos e notas), conversa com o engenheiro e mantém
    o próprio perfil e currículo.
  - **Admin:** trata leads e candidaturas, cria engenheiros e admins, marca o selo "Fixable
    Certified", reatribui clientes e registra o plano contratado.
- **E-mails transacionais** e **contadores in-app** de novidades.

**Fora do escopo do MVP:** gateway de pagamento e baixa automática, checkout e cobrança
recorrente de planos, WhatsApp, chat em tempo real (WebSocket), blog, CMS com painel,
cadastro público aberto, cliente solicitando horário, app nativo, multi-idioma e os textos
jurídicos de LGPD (entram apenas o checkbox de consentimento e os links reservados).

## Histórias de Usuário

**Visitante (site)**

1. Como visitante, quero ver o site com o conteúdo do Modelo 4 carregando rápido no celular, para entender a proposta da Fixable.
2. Como visitante, quero escolher um plano na seção de pacotes e vê-lo pré-selecionado no formulário de diagnóstico, para não precisar repetir a escolha.
3. Como visitante, quero solicitar um diagnóstico informando nome, e-mail, telefone, cidade, tipo de imóvel, descrição e preferência de contato, para ser atendido por um engenheiro.
4. Como visitante, quero ver mensagens de erro claras por campo quando preencho algo inválido, para corrigir antes de enviar.
5. Como visitante, quero receber por e-mail um link para criar minha senha após o diagnóstico, para acessar meu painel.
6. Como visitante, quero receber a mesma confirmação genérica de envio independentemente de o e-mail já existir, para que ninguém descubra quem é cliente ou profissional.
7. Como profissional ou engenheiro, quero me candidatar pelo formulário "Faça parte do time", para ser avaliado pela Fixable.
8. Como visitante, quero encontrar uma página como "Eletricista em Santo André" pela busca, com chamada para o diagnóstico com a cidade pré-preenchida.
9. Como visitante, quero aceitar os termos e a política de privacidade antes de enviar qualquer formulário, para saber como meus dados serão usados.

**Acesso**

10. Como usuário convidado, quero definir minha senha por um link de uso único válido por 48h, para ativar minha conta.
11. Como usuário, quero entrar com e-mail e senha e ser levado à tela inicial do meu perfil.
12. Como usuário, quero recuperar a senha por e-mail, para não perder o acesso.
13. Como usuário, quero sair da plataforma e ter a sessão encerrada no servidor.
14. Como usuário bloqueado ou com convite expirado, quero uma mensagem clara e o caminho para pedir um novo convite.

**Cliente**

15. Como cliente, quero ver meus imóveis e alternar entre eles, para acompanhar cada casa separadamente.
16. Como cliente, quero ver a maquete do imóvel por andar e cômodo, com os serviços marcados e coloridos por status, para entender onde está cada problema.
17. Como cliente, quero ver minhas solicitações e o status de cada uma (em análise, agendado, em execução, concluído).
18. Como cliente, quero ver os serviços em andamento com prazo e percentual, e o histórico de manutenção dos concluídos com a ficha arquivada.
19. Como cliente, quero ver meus agendamentos num calendário (mês e ano) com status, profissional e descrição.
20. Como cliente, quero ver meus orçamentos com valor, forma de pagamento, status e o link de pagamento quando houver.
21. Como cliente, quero conversar com o meu engenheiro responsável e ver quantas mensagens não lidas tenho.
22. Como cliente, quero ver os dados do meu imóvel cadastrados pelo engenheiro.
23. Como cliente, quero receber e-mail quando um agendamento ou orçamento for criado ou alterado.

**Engenheiro**

24. Como engenheiro, quero ver apenas os clientes atribuídos a mim, com o número de solicitações abertas.
25. Como engenheiro, quero cadastrar e editar imóveis do cliente e os dados de cada imóvel.
26. Como engenheiro, quero montar e editar a maquete (andares e cômodos, com nome e tamanho), partindo de um modelo pelo tipo de imóvel.
27. Como engenheiro, quero criar, editar e concluir serviços num cômodo, com título, descrição, status (prioridade, atenção, execução) e prazo.
28. Como engenheiro, quero atualizar o status das solicitações do cliente.
29. Como engenheiro, quero consultar o catálogo de profissionais aprovados filtrando por categoria e abrir o perfil completo.
30. Como engenheiro, quero criar um projeto a partir de um serviço, alocando um profissional e descrevendo local, informações de execução e prazo.
31. Como engenheiro, quero criar, editar, excluir e mudar o status (confirmado, pendente, adiado) de agendamentos, com ou sem profissional vinculado, e vê-los no meu calendário.
32. Como engenheiro, quero emitir orçamentos com valor, forma de pagamento e link PIX/boleto colado do meu provedor, e marcá-los como pagos.
33. Como engenheiro, quero conversar com o cliente e, em cada projeto, com o profissional alocado, numa conversa que o cliente não vê.
34. Como engenheiro, quero acompanhar a ficha e o percentual de andamento atualizados pelo profissional.
35. Como engenheiro, quero marcar um projeto como concluído, arquivando a ficha (somente leitura) e levando o registro ao histórico de manutenção.

**Profissional parceiro**

36. Como profissional, quero ver os clientes e projetos atribuídos a mim e os meus agendamentos.
37. Como profissional, quero ver a solicitação do projeto (descrição, local, informações e prazo).
38. Como profissional, quero preencher a ficha de detalhamento: datas, percentual, descrição, execução, etapas, materiais com quantidade e valor, mão de obra e outros custos.
39. Como profissional, quero anexar fotos de antes, durante e depois e documentos (notas) ao projeto.
40. Como profissional, quero conversar com o engenheiro do projeto.
41. Como profissional, quero editar meu perfil (foto, área, descrição, experiências, formação, cursos e currículo em PDF).
42. Como profissional, quero ser impedido de editar a ficha depois que o projeto for concluído.

**Admin**

43. Como admin, quero ver e filtrar os leads de diagnóstico, com o plano de interesse e o engenheiro atribuído.
44. Como admin, quero aprovar ou recusar candidaturas e, ao aprovar, disparar o convite de acesso.
45. Como admin, quero criar contas de engenheiro e de admin por convite.
46. Como admin, quero bloquear e desbloquear usuários.
47. Como admin, quero marcar e desmarcar o selo "Fixable Certified" de um profissional.
48. Como admin, quero reatribuir um cliente a outro engenheiro.
49. Como admin, quero registrar o plano contratado pelo cliente, com início e fim.
50. Como equipe Fixable, quero receber um e-mail a cada novo lead e cada nova candidatura.

**Casos de borda**

51. Como sistema, quero atribuir o novo cliente ao engenheiro ativo com menos clientes e, se não houver engenheiro ativo, deixar o lead sem atribuição e visível ao admin.
52. Como sistema, quero limitar tentativas de login e envios de formulário por IP, para conter abuso.
53. Como usuário, quero que o upload rejeite arquivos acima do limite ou de tipo não permitido, com mensagem clara.
54. Como usuário, quero que um serviço concluído continue visível em "Serviços em andamento" por 24h antes de ir só para o histórico (como no modelo).

## Decisões de Implementação

**Estrutura**

```
apps/site       Astro (output static) + React (client:only) em /app
apps/api        Fastify + Drizzle + Postgres
packages/shared schemas Zod, enums de status, catálogo de planos e categorias, tipos da API
```

- Site e API servidos **no mesmo domínio**: o nginx entrega os estáticos e faz proxy de `/api` para
  o Fastify. Com isso o cookie é first-party e não há CORS. Toda rota `/app/*` cai em
  `app/index.html` (fallback da SPA).
- O ambiente roda via Docker Compose (api, postgres e, se for o caso, minio), portável para o
  servidor da empresa.

**Site (`apps/site`)**

- Seções do Modelo 4 como componentes Astro, sem JS por padrão. Ilhas só no FAQ, no menu mobile,
  no select customizado e nos formulários.
- Content Collections: `pacotes`, `faq`, `servicos` (as 7 categorias), `cidades`.
- Páginas `/servicos/[categoria]/[cidade]` geradas no build (categorias × cidades). Cada uma com
  title, description e canonical próprios e Schema.org `Service` + `LocalBusiness`.
- `sitemap.xml`, `robots.txt`, Open Graph e imagens otimizadas (`astro:assets`).

**Plataforma (`apps/site/src/app`)**

- SPA React com React Router e TanStack Query (cache e polling do chat a cada 10s com a conversa aberta).
- Telas por perfil espelhando o modelo, mais as telas admin (leads, candidaturas, usuários, clientes).
- Validação de formulário com os mesmos schemas Zod da API.

**API (`apps/api`): módulos e interface**

| Módulo | Responsabilidade | Rotas principais |
|---|---|---|
| `auth` | login, logout, sessão, convite, reset de senha | `POST /auth/login`, `/auth/logout`, `/auth/invite/accept`, `/auth/password/forgot`, `/auth/password/reset`, `GET /auth/me` |
| `public` | formulários do site | `POST /public/diagnostics`, `POST /public/applications` |
| `admin` | leads, candidaturas, usuários, certificação, reatribuição, planos | `/admin/*` |
| `clients` | clientes, imóveis, dados do imóvel, plano | `/clients`, `/clients/:id/properties` |
| `floorplan` | andares e cômodos | `/properties/:id/floors`, `/floors/:id/rooms` |
| `services` | serviços nos cômodos e solicitações | `/properties/:id/services`, `/clients/:id/requests` |
| `projects` | projeto, ficha, materiais, progresso, conclusão | `/projects`, `/projects/:id/sheet`, `/projects/:id/complete` |
| `appointments` | agenda | `/appointments?from&to` |
| `quotes` | orçamentos | `/clients/:id/quotes` |
| `professionals` | catálogo e perfil | `/professionals`, `/me/profile` |
| `messages` | conversas e não lidas | `/threads`, `/threads/:id/messages?after=`, `/threads/:id/read` |
| `files` | upload e download autenticado | `POST /files`, `GET /files/:id` |
| `notifications` | e-mails transacionais e contadores | interno, mais `GET /me/counters` |

- **Permissões centralizadas** num único módulo de políticas (`canSeeClient`, `canEditClient`,
  `canSeeProject` etc., como no modelo, mais o admin) e aplicadas em todas as rotas.
  - Cliente: só os próprios dados.
  - Engenheiro: só os clientes atribuídos a ele.
  - Profissional: só os projetos e agendamentos em que está alocado.
  - A conversa engenheiro ↔ profissional nunca é exposta ao cliente.
- **Dados:** Postgres + Drizzle com migrations versionadas. Entidades: `users`, `sessions`,
  `email_tokens`, `engineer_profiles`, `professional_profiles` (experiências, formação e cursos
  em JSONB), `diagnostic_leads`, `applications`, `clients`, `client_plans`, `properties`,
  `property_attributes`, `floors`, `rooms`, `service_requests`, `services`, `projects`,
  `project_sheets`, `sheet_materials`, `project_progress`, `project_files`, `appointments`,
  `quotes`, `threads`, `messages`, `thread_reads`, `files`.
  - Dinheiro em `numeric(12,2)`, datas em `timestamptz`.
  - Solicitações, serviços, projetos, agendamentos e orçamentos referenciam o `property_id`.
- **Segurança:**
  - Senha com argon2id. Sessão opaca em tabela, num cookie `HttpOnly; Secure; SameSite=Lax`.
  - Verificação de `Origin` nas rotas que alteram dados.
  - `@fastify/rate-limit` no login e nos formulários públicos, mais um honeypot nos formulários.
  - Tokens de convite e reset guardados como hash, de uso único e com expiração.
  - As respostas públicas não revelam se um e-mail existe.
- **Arquivos:** interface `Storage` com driver de disco local e driver S3 (MinIO), escolhido por
  variável de ambiente.
  - Imagens jpg/png/webp até 10 MB, redimensionadas no navegador para no máximo 2000 px.
  - PDF até 10 MB.
  - Download só pela API, após checar a permissão.
- **E-mail:** interface `Mailer` com driver SMTP. Os templates ficam na API. O envio é feito
  fora da requisição (fila simples em tabela, com retentativa) para não travar o formulário.
- **Observabilidade:** logs estruturados (pino, nativo do Fastify) e `GET /health`.

**Testes**

- **API (prioridade máxima):** testes de integração com Vitest contra um Postgres real (container).
  - Matriz de permissões por perfil em todas as rotas.
  - Fluxos de diagnóstico → convite → senha → login, e de candidatura → aprovação → convite.
  - Atribuição por menor carga; conclusão de projeto travando a ficha.
- **`packages/shared`:** testes unitários dos schemas Zod.
- **Front:** Vitest + Testing Library nos formulários (diagnóstico, candidatura, login, ficha).
  Playwright E2E em 3 fluxos: diagnóstico até o painel do cliente, engenheiro cria projeto e o
  profissional atualiza a ficha, e admin aprova candidatura.
- **Site:** checagem no CI do build e de SEO (sitemap, meta, canonical, Lighthouse ≥ 90 em
  Performance e SEO no mobile).
- **Não terão teste automatizado:** a fidelidade visual das seções estáticas da landing, que é
  conferida manualmente contra o Modelo 4.

## Critérios de Aceite

**Site**

- [ ] Todas as seções do Modelo 4 estão presentes e visualmente fiéis em 375 px, 768 px e 1440 px.
- [ ] Lighthouse mobile ≥ 90 em Performance, SEO e Acessibilidade na home.
- [ ] `sitemap.xml` lista a home e todas as páginas serviço × cidade. Cada uma tem title, description e canonical únicos e JSON-LD válido.
- [ ] Escolher um plano leva ao formulário com o plano pré-selecionado e removível.
- [ ] Um diagnóstico válido cria lead, cliente, imóvel (com a maquete padrão do tipo), solicitação "Em análise" e atribuição ao engenheiro ativo com menos clientes, e envia o e-mail de convite ao cliente e o aviso à equipe.
- [ ] Um diagnóstico com e-mail já existente retorna a mesma resposta genérica e não cria uma segunda conta.
- [ ] Uma candidatura cria um registro pendente, avisa a equipe por e-mail e não cria conta ativa.
- [ ] Os formulários públicos exigem o aceite de termos e privacidade e bloqueiam envios em excesso do mesmo IP.

**Acesso**

- [ ] O link de convite e o de reset funcionam uma única vez e expiram em 48h e 1h, respectivamente.
- [ ] O login redireciona cada perfil para a sua tela inicial; senha errada mostra "E-mail ou senha incorretos." sem revelar se o e-mail existe.
- [ ] Usuário bloqueado não consegue entrar, e sessões ativas dele são encerradas no bloqueio.
- [ ] Não existe rota pública de cadastro com escolha de perfil.

**Permissões**

- [ ] Um cliente que chama a API com o id de outro cliente recebe 404.
- [ ] Um engenheiro não acessa clientes atribuídos a outro engenheiro.
- [ ] Um profissional só acessa projetos e agendamentos em que está alocado.
- [ ] O cliente nunca recebe mensagens das conversas engenheiro ↔ profissional.
- [ ] Arquivos só são baixados por quem pode ver o projeto ou perfil a que pertencem.

**Plataforma**

- [ ] O cliente com 2 imóveis alterna entre eles, e cada imóvel mostra a própria maquete, serviços, histórico, agendamentos e orçamentos.
- [ ] O engenheiro cria e edita andares e cômodos, e cria, edita e conclui serviços num cômodo. O cliente vê as alterações ao recarregar.
- [ ] O engenheiro cria um projeto alocando um profissional, que passa a vê-lo na sua lista.
- [ ] O profissional salva a ficha com materiais, fotos (antes, durante e depois) e notas. O percentual aparece para o engenheiro e para o cliente.
- [ ] Ao concluir o projeto, a ficha fica somente leitura para todos e o registro aparece no histórico de manutenção.
- [ ] Um serviço concluído some de "Serviços em andamento" depois de 24h.
- [ ] Agendamentos aparecem no calendário mensal e anual de cliente, engenheiro e profissional vinculado, com o status correto. Criar ou alterar um agendamento envia e-mail ao cliente.
- [ ] O orçamento mostra valor em BRL, forma de pagamento e link. Marcar como pago muda o status para o cliente.
- [ ] Uma mensagem enviada aparece para o destinatário em até 10s com a conversa aberta, e o contador de não lidas zera ao abrir a conversa.
- [ ] Upload acima de 10 MB ou de tipo não permitido é recusado com mensagem clara.

**Admin**

- [ ] O admin lista e filtra leads e candidaturas. Aprovar uma candidatura cria o profissional e envia o convite; recusar não cria conta.
- [ ] O admin cria engenheiro ou admin por convite, bloqueia e desbloqueia usuários, alterna o selo Certified, reatribui cliente e registra o plano com vigência.
- [ ] Sem engenheiro ativo, o lead fica "sem atribuição" e destacado no painel admin.

**Entrega**

- [ ] `docker compose up` sobe a API e o Postgres localmente, e `pnpm dev` sobe o site com a área `/app`.
- [ ] As migrations rodam do zero num banco vazio, e o comando `create-admin` cria o primeiro admin.
- [ ] A suíte de integração da API e os 3 fluxos E2E passam no CI.
