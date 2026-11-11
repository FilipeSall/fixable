# Mapa da plataforma logada — modelo-4-plataforma.html

Arquivo: `/home/sea/projetos/fixable/docs/referencia/modelo-4-plataforma.html` (2910 linhas; números abaixo = linhas do original).
Todo o app logado é JS vanilla que escreve HTML em `#app-main`; estado em `localStorage` (`fixable_platform_v1`), sessão em `sessionStorage`. Nada de rotas: navegação por objeto `NAV = {screen, clientId, tab, floor, room, projectId, ptab, ...}` (L1618).

## 0. Diferenças entre o protótipo e o escopo do dono (importante para o plano)

- **Não existe perfil Admin** no protótipo. Papéis: `cliente`, `engenheiro`, `profissional` (L1511-1516). Tela de leads, "sem atribuição", aprovar/recusar candidatura, convite de engenheiro/admin: **nada de referência visual**; reutilizar `.client-grid/.client-card`, `.rows/.row-card`, `.pill`, `.stat-row`, `.fx-modal`, `.fx-tabs` (padrões abaixo). O mais próximo: `eng-clients` (lista de clientes) e a atribuição automática `pickEngineer()` (L2528: engenheiro com menos clientes).
- **Não existe alternância entre vários imóveis**: 1 cliente = 1 residência (`client.residencia`) = 1 maquete (`maquetes[cid]`). O "switcher de imóveis" é inédito: sugestão visual = `.floor-btn` (coluna lateral) ou `.fx-tabs` acima das abas do cliente.
- A relação cliente→engenheiro é fixa (`client.engId`); engenheiro só vê/edita clientes dele (`canEditClient`, L1519-1530).
- Serviços da maquete têm 4 status (`prioridade|atencao|execucao|concluido`); solicitações têm 4 status textuais; agendamentos 3 status. Os "projetos" (engenheiro↔profissional, ficha) estão fora de escopo.

## 1. Modelo de dados (seed L1373-1500, derivados L1519-1560)

- `users[]`: `{id, role, nome, email, telefone, cidade, crea?(eng), auth{hash}}`.
- `clients[]`: `{id (= user id), engId, createdAt, residencia:[{id,k,v}]}`. Chaves de residência do seed: Tipo de imóvel, Endereço, Cidade, Telefone, E-mail, Preferência de contato, Área construída, Ano de construção, Plano contratado, Descrição do problema.
- `maquetes[cid] = {floors:[{id, name, rooms:[{id,name,w,h,x,y}]}]}`; grade de **6 colunas** (`MQ_COLS`, L1820); `w` 1-4 (min com 6), `h` 1-2; `x`,`y` 0-based.
- `services[]`: `{id, clientId, title, desc, status, prazo(yyyy-mm-dd), percent, floorId, roomId, projectId, concluidoEm?, createdAt}`.
- `solicitacoes[]`: `{id, clientId, desc, status, createdAt}`.
- `agendamentos[]`: `{id, clientId, servico, date, hora, status, proId, descricao, orcamento, projectId}`.
- Seed demo: eng1 Rafael Lima (CREA-SP 5063412), c1 Ana Souza (Sobrado, 2 andares), c2 Carlos Mendes (Apartamento), c3 Juliana Prado (Casa térrea, recém-chegada). Senha demo `fixable123`.
- Templates de cômodos por tipo (`roomsFor`, L1362-1370):
  - Sobrado: Andar 1 {Sala de estar 3x2, Cozinha 2x1, Lavabo 1x1, Área de serviço 2x1, Garagem 1x1}; Andar 2 {Suíte 3x2, Quarto 2 2x1, Banheiro 1x1, Escritório 2x1, Varanda 1x1}.
  - Apartamento: Andar 1 {Sala 3x2, Cozinha 2x1, Área de serviço 1x1, Quarto 1 2x1, Banheiro 1x1, Quarto 2 3x1}.
  - Para empresas: {Recepção 2x1, Escritório 4x2, Copa 2x1, Banheiro 1x1, Depósito 1x1}.
  - Default (casa térrea): {Sala 3x2, Cozinha 2x1, Área de serviço 1x1, Quarto 1 2x1, Quarto 2 2x1, Banheiro 2x1}.
  - Cliente novo por cadastro: 1 andar "Andar 1" vazio (L2641).
