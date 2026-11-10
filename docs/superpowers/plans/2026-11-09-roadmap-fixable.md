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
