# Plano 1 — pendências para os próximos planos

Itens apontados nas revisões do plano 1 que ficaram para depois, com o plano em que devem entrar.

## Plano 2 (site público)

- Tratar 401 globalmente no front: um `onError` no QueryCache e nas mutations limpa `['me']` quando a API responde 401. Hoje uma sessão revogada só é percebida no próximo refetch de `me`.
- Smoke E2E contra o build servido pelo nginx (Chromium e WebKit), para validar `Referrer-Policy: same-origin` junto com a checagem de Origin.
- Rota `*` de fallback em `/app`. Hoje um caminho desconhecido renderiza vazio.
- `serializeError` (apps/api/src/plugins/log-redaction.ts): retornar o valor intacto quando não for `Error`.
- Logs de erro do Postgres ainda levam dado pessoal em `cause.detail` (ex.: `Key (email)=(...) already exists`). Redigir junto com a observabilidade.
- Texto de confirmação do "esqueci a senha": hoje fala só em redefinir a senha, mas para um usuário convidado o que chega é um convite.
- Os formulários públicos (diagnóstico e candidatura) devem normalizar o e-mail com `emailSchema`. O banco agora rejeita e-mail fora do padrão (`users_email_normalized`).

## Plano 5 (admin e deploy)

- Antes de abrir os formulários a envios reais, publicar os textos de termos de uso e privacidade aprovados pela cliente. Hoje as páginas dizem "Documento em elaboração", e o formulário pede o aceite desses documentos.
- Índices em `sessions.user_id` e `email_tokens.user_id` antes de o bloqueio pelo admin chamar `revokeUserSessions`.
- O bloqueio pelo admin deve encerrar as sessões ativas (`revokeUserSessions`).
- Ao aceitar convite ou redefinir senha, invalidar os tokens pendentes do outro propósito. Revisitar se o "reenviar convite" for usado como reset pelo admin.
- nginx: `Cache-Control: no-cache` para `/app/index.html` antes do primeiro deploy, e cache imutável para os assets com hash.
- `stop_grace_period` (ou um prazo no `stopWorker`) maior que o pior lote de SMTP. Com o padrão de 10s do Docker, um SMTP lento pode levar a SIGKILL no meio do envio.
- Definir `TRUST_PROXY_HOPS` pela topologia de proxy de produção: `1` só com o nginx na frente da API (padrão do Dockerfile), `2` se houver um terminador TLS ou CDN antes dele.
- Não publicar a porta 3333 da API em produção. Com `TRUST_PROXY_HOPS` maior que 0, quem fala direto com a API consegue forjar o IP no `X-Forwarded-For`.
- Configurar o `TEAM_EMAIL` real da equipe.
- Limpar o `email_outbox.data` inteiro depois do envio dos templates sem link, que hoje guardam dado pessoal.
- O telefone `+55 11 90000-0000` e a razão social "Fixable Tecnologia e Serviços Ltda." são placeholders do modelo. Confirmar com a cliente antes do deploy.

## Sem prazo (qualidade)

- Testes unitários de `shouldRewrite` (spa-fallback) e `shouldRetry` (App).
- O worker do outbox usa `console.error` em vez do logger do Fastify.
- A fila de e-mail entrega pelo menos uma vez: se o processo cair depois de o SMTP aceitar a mensagem e antes de a linha ser marcada como `enviado`, ela volta a ser enviada quando a reserva de 5 minutos vence. Idempotência no provedor (ex.: `Message-ID` estável) fica para quando houver um provedor transacional.
- O store do rate limit é em memória. Trocar antes de rodar mais de uma instância da API.