- Constantes de status (L1323-1326):
  - `SVC_ST`: prioridade=["Prioridade", red], atencao=["Precisa de atenção", yellow], execucao=["Em execução", blue], concluido=["Concluído", green].
  - `SOL_ST`: "Em análise"=yellow, "Agendado"=clay, "Em execução"=blue, "Concluído"=green.
  - `AG_ST`: confirmado=["Confirmado", green], pendente=["Pendente · requer confirmação", yellow], adiado=["Adiado", red].
- Regras derivadas:
  - `servicePercent(s)`: concluído=100; senão % da ficha do projeto, ou `s.percent` (L1531). Sem projetos: usar só `s.percent`.
  - `roomInfo(s)` -> `{floor, room}`; cômodo removido mostra "Cômodo removido" (L1532).
  - **Regra 24 h**: serviço concluído continua visível na maquete/lista por `DAY` (24h) após `concluidoEm` (`visible`, L1830); depois só aparece no histórico. Em `svcCard`: "Já está no histórico de manutenção. Sai desta lista em cerca de {N} h." (N = ceil das horas restantes, mín. 1).
  - `concludeService(s)`: `status='concluido'`, `concluidoEm=now` (L1545).
  - `historyFor(cid)`: serviços concluídos ordenados por `concluidoEm` desc (L1556).
  - Prazo de serviço: `fmtDate` = dd/mm/aaaa, vazio = "—". Não há cálculo automático de atraso no protótipo.

## 2. Casca do app e login

### Login (L1100-1141; CSS L508-518 `.login-wide`, `.login-card`, `.demo-acc`)
- View `#view-login`. Painel esquerdo: banner `.demo-banner` "Demonstração"; `#login-panel`: h2 "Entrar na plataforma"; texto: "Cada perfil abre um ambiente diferente: o cliente acompanha a própria casa, o engenheiro administra clientes e profissionais, e o profissional parceiro executa e registra os serviços."
- Campos (`.fx-form .field`, erro `span.err`): "E-mail" (placeholder `voce@email.com`), "Senha" (placeholder "Sua senha"); botão `.btn.btn-primary.btn-block` "Entrar" (durante: "Verificando...").
- Erros: "Informe um e-mail válido.", "Informe sua senha.", "E-mail ou senha incorretos." (também para e-mail inexistente), "Esta conta ainda não tem senha. Use “Fazer cadastro” com este e-mail para criar a sua."
- Rodapé: "Ainda não tem uma conta? **Fazer cadastro**" (`button.link`).
- Cadastro (`#signup-panel`, L1122-1135): h2 "Criar conta"; nota "Crie seu acesso com e-mail e senha pessoal." (com convite/claim: "Seu cadastro foi recebido. Crie uma senha pessoal para acessar seu painel agora e nas próximas vezes."); campos "Nome completo", "E-mail", "Perfil de acesso" (select Cliente / Profissional parceiro / Engenheiro; oculto no claim), "Criar senha" (placeholder "Mínimo de 8 caracteres, com letras e números"), "Confirmar senha"; botão "Criar conta" ("Criando conta..."); "Já tem uma conta? **Entrar**".
- Erros de cadastro: "Informe seu nome completo.", "Este e-mail já está cadastrado. Entre com sua senha.", "A senha precisa ter pelo menos 8 caracteres.", "Use letras e números na senha.", "As senhas não coincidem.", "Escolha o perfil de acesso."
- Coluna direita `.login-card` (só demo, não replicar): "Contas de demonstração", botões `.demo-acc`, "Restaurar dados de demonstração".
- Roteamento pós-login (`ROUTE_BY_ROLE`, L2603): cliente -> tela `client`; engenheiro -> `eng-clients`; profissional -> `pro-clients`. Toast "Bem-vindo(a), {primeiro nome}." Cliente recém-cadastrado cai na aba `residencia`.
- Logout: toast "Você saiu da plataforma." e volta ao site.

