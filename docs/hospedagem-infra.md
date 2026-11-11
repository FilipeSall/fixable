# Fixable — roteiro de hospedagem

A Fixable roda inteira em Docker num único servidor Ubuntu: site, API, banco e backup diário. Para a apresentação, a infra precisa entregar três coisas: o servidor, o domínio apontado e acesso ao repositório. Os e-mails ficam numa caixa de teste no próprio servidor, então não é preciso SMTP de verdade até o uso real. O resto são os passos abaixo. O guia completo, com todos os detalhes, está em `deploy/README.md`.

## 1. O que a infra precisa providenciar

| Item | Especificação | Observação |
| --- | --- | --- |
| Servidor | Ubuntu 24.04 LTS, 2 vCPU, 4 GB de RAM, 40 GB de SSD | VPS simples atende. O build do site precisa de uns 2 GB de RAM livres. |
| Acesso | SSH com usuário sudo | Quem faz o deploy precisa de sudo para instalar o Docker. |
| Portas abertas | 22 (SSH), 80/tcp, 443/tcp e 443/udp | 80 e 443 são obrigatórias para o certificado HTTPS (Let's Encrypt). Nenhuma outra porta deve ficar aberta. |
| Domínio | Registro `A` (e `AAAA`, se houver IPv6) apontando para o IP do servidor | Definir se o endereço oficial é com ou sem `www`. O outro pode redirecionar. |
| SMTP (só para o uso real) | Host, porta, usuário e senha de um provedor de e-mail transacional ou do e-mail do domínio | Dispensável na apresentação. No uso real, o domínio do remetente precisa de SPF, DKIM e DMARC no DNS, senão os convites caem no spam. |
| E-mails | Uma caixa para avisos do certificado (`ACME_EMAIL`) e uma da equipe (`TEAM_EMAIL`) | Na apresentação, só o `ACME_EMAIL` precisa ser real. A da equipe recebe os avisos de novos leads e cadastros no uso real. |
| Repositório | Acesso de leitura ao Git (deploy key ou token) | Para o `git clone` e o `git pull` no servidor. |
| Cópia externa do backup | Um destino fora do servidor (outra máquina, bucket, storage) | O backup diário fica no mesmo disco do banco; alguém precisa copiá-lo para fora. |

Sem CDN na frente na primeira subida. Se depois quiserem Cloudflare com proxy ligado, há um ajuste no `Caddyfile` (seção 9 do `deploy/README.md`).

## 2. Como o sistema roda no servidor

```
Internet ──443/80──▶ web (Caddy) ──┬── arquivos do site (apps/site/dist)
                                   ├── /api/* ──▶ api (Node) ──▶ db (Postgres 17)
                                   │               │                 ▲
                                   │               ▼ e-mails         backup (pg_dump diário)
                                   └── /emails/ ─▶ mailpit (só na apresentação)
```

| Container | Função | Porta no host |
| --- | --- | --- |
| `web` | Caddy: HTTPS automático, site estático e proxy de `/api` | 80, 443 |
| `api` | API Fastify; aplica as migrations do banco ao iniciar | nenhuma |
| `db` | Postgres 17, dados no volume `db-data` | nenhuma |
| `backup` | `pg_dump` diário no volume `backups`, mantém 7 dias | nenhuma |
| `mailpit` | Só na apresentação: caixa de e-mails de teste em `https://<dominio>/emails/`, com senha | nenhuma |

Só o Caddy fica exposto. O banco e a API não publicam porta.

## 3. Passo a passo da instalação

Todos os comandos rodam no servidor, via SSH.

1. Instalar o Docker, o Node 24, o git e o rsync:

    ```sh
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker "$USER"
    curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
    sudo apt-get install -y nodejs git rsync
    sudo corepack enable
    ```

    Saia e entre de novo no SSH para o grupo `docker` valer. Confira com `docker compose version`.

2. Liberar o firewall:

    ```sh
    sudo ufw allow OpenSSH
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 443/udp
    sudo ufw enable
    ```

3. Conferir que o DNS já aponta para o servidor (`dig +short <dominio>` precisa devolver o IP). Subir antes disso faz o Let's Encrypt recusar e limitar novas tentativas.

4. Baixar o código e criar o arquivo de configuração:

    ```sh
    sudo mkdir -p /opt/fixable && sudo chown "$USER" /opt/fixable
    git clone <url-do-repositorio> /opt/fixable
    cd /opt/fixable
    cp deploy/.env.prod.example deploy/.env.prod
    chmod 600 deploy/.env.prod
    ```

    Preencher o `deploy/.env.prod` (seção 4).

5. Gerar a senha da caixa de e-mails de teste e colar a linha impressa no `deploy/.env.prod`, com as aspas simples:

    ```sh
    bash deploy/mailpit-auth.sh apresentacao
    ```

6. Criar o atalho do Compose para a apresentação, que inclui a caixa de e-mails (colocar também no `~/.bashrc`):

    ```sh
    alias fx='docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml -f deploy/compose.demo.yml'
    ```

7. Gerar o site e subir tudo:

    ```sh
    pnpm install --frozen-lockfile
    bash deploy/build-site.sh
    bash deploy/publish-site.sh
    fx up -d --build
    ```

8. Criar as contas e os dados de demonstração:

    ```sh
    fx exec -T api node src/cli/seed-demo.ts
    ```

    Rode de novo na véspera de cada apresentação: o comando recria as datas da agenda e dos serviços a partir do dia de hoje e desfaz o que for alterado nas apresentações anteriores.

## 4. Variáveis do `deploy/.env.prod`

| Variável | Exemplo | Observação |
| --- | --- | --- |
| `DOMAIN` | `fixable.com.br` | Sem `https://` e sem barra. |
| `ACME_EMAIL` | `ti@fixable.com.br` | Recebe os avisos do Let's Encrypt. |
| `POSTGRES_USER` | `fixable` | |
| `POSTGRES_PASSWORD` | gerar com `openssl rand -hex 32` | Só letras e números. |
| `POSTGRES_DB` | `fixable` | |
| `SMTP_URL` | `smtp://mailpit:1025` | Na apresentação, deixe esse valor. No uso real: `smtps://usuario:senha@smtp.provedor.com:465` (porta 587: `smtp://...:587`, caracteres especiais codificados, `@` vira `%40`). |
| `MAIL_FROM` | `"Fixable <nao-responda@fixable.com.br>"` | Entre aspas. No uso real, o domínio precisa estar autorizado no SMTP. |
| `TEAM_EMAIL` | `equipe@fixable.com.br` | Obrigatório. Na apresentação, os avisos para ela aparecem na caixa de teste. |
| `MAILPIT_UI_AUTH` | gerada pelo `deploy/mailpit-auth.sh` | Usuário e senha da caixa de e-mails de teste. Entre aspas simples. |
| `DEMO_MODE` | `true` | Mostra as contas de demonstração na tela de login. Usar `false` quando o sistema for usado de verdade. |
| `PUBLIC_FORM_RATE_LIMIT`, `TOKEN_RATE_LIMIT`, `LOGIN_RATE_LIMIT` | `5`, `20`, `10` | Manter os valores do exemplo. |
| `BACKUP_TIME`, `BACKUP_RETENTION_DAYS`, `TZ` | `03:00`, `7`, `America/Sao_Paulo` | Horário e retenção do backup. |

O arquivo fica fora do Git. A API não sobe se faltar variável obrigatória, e o Compose diz qual falta.

## 5. Como conferir que deu certo

- [ ] `fx ps` mostra os cinco containers (com o `mailpit`) como `healthy` ou `running`.
- [ ] `curl https://<dominio>/api/health` responde `{"status":"ok","db":"ok"}`.
- [ ] O site abre em `https://<dominio>` com cadeado válido.
- [ ] `https://<dominio>/emails/` pede usuário e senha e abre a caixa de e-mails de teste.
- [ ] Ao enviar o formulário "Solicite seu diagnóstico" do site, o aviso para a equipe aparece na caixa de teste.
- [ ] `https://<dominio>/app/login` mostra as contas de demonstração e o login com `admin.demo@fixable.com.br` / `fixable123` funciona.
- [ ] `fx exec backup ls -lh /backups` lista um arquivo `.dump`.

Se algo falhar, os logs estão em `fx logs -f web api`.

## 6. Operação do dia a dia

- **Atualizar a versão:** fazer backup (`fx restart backup`), `git pull`, gerar o site, subir a API nova, esperar o health e só então publicar o site. A sequência exata está na seção 7 do `deploy/README.md` e precisa ser seguida nessa ordem.
- **Backup:** automático todo dia às 03:00, guardado 7 dias no próprio servidor. Copiar os dumps para fora com regularidade (`fx cp backup:/backups/. <pasta>`).
- **Restaurar:** parar a API, recriar o banco e rodar o `pg_restore`. Comandos na seção 6 do `deploy/README.md`.
- **Fim da apresentação:** apagar os dados demo com `fx exec -T api node src/cli/seed-demo.ts --remove`. Depois, no `.env.prod`, mudar `DEMO_MODE=false` e colocar o `SMTP_URL` real. Por fim, voltar o atalho para `alias fx='docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yml'` e rodar `fx up -d --remove-orphans`, que tira a caixa de teste. Com o SMTP real, crie o primeiro administrador real: `fx exec api node src/cli/create-admin.ts --nome "Nome" --email admin@exemplo.com`.
- **Limitação:** rodar uma instância só da API (o controle de tentativas fica em memória).

## 7. O que ainda depende da cliente

- Textos de Termos de Uso e Política de Privacidade (hoje aparecem como "Documento em elaboração").
- Telefone e razão social reais (hoje são placeholders no rodapé e no SEO).
- Credenciais do SMTP e a caixa `TEAM_EMAIL` real, para o uso depois da apresentação.
- Domínio definitivo e se usa `www` ou não.
