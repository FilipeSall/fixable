# Fixable

Monorepo pnpm da plataforma Fixable:

- `packages/shared`: schemas Zod, papéis e rotas compartilhados entre API e site.
- `apps/api`: API Fastify + Drizzle + Postgres (rotas sob `/api`).
- `apps/site`: site Astro com a SPA React da plataforma em `/app`.
- `deploy/`: kit de produção (Compose com Caddy, HTTPS automático e backup diário). Veja `deploy/README.md`.
- `infra/nginx/fixable.conf`: nginx antigo, mantido só como referência das regras de roteamento.

## Requisitos

- Node 24.2 ou mais novo
- pnpm 9 (`corepack enable`)
- Docker com Docker Compose

## Ambiente local

```sh
cp .env.example .env
docker compose up -d --build
pnpm install
pnpm dev
```

- `docker compose up -d --build` sobe o Postgres, o Mailpit e a API em `http://localhost:3333`. A API aplica as migrations ao iniciar. Confira com `curl http://localhost:3333/api/health`.
- `pnpm dev` sobe o site em `http://localhost:4321`; a plataforma fica em `http://localhost:4321/app`.
- Os e-mails enviados em desenvolvimento aparecem no Mailpit: `http://localhost:8025`.

Para desenvolver a API com recarga automática fora do Docker, pare o serviço do compose e use o script da raiz, que aplica as migrations e sobe a API em modo watch lendo o `.env`:

```sh
docker compose stop api
pnpm dev:api
```

## Primeiro administrador

Com a API rodando no compose:

```sh
docker compose exec api node src/cli/create-admin.ts --nome "Ana Souza" --email ana@exemplo.com
```

Fora do Docker (lendo o `.env`):

```sh
pnpm --filter api create-admin --nome "Ana Souza" --email ana@exemplo.com
```

O convite chega no Mailpit. Se o e-mail já for de um administrador que ainda não aceitou o convite, o comando envia um novo convite e invalida o anterior.

## Modo demonstração

Com `DEMO_MODE=true` (ligado no compose de desenvolvimento e no `.env.example`; o padrão do código é `false`), a API publica em `GET /api/public/demo-accounts` a lista das contas de demonstração, que a tela de login mostra para entrar com um clique. Com `DEMO_MODE=false` a rota responde 404 e as contas demo não entram, mesmo que ainda existam no banco.

Para criar ou restaurar os dados de demonstração com a API rodando no compose:

```sh
docker compose exec -T api node src/cli/seed-demo.ts
```

Fora do Docker (lendo o `.env`): `pnpm --filter api seed-demo`.

O comando cria as contas abaixo, todas com a senha `fixable123`, e os dados do modelo para cada cliente: imóvel, dados da residência, planta padrão, serviços nos cômodos (um concluído há poucas horas, para mostrar a regra das 24 h), solicitações e agendamentos no mês atual e no próximo. Para as telas do admin, cria um lead por cliente demo (atribuído ao Rafael), dois leads sem atribuição e quatro candidaturas (duas pendentes, uma aprovada e uma recusada). As datas são relativas ao dia em que o comando roda; rode de novo antes de uma apresentação para a demo parecer atual.

| Perfil | E-mail |
|---|---|
| Admin | `admin.demo@fixable.com.br` |
| Engenheiro (Rafael Lima) | `rafael.demo@fixable.com.br` |
| Cliente (Ana Souza, sobrado) | `ana.demo@fixable.com.br` |
| Cliente (Carlos Mendes, apartamento) | `carlos.demo@fixable.com.br` |
| Cliente (Juliana Prado, casa térrea) | `juliana.demo@fixable.com.br` |

Rodar de novo apaga e recria só os clientes demo, numa transação; nada de outras contas é alterado. Leads, candidaturas e contas com e-mail terminado em `.demo@fixable.com.br` são tratados como demonstração: o reseed e o `--remove` os apagam, e aprovar uma candidatura desse domínio cria uma conta demo, que nunca recebe leads reais. O comando recusa rodar sem `DEMO_MODE=true` e recusa se um desses e-mails já for de uma conta real. Contas demo nunca recebem leads reais: a atribuição automática ignora o engenheiro demo.

Para usar a plataforma de verdade, desligue o modo demo (`DEMO_MODE=false` e reinicie a API) e apague as contas demo com os dados delas:

```sh
docker compose exec -T api node src/cli/seed-demo.ts --remove
```

## Proxy reverso

A API descobre o IP do visitante, usado no rate limit, pelo `X-Forwarded-For`, confiando em `TRUST_PROXY_HOPS` saltos:

- `0` (padrão, desenvolvimento): ignora o cabeçalho e usa o endereço da conexão;
- `1`: só um proxy fica na frente da API, como o Caddy do `deploy/compose.prod.yml`. É o padrão da imagem Docker e o valor fixo do compose de produção.

Um valor maior que o número real de proxies deixa o visitante forjar o IP. Um valor menor faz todos os visitantes dividirem o mesmo limite.

Com uma CDN na frente do Caddy, o valor continua `1`: quem precisa saber da CDN é o Caddy, com `trusted_proxies` no `Caddyfile`. Sem isso o Caddy descarta o `X-Forwarded-For` da CDN, e a API veria o IP da CDN qualquer que fosse o `TRUST_PROXY_HOPS`. O passo a passo está na seção 9 do `deploy/README.md`.

## Deploy

O passo a passo para um servidor Ubuntu limpo está em `deploy/README.md`. Para validar o kit localmente, com as portas 80 e 443 livres:

```sh
pnpm deploy:smoke
```

O smoke gera o site, sobe o compose de produção no projeto `fixable-smoke` com `https://localhost`, roda o Playwright de `apps/site/playwright.caddy.config.ts` e derruba tudo no final.

## Testes

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
```

- `pnpm test` usa o banco `fixable_test` do Postgres do compose.
- `pnpm e2e` roda o Playwright contra a API em `:3333` e o site em `:4321`, reaproveitando os que já estiverem rodando. Na primeira vez, instale o navegador com `pnpm --filter site exec playwright install chromium`.
- Depois de mudar o código da API, recrie o container antes do e2e: `docker compose up -d --build api`.

### O e2e e os engenheiros que já estão no banco de dev

O e2e usa o banco de desenvolvimento (`fixable`), sem limpá-lo. O fluxo da plataforma convida um engenheiro novo e espera que o diagnóstico enviado em seguida vá para ele. A API entrega cada cliente novo ao engenheiro ativo com menos clientes e, no empate, ao mais antigo. Então, se o banco de dev tiver um engenheiro ativo sem nenhum cliente, ele ganha o diagnóstico, e o teste "diagnóstico do visitante é atribuído ao engenheiro novo e aparece nos leads do admin" falha dizendo que o lead foi para outro engenheiro.

Para ver quem são esses engenheiros:

```sh
docker compose exec db psql -U fixable -d fixable -c "SELECT u.email FROM users u LEFT JOIN clients c ON c.engineer_id = u.id WHERE u.role = 'engenheiro' AND u.status = 'ativo' GROUP BY u.id HAVING count(c.id) = 0;"
```

Para resolver, faça uma destas (a tela Equipe do admin ainda não bloqueia nem remove pessoas):

- bloqueie esses engenheiros no banco de dev:

  ```sh
  docker compose exec db psql -U fixable -d fixable -c "UPDATE users SET status = 'bloqueado' WHERE role = 'engenheiro' AND status = 'ativo' AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.engineer_id = users.id);"
  ```

- ou recrie o banco de dev: `docker compose down -v` e `docker compose up -d --build`. Isso apaga todos os dados de desenvolvimento.

Os engenheiros que o próprio e2e cria recebem um cliente na mesma execução, então não causam o problema nas execuções seguintes.

## Teste manual do fluxo público

Com `docker compose up -d --build` e `pnpm dev` rodando:

1. Abra `http://localhost:4321`, escolha um pacote em "Solicitar orçamento" e veja o chip "Plano de interesse" no formulário.
2. Preencha o diagnóstico, aceite os termos e envie. A tela mostra "Solicitação registrada.".
3. Abra o Mailpit (`http://localhost:8025`) e o e-mail de convite enviado ao endereço informado.
4. Clique no link do convite (`/app/convite#token=...`), crie a senha e confira que você cai no painel do cliente em `/app/cliente`.
5. Teste também o formulário "Faça parte do time" (resposta "Cadastro recebido.") e uma página de serviço por cidade, como `http://localhost:4321/servicos/eletrica/santo-andre`, que já vem com a cidade preenchida.

Cada rota pública aceita `PUBLIC_FORM_RATE_LIMIT` envios a cada 15 minutos por IP. O padrão, usado em produção, é 5; o compose de desenvolvimento e o `.env.example` usam 100. Se receber 429 ao repetir o teste, reinicie a API com `docker compose restart api`.

O login e os endpoints de token (convite, redefinição de senha e consulta do token) também têm limite por IP a cada 15 minutos: `LOGIN_RATE_LIMIT` (padrão 10) e `TOKEN_RATE_LIMIT` (padrão 20). Produção usa os padrões; o compose de desenvolvimento, o `.env.example`, o e2e e o smoke do deploy usam 1000, para os testes repetidos não esbarrarem no limite.
