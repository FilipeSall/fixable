# Roadmap de planos — Plataforma Fixable

PRD: `docs/superpowers/specs/2026-11-09-plataforma-fixable.md`

O PRD cobre subsistemas que entregam software testável de forma independente. Por isso, a
implementação é dividida em 5 planos, executados em ordem. Cada plano é escrito só depois que o
anterior termina, para partir das interfaces reais e não das imaginadas.

| # | Plano | Entrega testável | Histórias do PRD |
|---|---|---|---|
| 1 | Fundação e acesso | Monorepo, Postgres, API com login, convite, reset de senha e fila de e-mail; `/app` com telas de acesso; comando `create-admin` | 10–14, 45 (parcial) |
| 2 | Site público | Seções do Modelo 4 em Astro, Content Collections, formulários de diagnóstico e candidatura gravando na API (cliente, imóvel com maquete padrão, atribuição por menor carga, e-mails), páginas serviço × cidade e SEO | 1–9, 50, 51, 52 |
| 3 | Núcleo da plataforma | Políticas de permissão, clientes, imóveis e atributos, maquete, serviços, solicitações; telas do cliente e do engenheiro | 15–18, 22, 24–28, 54 |
| 4 | Projetos e operação | Armazenamento de arquivos, catálogo e perfil do profissional, projetos e fichas, conclusão, agendamentos e calendário, orçamentos, e-mails ao cliente | 19, 20, 23, 29–32, 34–42, 53 |
| 5 | Comunicação e admin | Conversas com polling e não lidas, contadores, painel admin completo, E2E finais e deploy no servidor da empresa | 21, 33, 43–49 |

Pendências de infraestrutura do PRD bloqueiam só a tarefa de deploy do plano 5.

## Revisão de escopo (2026-11-10)

O projeto é um trabalho de faculdade de uma cliente, e o objetivo é deixá-lo **minimamente funcional**. Por isso:

- O plano 2 foi enxugado: saíram a checagem de SEO, o Lighthouse, o smoke no nginx e as pendências de produção.
- Os planos 3 a 5 viram **um único Plano 3 — Plataforma núcleo**:
  - o admin vê os leads e aprova ou recusa candidaturas (aprovar envia o convite);
  - o engenheiro vê os clientes dele, edita a maquete, cria serviços nos cômodos, atualiza o status das solicitações e agenda visitas;
  - o cliente vê os imóveis, a maquete com os serviços, as solicitações e os agendamentos.
- O sistema **vai ser hospedado num servidor real**, então o Plano 3 termina com uma tarefa de **deploy mínimo**:
  - `compose` de produção com `api`, `db` e `web` (nginx servindo o `dist` do site e fazendo proxy de `/api`);
  - HTTPS;
  - SMTP real e `TEAM_EMAIL`;
  - `pg_dump` diário;
  - `Cache-Control` do nginx (`index.html` sem cache e assets imutáveis);
  - `stop_grace_period`;
  - smoke E2E atrás do nginx.
  - Essa tarefa depende das pendências de infraestrutura do PRD (servidor, domínio, SMTP).
- Ficam fora do escopo: upload de arquivos, orçamentos, chat, a ficha do profissional, o calendário anual e o hardening avançado (observabilidade, CI/CD e homologação).