### Shell (`#view-app`, L1143-1161; CSS L519-560)
- `header.app-top` (sticky, 70px): `.app-brand` (logo + "fixable", `aria-label` "Voltar ao site"), `.app-role` (texto), à direita `.app-user` (nome + subtítulo + `.av.sm`) e `.app-logout` "Sair".
- `.app-role`: "Painel do cliente" | "Painel do engenheiro" | "Painel do profissional parceiro".
- Subtítulo do `.app-user`: "Cliente Fixable" | "Engenheiro responsável" | "Ver meu perfil".
- `.app-body` grid `240px 1fr` (`.no-side` -> 1 coluna quando papel sem sidebar, ex. cliente); `aside.app-side` (fundo #f1f4ed); `.app-main` padding/área de conteúdo (L542).
- Sidebar (`SIDE`, L1879): engenheiro: `p.side-label` "Gestão" + botões `.side-btn` [Clientes (ícone person), "Catálogo de profissionais parceiros", Calendário]; profissional: "Meu trabalho" [Calendário, Clientes, Meu perfil]; nota `.side-note` "Modo demonstração: dados salvos neste navegador." (remover). Cliente: sem sidebar. Ativo: `.side-btn.active` (borda esquerda clay). Mobile <=1000px: sidebar vira barra horizontal sticky.
- Títulos de página: `h1.app-h` (DM Serif Display, clamp 2-2.9rem) + `p.app-sub`; breadcrumbs `nav.crumbs` com botões sublinhados + "/" (L545).
- Erro de tela: "Não foi possível abrir esta tela. Voltar ao início".
- Guarda de rota `screenAllowed` (L1914): cada papel só acessa suas telas; engenheiro só `eng-client` de cliente seu.

### Componentes comuns (helpers L1621-1625, CSS)
- `tabsBar` -> `.fx-tabs[role=tablist]` > `.fx-tab(.active)` (L567-573); `.fx-tabs.simul` = 3 colunas iguais (abas internas de projeto).
- `addBox(label)` -> `button.add-box` tracejado com `<b>+</b>` (L576-579); `.add-box.below` margem em cima.
- `pill(label,color)` -> `.pill.{green|yellow|red|blue|neutral|clay}` com bolinha `::before` (L595-604).
- `.b-sm` botão pequeno; variantes `.solid`, `.danger`, `.green`, `.yellow` (L606-613); `.icon-btn` (chevron) L614; `.btn-row` flex gap (L618); `a.link/button.link` sublinhado verde (L693).
- `.row-card` (`.l` texto, `.r` pill; `.click` = clicável) L580-587; `.empty` caixa tracejada (L588); `.hint` texto de dica (L593); `.demo-strip` faixa amarela (remover/adaptar).
- `.stat-row` (4 colunas, 2 no mobile) + `.stat` (`<b>` número DM Serif 2rem + `<small>`) L853-857.
- `.av` avatar com iniciais (L561-566; tamanhos `sm`, `md`).
- Modal: `#fx-modal.fx-modal` > `.fx-dialog` (max 560px; `.wide` 860) > `.fx-dialog-head` (h3 + `button.icon-btn` ✕ "Fechar") + `form.fx-form` com `.form-grid` de `.field` (`.field.full` ocupa 2 colunas) + `p.err#modal-err` + `.fx-dialog-foot` [extra à esquerda (Excluir, `margin-right:auto`), "Cancelar" `.b-sm`, submit `.b-sm.solid`] (CSS L840-847; `formModal` L2139). Validação devolve string de erro exibida em `#modal-err`.
- `confirmBox(título, texto, okLabel)`: modal com "Cancelar" + botão `.b-sm.danger` (ou `.solid`).
- Toast `#fx-toast` (L848-849): 3,2 s, fundo #1e3329, centro inferior.
- Tokens CSS (L467-475): `--fx-cream #fafbf7, --fx-sand #eaf0e6, --fx-paper #f1f4ed, --fx-line #c6d2c0, --fx-ink #1e3329, --fx-ink-2 #4a5d52, --fx-ink-3 #53665a, --fx-clay #2a4d3c (verde-escuro primário), --fx-clay-soft #dbe8d6, --fx-green #2f7a4a/#dcefe1, --fx-yellow #8a6312 (dot #c99a2e)/#f6ebcf, --fx-red #9b4034 (dot #b5463a)/#f4dfda, --fx-blue #355d7a (dot #3f6f93)/#dfe8ef`. Fontes: DM Serif Display (títulos), Manrope (UI), Sora (marca). Raio padrão 3px.

## 3. CLIENTE (tela `client`, L1925-1930; página compartilhada `clientPageHTML`, L1865)

Cabeçalho: `h1.app-h` "Olá, {primeiro nome}." + `p.app-sub` "Acompanhe sua casa, seus serviços e fale com {engenheiro}, engenheiro responsável." + (demo-strip omitir).
Abas (`CLIENT_TABS`, L1777): Solicitações · Agendamentos · Orçamentos(fora) · Serviços em andamento · Histórico de manutenção · Dados da residência · Chat(fora). Aba padrão: `solicitacoes`. Trocar aba zera `NAV.room` e `NAV.histOpen`. A **mesma página** serve o engenheiro com `edit=true` (L1865-1877): "O cliente vê as mesmas abas, sem edição".
Switcher de imóveis: inexistente (ver seção 0).

### 3.1 Aba Solicitações (`tabSolicitacoes`, L1779-1785)
- Lista `.rows` de `.row-card`: `<strong>{desc}</strong><small>Solicitado em dd/mm/aaaa às HH:MM</small>` + pill do status (cores `SOL_ST`). Ordem: mais recente primeiro.
- Vazio: "Nenhuma solicitação registrada."
- Engenheiro (edit): `addBox "Nova solicitação"` no topo; card clicável abre modal.
- Modal solicitação (`solForm`, L2243): título "Nova solicitação" / "Editar solicitação". Campos: "O que foi solicitado" (textarea, placeholder "Ex.: infiltração na parede do quarto", mín. 3 car., erro "Descreva o que foi solicitado."), "Status da atividade" (select Em análise [padrão] / Agendado / Em execução / Concluído). Botões "Adicionar" / "Salvar"; ao editar também "Excluir" (confirm "Excluir solicitação" / "Remover “{desc}”?" / "Excluir"). Toasts: "Solicitação adicionada." / "Solicitação atualizada." / "Solicitação excluída."

### 3.2 Aba Agendamentos (`calendarHTML`, L1630-1663; `agCard` L1664; `agDetail` L1682)
- Cartão `.cal` (L647): `.cal-head` (h3 com "Novembro de 2026" no modo mês; botão "Ver o ano todo"; dois `.icon-btn` chevron "Mês anterior"/"Próximo mês" — espelhado o da esquerda). **Visão anual = fora de escopo** (grade `.cal-year` 12 `.mini`); no escopo manter só mês, com mês inicial = hoje (no protótipo abre no ano; clique no mini-mês entra no mês).
- Visão mês: `.cal-month > .grid7`: cabeçalho `.wd` Dom Seg Ter Qua Qui Sex Sáb; células `.day` (`.out` = vazio antes do dia 1; `.today` borda verde; `.hl` destaque; `.has` clicável) com `<span class="n ev-{status}">` (círculo colorido) e `<span class="cnt">N serviço(s)</span>`. Cor do dia (`dayColor`): se algum adiado -> adiado; senão se algum pendente -> pendente; senão confirmado. Classes de cor `.ev-confirmado` verde, `.ev-pendente` amarelo, `.ev-adiado` vermelho (L660-662). Clicar em dia com evento destaca e abre o primeiro card.
- Legenda `.cal-legend`: "Confirmado", "Pendente ou requer confirmação", "Adiado".
- Lista abaixo: `h3.ag-list-title` "Agendamentos de {mês em minúsculas}" (ordenada por data+hora). Vazio: "Nenhum serviço agendado neste mês." (+ para engenheiro " Use “Novo agendamento” para criar o primeiro.").
- `.ag-card(.sel)`: `.ag-main` = `.ag-date` (`<b>dd</b><small>MÊS3</small>`: JAN FEV MAR ABR MAI JUN JUL AGO SET OUT NOV DEZ) + `.ag-info` (strong serviço; small nome do cliente; small "dd/mm/aaaa · HH:MM") + pill de status + `.icon-btn` chevron (aria "Ver detalhes do serviço"). Expandido: `.ag-detail > .det-grid` (2 colunas 1.2fr/1fr) com `.det-block` (h5 + p): "Serviço", "Descrição do serviço", "Resumo da ficha de análise" (fora de escopo), "Fotografias" (fora), coluna 2: "Cliente atendido", "Profissional parceiro" (pode omitir/simplificar), "Orçamento solicitado".
- Engenheiro: `addBox "Novo agendamento"` acima da lista; no detalhe linha de botões: "Confirmar" (`.b-sm.green`), "Marcar pendente" (`.yellow`), "Adiar" (`.danger`), "Editar", "Excluir" (`.danger`). Toast de status: `Agendamento marcado como “confirmado|pendente|adiado”.` (usa o rótulo antes de " ·", em minúsculas).
- Modal agendamento (`agForm`, L2287): "Novo agendamento"/"Editar agendamento". Campos: "Serviço agendado" (full; mín. 3: "Informe o serviço."), "Data" (date; padrão hoje+3 dias; "Informe uma data válida."), "Horário" (time, padrão 09:00; "Informe o horário."), "Status" (Confirmado / Pendente · requer confirmação [padrão] / Adiado), "Profissional parceiro" (select, opção "A definir"; fora de escopo omitir), "Projeto vinculado (ficha)" (fora), "Descrição do serviço a ser prestado" (textarea), "Orçamento solicitado" (texto livre, placeholder "Ex.: R$ 450,00" — fora de escopo por orçamentos, pode virar opcional/omitido). Botões "Agendar" / "Salvar". Toast: "Agendamento salvo. Ele já aparece no calendário do cliente e do profissional." Excluir: confirm "Excluir agendamento" / "“{serviço}” em dd/mm/aaaa será removido do calendário do cliente e do profissional."
- Cliente: calendário e lista somente leitura (sem botões de edição).

### 3.3 Aba Serviços em andamento = MAQUETE (`tabServicos`, L1825-1853; `svcCard` L1854; CSS L697-731, drag L864-865)
- Texto `p.app-sub`: "Maquete virtual da residência por andar e cômodo. " + (cliente) "Toque em um cômodo para ver o andamento dos serviços." / (eng) "Toque em um cômodo para adicionar ou editar serviços."
- Layout `.mq-wrap` grid `1fr 210px` (1 coluna <=800px): esquerda `.mq-stage` (planta: borda 2px, grid 6 colunas, linhas `--mq-row:84px` (62 no mobile), nº de linhas = max(3, max(y+h)) + 1 se edição); direita `.mq-floors` (coluna de andares).
- Cada cômodo = `button.mq-room(.sel)` posicionado com `grid-column:{x+1} / span {min(w,6)}; grid-row:{y+1} / span {h}`; conteúdo: `span.nm` (nome) + `span.mq-dots` com uma `i.mq-dot.{status}` por serviço do cômodo (title "{título} — {status}"). Cores: prioridade vermelho (anel pulsante), atenção amarelo, execução azul (anel pulsante), concluído verde. `aria-label` "{nome} — N serviço(s)". Planta vazia: "Nenhum cômodo neste andar."
- Legenda: "Prioridade", "Precisa de atenção", "Em execução", "Concluído (visível por 24 h)".
- Coluna de andares: (eng) botões `.b-sm.solid` "+ Adicionar andar" e `.b-sm` "+ Adicionar cômodo"; `span.lbl` "Andares"; `button.floor-btn(.active)` "{nome do andar}" + " · N serviço(s)" (conta não concluídos do andar); (eng) link "Renomear ou excluir este andar". Andar selecionado em `NAV.floor` (padrão: primeiro).
- Selecionar cômodo abre `.mq-pop` abaixo: `h4` nome do cômodo; botões (eng) "+ Adicionar serviço", "Editar cômodo"; sempre "Fechar"; lista de `svcCard`; vazio: "Nenhum serviço neste cômodo." (+ eng " Use “Adicionar serviço” para registrar um.").
- Abaixo: `h3.ag-list-title` "Serviços em {nome do andar}" + `svcCard` do andar ordenados: não concluídos antes, depois prioridade > atenção > execução > concluído. Vazio: "Nenhum serviço ativo neste andar."
- `svcCard` (`.svc-card.{status}` borda esquerda 4px colorida): `.svc-head` (strong título; small "{andar} · {cômodo}[ · profissional]") + pill do status; `p` descrição; `.bar > i.{status}` largura = percentual; `.svc-foot` "{N}% concluído" | "Prazo: dd/mm/aaaa"; se concluído: hint das 24 h (ver regra); botões (eng e não concluído): "Editar", "Marcar como concluído" (`.b-sm.green`).
- Edição de planta (eng): `.mq-stage.editable` arrasta cômodos (pointer drag, `bindRoomDrag` L2403) e persiste `x,y`; hint: "Arraste os cômodos para reorganizar a planta. A posição fica salva e os serviços continuam ligados a cada cômodo." Colisão via `overlaps/fitsAt/freeSpot` (L1821-1824): novo cômodo vai ao primeiro espaço livre. Alternativa mais simples ao drag: campos Coluna/Linha no modal de cômodo.
- Modal cômodo (`roomForm`, L2310): "Novo cômodo em {andar}" / "Editar cômodo"; "Nome do cômodo" (placeholder "Ex.: Quarto 3"; "Informe o nome do cômodo."), "Largura na maquete" (Estreito (1) / Médio (2) [padrão] / Largo (3) / Muito largo (4)), "Altura na maquete" (Baixo (1) / Alto (2)); ao editar: "Coluna na planta (1 a 6)", "Linha na planta"; erro de colisão "Essa posição ou tamanho encosta em outro cômodo. Escolha outro lugar ou arraste o cômodo na planta."; botão "Adicionar cômodo"/"Salvar"; "Excluir cômodo" (bloqueado se há serviço ativo: "Este cômodo tem serviços ativos. Conclua ou mova os serviços antes de excluir."). Toasts: "Cômodo adicionado à maquete.", "Cômodo atualizado.", "Cômodo excluído."
- Andar: "+ Adicionar andar" cria "Andar {n+1}" vazio, toast "Andar N adicionado. Agora adicione os cômodos."; modal "Editar andar" campo "Nome do andar" (erro "Informe o nome do andar."), botão "Salvar", "Excluir andar" (só se >1 andar; bloqueado: "Este andar tem serviços ativos. Conclua ou mova os serviços antes de excluir."); toast "Andar atualizado."
- Modal serviço (`svcForm`, L2329): "Adicionar serviço" / "Editar serviço". Campos: "Tarefa" (full, placeholder "Ex.: Trocar torneira do tanque", mín. 3 "Descreva a tarefa."), "Cômodo" (select agrupado `optgroup` por andar, opções "{andar} · {cômodo}", valor `floorId|roomId`), "Status e prioridade" (select dos 4 status; padrão "Precisa de atenção"; escolher Concluído conclui), "Prazo" (date), "Profissional responsável (projeto)" (fora de escopo), "Progresso (%) — usado quando não há ficha vinculada" (number 0-100, default 0; no plano sem projetos, rotular simplesmente "Progresso (%)"), "Descrição da tarefa" (textarea). Botões "Adicionar serviço"/"Salvar". Toasts: "Serviço salvo na maquete." / "Serviço concluído e enviado ao histórico de manutenção."
- Concluir (`svc-done`): confirmBox "Concluir serviço" / "“{título}” vai para o histórico de manutenção agora e continua visível em Serviços em andamento por 24 horas." / botão "Marcar como concluído".

### 3.4 Aba Histórico de manutenção (`tabHistorico`, L1807-1819)
- Lista de `.ag-card` (reuso): `.ag-info` strong título; small "{andar} · {cômodo} · Concluído em dd/mm/aaaa às HH:MM[ · profissional]"; pill "Concluído" verde; chevron expande (`NAV.histOpen`) mostrando `.det-block` "Descrição" (+ ficha, fora de escopo).
- Vazio: "Ainda não há serviços concluídos. Quando um serviço for marcado como concluído, ele aparece aqui automaticamente."

### 3.5 Aba Dados da residência (`tabResidencia`, L1802-1806; CSS `.kv` L734-738)
- Lista `.rows` de `.kv` (grid 3 col: `.k` rótulo, `.v` valor, ações). Vazio: "Nenhum dado cadastrado."
- Cliente: rodapé `p.hint`: "Dados enviados no formulário “Solicite seu diagnóstico” e atualizados pelo seu engenheiro." Sem edição.
- Engenheiro: por linha botões "Editar" e "Excluir" (`.danger`) + `addBox "Adicionar informação"` (`.below`). Modal `resForm`: "Nova informação da residência" / "Editar informação"; "Informação" (placeholder "Ex.: Área construída"), "Valor" (placeholder "Ex.: 180 m²"); erros "Preencha a informação e o valor.", "Já existe uma informação com esse nome. Edite a existente."; botões "Adicionar"/"Salvar"; toasts "Informação adicionada." / "Dados da residência atualizados."; excluir: confirm "Excluir informação" / "Remover “{k}” dos dados da residência?"; toast "Informação removida."

### 3.6 Fora de escopo (cliente): aba "Orçamentos" (L1794 `tabOrcamentos`, `payInfo`, modal `orcForm`, PIX, swipe-to-delete), aba "Chat" (`chatHTML` L1704), modal "Ver ficha completa"/"Ver ficha de detalhamento" (`fichaViewHTML` L1721, fotos, materiais), perfil do profissional (`profileHTML` L1742, modal L1770).

## 4. ENGENHEIRO

### 4.1 `eng-clients` — lista de clientes (L1934-1956; CSS L620-630)
- `h1.app-h` "Clientes"; sub: "Escolha um cliente para abrir a página dele ou acompanhar os profissionais parceiros que atendem a residência."
- `.stat-row` com 4 `.stat`: "Clientes vinculados" (n), "Solicitações em aberto" (solicitações com status != Concluído), "Serviços em andamento" (services != concluido), "Agendamentos a confirmar" (agendamentos pendente).
- `.client-grid` (auto-fill min 280px) de `.client-card(.open)`: botão de topo (toggle `NAV.openClient`) com `.top` (avatar, `strong` nome, `small` "{Tipo de imóvel} · {cidade}") e `.meta` (pill "Novo cliente" `clay` se criado há < 7 dias; pill `blue` "N serviço(s) ativo(s)" ou `neutral` "Sem serviços ativos"); ao abrir revela `.client-choice` com `.b-sm.solid` "Página do cliente" e `.b-sm` "Profissionais parceiros + clientes" (fora). Ordenado por `createdAt` desc.
- Vazio: "Nenhum cliente vinculado ainda. Quando alguém enviar o formulário “Solicite seu diagnóstico”, o cliente aparece aqui." Nota: o plano pede "contagem de solicitações abertas por cliente" — o protótipo mostra só serviços ativos no card; solicitações abertas só no total do stat; incluir no card é adição.

### 4.2 `eng-client` — página do cliente (L1957-1963)
- `nav.crumbs` "Clientes / {nome}"; `h1.app-h` nome; sub: "Página do cliente · você pode editar todas as informações. O cliente vê as mesmas abas, sem edição."; mesma `clientPageHTML(cid, edit=true)` das seções 3.1-3.5 (abas com `data-act=ctab`). Botão "Profissionais parceiros + clientes" no cabeçalho (fora de escopo).
- Dados do imóvel = aba "Dados da residência" com CRUD de pares chave/valor (3.5).

### 4.3 Fora de escopo (engenheiro): `eng-pros` (projetos ativos "Profissionais parceiros + {nome}", `projCard`, "Vincular profissional e enviar solicitação" `projForm` L2353, ficha, "Marcar serviço como concluído"), `eng-catalog` (grade de categorias `.cat-grid/.cat-card`, `.pro-grid/.pro-card`), `eng-profile`, `eng-cal` (calendário global do engenheiro, `mode:'eng'`, "Calendário": "Todos os agendamentos dos seus clientes. Use a seta de um agendamento para ver a descrição completa e o cliente atendido." — poderia ser reaproveitado pois usa o mesmo `calendarHTML`, mas o botão "Abrir na agenda do cliente" depende dele).

## 5. PROFISSIONAL — fora de escopo (listar para ignorar)
- `pro-clients` (cards `.proj-card` de projetos, "Histórico de serviços"), `pro-project` (abas Solicitações / Ficha de detalhamento / Falar com engenheiro, form de ficha com %, materiais, fotos, notas fiscais, `saveFicha`), `pro-cal`, `pro-client-ag`, `pro-profile` (perfil estilo LinkedIn, formulário, currículo, certificado "Fixable Certified" `.fx-cert`). Linhas: L1990-2029, L2061-2138, L1742-1776, CSS L756-826, L827-839.

## 6. ADMIN (não existe no protótipo)
Sugestões de reaproveitamento visual para o plano:
- Lista de leads: `.rows/.row-card` com pill de status + `.stat-row` para contadores (inclui "Sem atribuição" como pill `yellow`/`neutral`); filtros com `.fx-tabs` ou `select` do `fx-form`.
- Aprovar/Recusar candidatura: botões `.b-sm.green` "Aprovar" / `.b-sm.danger` "Recusar" com `confirmBox`; convite: modal `formModal` com "Nome completo", "E-mail", "Perfil" (Engenheiro / Administrador).
- Sidebar `SIDE` com itens ("Leads", "Candidaturas", "Equipe") seguindo `.side-btn` e `.side-label`.
- Cadastro por convite: aproveitar `#signup-panel` em modo `claim` (e-mail somente leitura, sem campo de perfil, "Seu cadastro foi recebido. Crie uma senha pessoal…").

## 7. Ações principais (`const A`, L2153-2242) — mapa data-act -> comportamento
`nav`, `ctab`, `floor`, `room`, `floor-add`, `floor-edit`, `room-new`, `room-edit`, `svc-new`, `svc-edit`, `svc-done`, `sol-new`, `sol-edit`, `res-new/edit/del`, `ag-new/edit/status/del/open`, `cal-step/day/month/year`, `hist-open`, `client-toggle`, `modal-close`, `logout`. Todas as mutações passam por `commit(msg)` = salvar + toast + re-render. Permissão de edição: `guardClient(cid)` -> toast "Você não tem permissão para editar este cliente."

## 8. CSS — onde mora (`<style id="fixable-platform">`, L465-883)
| Bloco | Linhas |
|---|---|
| Tokens `:root` | 467-475 |
| Login (`.login-wide`, `.login-card`, `.demo-acc`) | 508-518 |
| App shell (`.app-top`, `.app-body`, `.app-side`, `.side-btn`, `.crumbs`, `.demo-strip`, responsivo) | 519-560 |
| Avatar `.av` | 561-566 |
| Tabs `.fx-tabs/.fx-tab` | 567-574 |
| Listas/cartões (`.add-box`, `.rows`, `.row-card`, `.empty`, `.swipe-*`, `.hint`) | 575-594 |
| Pills | 595-605 |
| Botões `.b-sm`, `.icon-btn`, `.btn-row` | 606-619 |
| Clientes (`.client-grid/.client-card/.client-choice`) | 620-630 |
| Calendário (`.cal*`, `.mini`, `.day`, `.ev-*`, `.ag-*`, `.det-*`, `.link`) | 646-696 |
| Maquete (`.mq-*`, `.floor-btn`, `.svc-card`, `.bar`, `.svc-head/.svc-foot`) | 697-732 |
| Dados da residência `.kv` | 733-739 |
| Formulários do app (`.fx-form`, `.sheet`, `.form-grid`) | 780-826 |
| Projetos `.proj-card/.proj-head/.section-title` | 827-839 |
| Modal/toast/lightbox | 840-852 |
| Stat row | 853-858 |
| `.view` toggles, `[hidden]`, drag da maquete (`.mq-stage.editable`, `.mq-room.dragging`) | 859-865 |
Estilos de controles (select customizado) em L438-462 (`#fixable-select-styles`); CSS base do site (botões `.btn-primary`, `.field`, `.wrap`) em L11-332.

## 9. Trechos do JS por função (para consulta pontual)
Constantes/seed L1297-1500 · store/permissões L1502-1560 · modal/toast helpers L1564-1583 · NAV/helpers UI L1618-1625 · calendário L1626-1703 · abas do cliente L1777-1877 · maquete L1820-1853 · SIDE/render/screenAllowed L1879-1921 · SCREENS L1923-2028 · formulários modais L2139-2378 · swipe/drag L2380-2500 · login/cadastro L2503-2680.
