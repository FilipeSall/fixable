# Fixable

Monorepo pnpm da plataforma Fixable:

- `packages/shared`: schemas Zod, papéis e rotas compartilhados entre API e site.
- `apps/api`: API Fastify + Drizzle + Postgres (rotas sob `/api`).
- `apps/site`: site Astro com a SPA React da plataforma em `/app`.
- `infra/nginx/fixable.conf`: nginx de referência para produção.

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

## Proxy reverso

A API descobre o IP do visitante, usado no rate limit, pelo `X-Forwarded-For`, confiando em `TRUST_PROXY_HOPS` saltos:

- `0` (padrão, desenvolvimento): ignora o cabeçalho e usa o endereço da conexão;
- `1`: só o nginx fica na frente da API. É o padrão da imagem Docker;
- `2`: há mais um proxy antes do nginx, como um terminador TLS ou uma CDN.

Um valor maior que o número real de proxies deixa o visitante forjar o IP. Um valor menor faz todos os visitantes dividirem o mesmo limite.

## Testes

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm e2e
```

- `pnpm test` usa o banco `fixable_test` do Postgres do compose.
- `pnpm e2e` roda o Playwright contra a API em `:3333` e o site em `:4321`, reaproveitando os que já estiverem rodando. Na primeira vez, instale o navegador com `pnpm --filter site exec playwright install chromium`.

## Teste manual do fluxo público

Com `docker compose up -d --build` e `pnpm dev` rodando:

1. Abra `http://localhost:4321`, escolha um pacote em "Solicitar orçamento" e veja o chip "Plano de interesse" no formulário.
2. Preencha o diagnóstico, aceite os termos e envie. A tela mostra "Solicitação registrada.".
3. Abra o Mailpit (`http://localhost:8025`) e o e-mail de convite enviado ao endereço informado.
4. Clique no link do convite (`/app/convite#token=...`), crie a senha e confira que você cai no painel do cliente em `/app/cliente`.
5. Teste também o formulário "Faça parte do time" (resposta "Cadastro recebido.") e uma página de serviço por cidade, como `http://localhost:4321/servicos/eletrica/santo-andre`, que já vem com a cidade preenchida.

Cada rota pública aceita 5 envios a cada 15 minutos por IP. Se receber 429 ao repetir o teste, reinicie a API com `docker compose restart api`.
