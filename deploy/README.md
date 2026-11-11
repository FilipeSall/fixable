# Deploy da Fixable

Kit de produção para um servidor Ubuntu com Docker. O `compose.prod.yml` sobe quatro serviços:

| Serviço  | Imagem               | O que faz                                                                                   | Porta no host       |
| -------- | -------------------- | ------------------------------------------------------------------------------------------- | ------------------- |
| `db`     | `postgres:17`        | Banco de dados, com volume `db-data`.                                                        | nenhuma             |
| `api`    | `apps/api/Dockerfile` | API Fastify. Aplica as migrations ao iniciar.                                               | nenhuma             |
| `web`    | `caddy:2`            | HTTPS automático (Let's Encrypt), site estático de `apps/site/dist` e proxy de `/api` para a API. | 80, 443 e 443/udp |
| `backup` | `postgres:17`        | `pg_dump` diário no volume `backups`, com retenção de 7 dias.                                | nenhuma             |

O banco e a API não publicam porta: só o Caddy fala com a API. Por isso `TRUST_PROXY_HOPS=1` é o valor certo, e ninguém de fora consegue forjar o IP pelo `X-Forwarded-For`.

O que o `Caddyfile` faz:

- `/api/*` vai para a API;
- `/app/*` serve o arquivo pedido ou cai em `/app/index.html`, a SPA;
- o resto serve o arquivo, ou `<caminho>/index.html`, ou responde 404 com a página `/404.html`;
- comprime com zstd e gzip;
- envia `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` e `X-Frame-Options: DENY` em toda resposta, inclusive no 404, e esconde o cabeçalho `Server`;
- `Cache-Control: no-cache` no HTML e nos arquivos sem hash, e `public, max-age=31536000, immutable` em `/_astro/*`, que tem hash no nome;
- grava o log de acesso sem a query string e sem `Referer`, `Cookie`, `Authorization` e `Set-Cookie`. Os tokens de convite e de redefinição de senha viajam no fragmento da URL (`#token=...`), que o navegador não envia, e a consulta do token é um POST. Então nenhum token chega ao log.

## 1. Preparar o servidor (Ubuntu 24.04 limpo)

Instale o Docker com o Compose:

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

Saia e entre de novo na sessão SSH para o grupo `docker` valer. Confira com `docker compose version`.

Instale o Node 24 e o pnpm, usados só para gerar o site estático:

```sh
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git
sudo corepack enable
```

Libere SSH, HTTP e HTTPS no firewall:

```sh
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
```

## 2. Apontar o DNS

No painel do domínio, crie um registro `A` com o domínio (por exemplo `fixable.com.br`) apontando para o IP público do servidor, e um `AAAA` se o servidor tiver IPv6. Espere propagar e confira:

```sh
dig +short fixable.com.br
```

O Caddy só consegue emitir o certificado quando o domínio já resolve para o servidor e as portas 80 e 443 estão abertas. Se subir antes, ele tenta de novo sozinho, mas o Let's Encrypt limita as tentativas: prefira subir com o DNS pronto.

## 3. Baixar o código e preencher o `.env.prod`

```sh
sudo mkdir -p /opt/fixable && sudo chown "$USER" /opt/fixable
git clone <url-do-repositorio> /opt/fixable
cd /opt/fixable
cp deploy/.env.prod.example deploy/.env.prod
chmod 600 deploy/.env.prod
```

Edite `deploy/.env.prod`. Ele fica fora do git (`.gitignore`) e da imagem Docker (`.dockerignore`).

| Variável                | Exemplo                                     | Observação                                                                                                   |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DOMAIN`                | `fixable.com.br`                            | Sem `https://` e sem barra. Define o certificado e o `APP_ORIGIN` da API (`https://${DOMAIN}`).               |
| `POSTGRES_USER`         | `fixable`                                   |                                                                                                              |
| `POSTGRES_PASSWORD`     | `openssl rand -hex 32`                      | Use só letras e números: a senha entra na `DATABASE_URL`.                                                    |
| `POSTGRES_DB`           | `fixable`                                   |                                                                                                              |
| `SMTP_URL`              | `smtps://usuario:senha@smtp.provedor.com:465` | Porta 465: `smtps://`. Porta 587 (STARTTLS): `smtp://usuario:senha@host:587`. Codifique caracteres especiais do usuário e da senha (`@` vira `%40`). |
| `MAIL_FROM`             | `"Fixable <nao-responda@fixable.com.br>"`   | Entre aspas. O domínio precisa estar autorizado no provedor de SMTP (SPF e DKIM).                            |
| `TEAM_EMAIL`            | `equipe@fixable.com.br`                     | Caixa da equipe que recebe os avisos de leads e cadastros. Obrigatório em produção.                          |
| `PUBLIC_FORM_RATE_LIMIT`| `5`                                         | Envios por IP a cada 15 minutos em cada formulário público.                                                  |
| `TRUST_PROXY_HOPS`      | `1` (padrão)                                | Use `2` só se houver uma CDN ou outro proxy na frente do Caddy (por exemplo, o proxy laranja do Cloudflare).  |
| `BACKUP_TIME`           | `03:00`                                     | Horário do backup diário, no fuso `TZ`.                                                                      |
| `BACKUP_RETENTION_DAYS` | `7`                                         | Dias que cada dump fica guardado.                                                                            |
| `TZ`                    | `America/Sao_Paulo`                         | Fuso do serviço de backup.                                                                                   |

A API recusa subir se faltar alguma variável obrigatória, e o próprio Compose avisa qual delas falta.

Todos os comandos abaixo rodam na raiz do repositório. Para não repetir os parâmetros do Compose, crie um alias (e coloque no `~/.bashrc` para valer sempre):

```sh
alias fx='docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml'
```

`fx` equivale a `docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml`. Sem o `--env-file`, o Compose não lê o `.env.prod`.

## 4. Gerar o site e subir

O `SITE_URL` define o endereço usado no canonical, no sitemap e no `robots.txt`:

```sh
pnpm install --frozen-lockfile
SITE_URL=https://fixable.com.br pnpm build:site
fx up -d --build
```

Confira:

```sh
fx ps
curl https://fixable.com.br/api/health
```

A resposta esperada é `{"status":"ok","db":"ok"}`. Os logs ficam em `fx logs -f web api`. O Docker guarda até 5 arquivos de 10 MB por serviço.

## 5. Criar o primeiro administrador

```sh
fx exec api node src/cli/create-admin.ts --nome "Ana Souza" --email ana@exemplo.com
```

O convite chega no e-mail informado. O link abre `/app/convite`, onde o admin cria a senha e cai em `/app/admin/leads`. Se o e-mail não chegar, veja `fx logs api` e as credenciais do SMTP.

## 6. Backups

O serviço `backup` faz um `pg_dump` (formato custom) ao iniciar e todo dia no `BACKUP_TIME`. Os arquivos ficam no volume `backups` com o nome `fixable-AAAAMMDD-HHMMSS.dump`, e os mais velhos que `BACKUP_RETENTION_DAYS` são apagados.

```sh
fx exec backup ls -lh /backups
fx restart backup
```

O `fx restart backup` gera um dump na hora, útil antes de uma atualização.

O volume fica no mesmo disco do banco. Copie os dumps para fora do servidor com regularidade:

```sh
fx cp backup:/backups ./backups-copia
scp -r ./backups-copia usuario@outra-maquina:/caminho/
```

### Restaurar um backup

A restauração apaga e recria as tabelas do banco. Pare a API antes, para ninguém gravar no meio:

```sh
fx stop api
fx exec backup pg_restore --clean --if-exists --no-owner -d fixable /backups/fixable-20261111-030000.dump
fx start api
```

Troque `fixable` pelo `POSTGRES_DB`, se for outro. Para restaurar um arquivo que está fora do volume, copie-o antes com `fx cp ./arquivo.dump backup:/backups/`.

## 7. Atualizar a versão

```sh
cd /opt/fixable
fx restart backup
git pull
pnpm install --frozen-lockfile
SITE_URL=https://fixable.com.br pnpm build:site
fx up -d --build
```

- A API aplica as migrations novas ao iniciar.
- O Caddy lê os arquivos do `apps/site/dist` a cada requisição, então o site novo vale assim que o build termina.
- Se o `Caddyfile` mudou, rode `fx restart web`.
- Para voltar uma versão, faça `git checkout <commit-anterior>` e repita o build e o `up`. Se a versão nova já migrou o banco, restaure o dump feito antes da atualização.

## 8. Teste local do kit (`pnpm deploy:smoke`)

Na máquina de desenvolvimento, com Docker e as portas 80 e 443 livres:

```sh
pnpm deploy:smoke
```

O script `deploy/smoke.sh`:

1. gera o site com `SITE_URL=https://localhost`;
2. sobe o `compose.prod.yml` no projeto `fixable-smoke` com o `.env.smoke` (`DOMAIN=localhost`, certificado da CA interna do Caddy) e o `compose.smoke.yml`, que acrescenta um Mailpit só para o smoke, com a interface numa porta aleatória de `127.0.0.1`;
3. confere que a API e o banco não publicam porta no host;
4. cria um admin com o CLI dentro do container da API e confere que o backup inicial foi gerado;
5. roda o Playwright (`apps/site/playwright.caddy.config.ts`) contra `https://localhost`, ignorando o certificado: home, assets com cache imutável, página de serviço por cidade, 404, API e deep link da SPA, e o admin que aceita o convite, sai, entra de novo e chega a `/app/admin/leads`;
6. derruba tudo com `down -v`, mesmo se algo falhar, e mostra os logs da API, do Caddy e do backup quando falha.

O smoke não usa as portas do ambiente de desenvolvimento (5432, 3333, 4321, 1025 e 8025) e não toca nos containers e volumes do projeto `fixable`.

## Pendências que dependem da cliente

Resolver antes de abrir o site ao público:

- **Textos legais:** `/termos-de-uso` e `/privacidade` ainda dizem "Documento em elaboração", e o formulário pede o aceite desses documentos. Publicar os textos aprovados (`apps/site/src/pages/termos-de-uso.astro` e `privacidade.astro`).
- **Telefone e razão social:** `+55 11 90000-0000` e "Fixable Tecnologia e Serviços Ltda." são placeholders do modelo. Aparecem no rodapé (`apps/site/src/components/site/Footer.astro`) e nos dados estruturados de SEO (`apps/site/src/lib/seo.ts`).
- **SMTP:** escolher o provedor (por exemplo, o e-mail do domínio ou um serviço transacional), criar as credenciais para o `SMTP_URL`, autorizar o domínio do `MAIL_FROM` com SPF, DKIM e DMARC, e definir o `TEAM_EMAIL` real.
- **Domínio:** confirmar se o endereço oficial é com ou sem `www`. O kit atende um domínio só. Para redirecionar o outro, acrescente ao `Caddyfile`, com o DNS dele também apontado para o servidor:

  ```
  www.fixable.com.br {
  	redir https://fixable.com.br{uri} permanent
  }
  ```

## Limitações conhecidas

- O rate limit dos formulários fica na memória da API: rode uma instância só.
- Os e-mails sem link guardam dado pessoal em `email_outbox.data` depois do envio (pendência registrada no plano).
- O backup fica no mesmo servidor até alguém copiá-lo para fora.
