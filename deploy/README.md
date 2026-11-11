# Deploy da Fixable

Kit de produção para um servidor Ubuntu com Docker. O `compose.prod.yml` sobe quatro serviços:

| Serviço  | Imagem               | O que faz                                                                                   | Porta no host       |
| -------- | -------------------- | ------------------------------------------------------------------------------------------- | ------------------- |
| `db`     | `postgres:17`        | Banco de dados, com volume `db-data`.                                                        | nenhuma             |
| `api`    | `apps/api/Dockerfile` | API Fastify. Aplica as migrations ao iniciar.                                               | nenhuma             |
| `web`    | `caddy:2`            | HTTPS automático (Let's Encrypt), site estático de `apps/site/dist` e proxy de `/api` para a API. | 80, 443 e 443/udp |
| `backup` | `postgres:17`        | `pg_dump` diário no volume `backups`, com retenção de 7 dias.                                | nenhuma             |

O banco e a API não publicam porta: só o Caddy fala com a API. O Caddy repassa à API, no `X-Forwarded-For`, só o IP do visitante (`{client_ip}`), e a API confia em um salto (`TRUST_PROXY_HOPS=1`, fixo no compose). Assim ninguém de fora consegue forjar o IP usado no rate limit.

O que o `Caddyfile` faz:

- `/api/*` vai para a API;
- `/app/*` serve o arquivo pedido ou cai em `/app/index.html`, a SPA;
- o resto serve o arquivo, ou `<caminho>/index.html`, ou responde 404 com a página `/404.html`;
- comprime com zstd e gzip;
- envia `Strict-Transport-Security: max-age=31536000` (HSTS de um ano, sem `includeSubDomains` e sem `preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` e `X-Frame-Options: DENY` em toda resposta, inclusive no 404, e esconde o cabeçalho `Server`;
- usa o `ACME_EMAIL` como contato na conta do Let's Encrypt, que avisa por e-mail sobre problemas na renovação do certificado;
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
| `DOMAIN`                | `fixable.com.br`                            | Sem `https://` e sem barra. Define o certificado, o `APP_ORIGIN` da API (`https://${DOMAIN}`) e o `SITE_URL` do build do site. |
| `ACME_EMAIL`            | `ti@fixable.com.br`                         | Contato da conta no Let's Encrypt. Use uma caixa lida por alguém: é para onde vão os avisos de certificado.   |
| `POSTGRES_USER`         | `fixable`                                   |                                                                                                              |
| `POSTGRES_PASSWORD`     | `openssl rand -hex 32`                      | Use só letras e números: a senha entra na `DATABASE_URL`.                                                    |
| `POSTGRES_DB`           | `fixable`                                   |                                                                                                              |
| `SMTP_URL`              | `smtps://usuario:senha@smtp.provedor.com:465` | Porta 465: `smtps://`. Porta 587 (STARTTLS): `smtp://usuario:senha@host:587`. Codifique caracteres especiais do usuário e da senha (`@` vira `%40`). |
| `MAIL_FROM`             | `"Fixable <nao-responda@fixable.com.br>"`   | Entre aspas. O domínio precisa estar autorizado no provedor de SMTP (SPF e DKIM).                            |
| `TEAM_EMAIL`            | `equipe@fixable.com.br`                     | Caixa da equipe que recebe os avisos de leads e cadastros. Obrigatório em produção.                          |
| `PUBLIC_FORM_RATE_LIMIT`| `5`                                         | Envios por IP a cada 15 minutos em cada formulário público.                                                  |
| `TOKEN_RATE_LIMIT`      | `20`                                        | Requisições por IP a cada 15 minutos em cada rota de token (aceitar convite, redefinir senha e consultar o token). Sem a variável, vale `20`. |
| `LOGIN_RATE_LIMIT`      | `10`                                        | Tentativas de login por IP a cada 15 minutos. Sem a variável, vale `10`.                                     |
| `DEMO_MODE`             | `true`                                      | Liga as contas de demonstração na tela de login (seção 5.1). O exemplo vem ligado para a apresentação; sem a variável, vale `false`. |
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

O site sai em dois passos, para que nada chegue ao ar antes da hora:

- `deploy/build-site.sh` lê o `DOMAIN` do `deploy/.env.prod` e gera o site com `SITE_URL=https://<DOMAIN>`, o endereço usado no canonical, no sitemap e no `robots.txt`. O resultado fica em `deploy/.site-build`, que o Caddy não serve. O build roda numa pasta temporária e só substitui o `deploy/.site-build` quando termina sem erro.
- `deploy/publish-site.sh` sincroniza o `deploy/.site-build` com `apps/site/dist`, a pasta que o Caddy serve, e apaga o `deploy/.site-build`. Usa `rsync --delete-after` ou, sem `rsync`, cópia seguida da remoção dos arquivos que sobraram. A pasta `apps/site/dist` nunca é apagada nem recriada, porque o Caddy a monta em `/srv`.

Na primeira subida ainda não há API antiga com que o site novo possa conflitar, então publique antes de subir. Assim a pasta `apps/site/dist` já existe com o seu usuário como dono quando o Docker a monta:

```sh
pnpm install --frozen-lockfile
bash deploy/build-site.sh
bash deploy/publish-site.sh
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

### 5.1 Dados de demonstração

Com `DEMO_MODE=true`, crie (ou restaure, antes de cada apresentação) as contas e os dados de demonstração:

```sh
fx exec -T api node src/cli/seed-demo.ts
```

As contas (`admin.demo`, `rafael.demo`, `ana.demo`, `carlos.demo` e `juliana.demo`, todas `@fixable.com.br`) usam a senha pública `fixable123` e aparecem na tela de login. Ou seja, `DEMO_MODE=true` expõe um login público: quem abrir o site entra como o admin demo.

As contas demo só enxergam dados de demonstração:

- o admin demo vê só os clientes de contas demo, com os imóveis e a agenda deles;
- ele vê só os leads e candidaturas do domínio `.demo@fixable.com.br`;
- ele não aprova nem recusa candidaturas reais (404);
- ele não convida ninguém para a equipe (403 `Indisponível no modo demonstração.`).

Mesmo assim, o uso real da plataforma deve rodar com `DEMO_MODE=false`. Deixe o modo demo ligado só durante a apresentação.

Para usar a plataforma de verdade, mude `DEMO_MODE=false` no `deploy/.env.prod`, recrie a API com `fx up -d api` e apague as contas demo com os dados delas:

```sh
fx exec -T api node src/cli/seed-demo.ts --remove
```

Com o modo demo desligado as contas demo já não entram, mesmo antes da remoção.

Depois de desligar, revise as contas criadas enquanto o modo demo esteve ligado e bloqueie as que você não reconhece:

```sh
fx exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select email, role, status, created_at from users where not is_demo order by created_at desc"'
```

## 6. Backups

O serviço `backup` faz um `pg_dump` (formato custom) ao iniciar e todo dia no `BACKUP_TIME`. Os arquivos ficam no volume `backups` com o nome `fixable-AAAAMMDD-HHMMSS.dump`, e os mais velhos que `BACKUP_RETENTION_DAYS` são apagados.

```sh
fx exec backup ls -lh /backups
fx restart backup
```

O `fx restart backup` gera um dump na hora, útil antes de uma atualização. O dump leva alguns segundos: confira com o `ls` que apareceu um arquivo novo, com a hora de agora e um tamanho parecido com o dos anteriores.

O primeiro dump da primeira subida sai praticamente vazio (menos de 1 KB), porque roda junto com as migrations da API, antes de as tabelas existirem. É esperado: os dumps seguintes saem completos.

O volume fica no mesmo disco do banco. Copie os dumps para fora do servidor com regularidade, cada cópia numa pasta com a data:

```sh
copia=~/fixable-backups/$(date +%Y%m%d-%H%M%S)
mkdir -p "$copia"
fx cp backup:/backups/. "$copia"
scp -r "$copia" usuario@outra-maquina:/caminho/
```

O serviço `backup` confere o `BACKUP_TIME` (formato `HH:MM`, de `00:00` a `23:59`) e o `BACKUP_RETENTION_DAYS` (inteiro, no mínimo `1`) ao iniciar. Com um valor inválido ele não sobe e explica o motivo em `fx logs backup`. Ao iniciar ele também apaga os `.partial` que um dump interrompido tenha deixado.

### Restaurar um backup

A restauração apaga o banco inteiro e o recria a partir do dump. Assim não sobra nada do estado atual, nem as tabelas que uma versão mais nova da API tenha criado depois do dump. Pare a API antes, para ninguém gravar no meio:

```sh
fx stop api
fx exec backup sh -c 'dropdb --force "$PGDATABASE"'
fx exec backup sh -c 'createdb "$PGDATABASE"'
fx exec backup sh -c 'pg_restore --no-owner --exit-on-error -d "$PGDATABASE" /backups/fixable-20261111-030000.dump'
fx start api
fx ps
```

- Troque o nome do arquivo pelo dump escolhido em `fx exec backup ls -lh /backups`.
- O `$PGDATABASE` vem entre aspas simples de propósito: quem o expande é o container, que já tem o `POSTGRES_DB`.
- O `--exit-on-error` para no primeiro erro. Se isso acontecer, o banco fica pela metade: corrija a causa e repita os três comandos, a partir do `dropdb`.
- Para restaurar um arquivo que está fora do volume, copie-o antes com `fx cp ./arquivo.dump backup:/backups/`.
- Depois do `fx start api`, confira `curl https://<DOMAIN>/api/health`.

## 7. Atualizar a versão

Antes de tudo, gere um dump e confira que ele saiu:

```sh
cd /opt/fixable
git rev-parse --short HEAD
fx restart backup
fx exec backup ls -lh /backups
```

Anote o commit atual (o `git rev-parse`) e o nome do dump de agora: são eles que permitem voltar. Só continue se o dump novo apareceu no `ls`, com a hora de agora e um tamanho coerente. Guarde uma cópia fora do volume, como na seção 6:

```sh
copia=~/fixable-backups/$(date +%Y%m%d-%H%M%S)
mkdir -p "$copia"
fx cp backup:/backups/. "$copia"
```

Depois atualize nesta ordem: gerar o site sem publicar, subir a API nova, esperar a API ficar saudável e só então publicar o site. Assim o site novo nunca chama uma API antiga.

```sh
git pull
pnpm install --frozen-lockfile
bash deploy/build-site.sh
fx up -d --build --wait --wait-timeout 300 api
curl -fsS https://fixable.com.br/api/health
bash deploy/publish-site.sh
fx up -d
fx ps
docker image prune -f
```

- O `build-site.sh` não mexe no site no ar: o Caddy continua servindo a versão antiga até o `publish-site.sh`.
- O `fx up -d --build --wait --wait-timeout 300 api` reconstrói só a API (e sobe o banco, se estiver parado) e espera o healthcheck dela passar. A API aplica as migrations novas ao iniciar.
- O `curl` precisa responder `{"status":"ok","db":"ok"}` antes da publicação.
- O site novo vale assim que o `publish-site.sh` termina: o Caddy lê os arquivos de `apps/site/dist` a cada requisição.
- O `fx up -d` final aplica mudanças do `compose.prod.yml` nos outros serviços. Se o `Caddyfile` mudou, rode também `fx restart web`.
- O `docker image prune -f` apaga as imagens antigas da API que ficaram sem uso, para não encher o disco.

Se o `fx up --wait` falhar ou o `curl` não responder `ok`, **não publique o site**. O Caddy continua com o site antigo, mas a API nova não está de pé. Veja o motivo em `fx logs api`, descarte o site gerado com `rm -rf deploy/.site-build` e volte para a versão anterior, como abaixo.

### Voltar para a versão anterior

Se a versão nova já migrou o banco, a versão antiga pode não funcionar com ele. Volte o banco para o dump feito antes da atualização e só então suba o código antigo:

1. Faça a restauração da seção 6 com o dump anotado antes da atualização (do `fx stop api` até o `pg_restore`, sem o `fx start api`).
2. Volte o código e suba:

   ```sh
   git checkout <commit-anotado>
   pnpm install --frozen-lockfile
   bash deploy/build-site.sh
   fx up -d --build --wait --wait-timeout 300 api
   curl -fsS https://fixable.com.br/api/health
   bash deploy/publish-site.sh
   fx up -d
   fx ps
   ```

Tudo o que foi gravado depois do dump se perde. Para voltar à versão mais nova depois, faça `git checkout main` e repita a atualização.

## 8. Teste local do kit (`pnpm deploy:smoke`)

Na máquina de desenvolvimento, com Docker e as portas 80 e 443 livres:

```sh
pnpm deploy:smoke
```

O script `deploy/smoke.sh`:

1. roda o `deploy/check-compose.sh`, que lê o `docker compose config` e confere os limites que chegam à API: `TOKEN_RATE_LIMIT=20` e `LOGIN_RATE_LIMIT=10` em produção, com ou sem as variáveis no `.env`, e `1000` nos dois no smoke;
2. gera o site com `deploy/build-site.sh deploy/.env.smoke` (`SITE_URL=https://localhost`) e confere que o build não mexeu em `apps/site/dist`;
3. sobe o `compose.prod.yml` no projeto `fixable-smoke` com o `.env.smoke` (`DOMAIN=localhost`, certificado da CA interna do Caddy) e o `compose.smoke.yml`, que acrescenta um Mailpit só para o smoke, com a interface numa porta aleatória de `127.0.0.1`, e espera todos os serviços ficarem saudáveis;
4. publica o site com `deploy/publish-site.sh` e confere que `apps/site/dist` ficou igual ao build;
5. confere que a API e o banco não publicam porta no host;
6. cria um admin com o CLI dentro do container da API e confere que o backup inicial foi gerado;
7. roda o Playwright (`apps/site/playwright.caddy.config.ts`) contra `https://localhost`, ignorando o certificado: home com os cabeçalhos de segurança (HSTS inclusive), assets com cache imutável, página de serviço por cidade, 404, API e deep link da SPA, e o admin que aceita o convite, sai, entra de novo e chega a `/app/admin/leads`;
8. derruba tudo com `down -v`, mesmo se algo falhar, e mostra os logs da API, do Caddy e do backup quando falha.

O smoke não usa as portas do ambiente de desenvolvimento (5432, 3333, 4321, 1025 e 8025) e não toca nos containers e volumes do projeto `fixable`.

## 9. Com uma CDN ou outro proxy na frente do Caddy

O kit supõe que o visitante se conecta direto ao Caddy. Com uma CDN no meio (por exemplo, o proxy laranja do Cloudflare), a conexão que chega ao Caddy é da CDN, e por padrão o Caddy ignora o `X-Forwarded-For` que ela envia: a API veria o IP da CDN e todos os visitantes dividiriam o mesmo limite de tentativas.

Mudar o `TRUST_PROXY_HOPS` não resolve, porque o IP do visitante nem chega à API. Ele continua em `1`. O que muda é o `Caddyfile`: diga ao Caddy em quais faixas de IP da CDN ele pode confiar, no bloco de opções globais do topo do arquivo:

```
{
	email {$ACME_EMAIL}
	servers {
		trusted_proxies static <faixas da CDN>
		trusted_proxies_strict
	}
}
```

- Troque `<faixas da CDN>` pelas faixas publicadas pela CDN, separadas por espaço (no Cloudflare, as listas de `https://www.cloudflare.com/ips-v4` e `https://www.cloudflare.com/ips-v6`). Revise de tempos em tempos, porque elas mudam.
- Com isso o `{client_ip}` passa a ser o IP do visitante informado pela CDN, e o `header_up X-Forwarded-For {client_ip}` que já está no `handle /api/*` o entrega à API. O `trusted_proxies_strict` lê o cabeçalho da direita para a esquerda, então um `X-Forwarded-For` forjado pelo visitante é ignorado.
- Aplique com `fx restart web`.
- Nunca use faixas amplas como `private_ranges` ou `0.0.0.0/0` aqui: qualquer um nessas faixas poderia forjar o IP.

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
