## Visão geral
App web para montar diagramas de balanço térmico de sistemas de refrigeração industrial. O usuário arrasta equipamentos para um canvas, conecta-os por tubulações, preenche parâmetros termodinâmicos e o app calcula o balanço — sempre mostrando fórmulas, unidades e o que está faltando. Toda a UI em pt-BR.

## Stack e identidade visual
- React + Vite + TypeScript + Tailwind v4 + shadcn/ui, rodando no template TanStack Start.
- Editor de fluxo: `@xyflow/react` (React Flow) com nós e arestas customizados.
- Backend: Lovable Cloud (Postgres + Auth + RLS).
- Tema **Industrial escuro** por padrão, com alternância claro/escuro:
  - Fundo `#0B1220`, superfícies `#111827`, acento ciano `#22D3EE`, texto `#F8FAFC`, borda sutil `#1F2937`, alertas `#F59E0B` (atenção) e `#EF4444` (erro).
  - Tipografia: Inter (UI) e JetBrains Mono (valores numéricos e fórmulas), via @fontsource.
  - Visual de "blueprint técnico": grid pontilhado no canvas, cantos retos com leve raio (radius-md), ícones lineares (lucide-react) por equipamento.

## Autenticação
- Email/senha + Google (via broker Lovable). Telas `/auth` (entrar/registrar) e redirect de volta ao editor.
- Rotas privadas sob `_authenticated/` (gate gerenciado pela integração).

## Estrutura de rotas
- `/` — landing curta explicando o app, com CTA para entrar.
- `/auth` — login/registro.
- `/_authenticated/projects` — lista de projetos do usuário (criar, renomear, abrir, excluir).
- `/_authenticated/projects/$id` — **editor de fluxo** (tela principal).

## Tela do editor
Layout em 3 colunas dentro de `SidebarProvider`:
1. **Paleta esquerda** — cards arrastáveis para os 9 equipamentos (Compressor, Condensador, Evaporador, Separador de Líquido, Depósito de Líquido, Chiller, Tanque de Termoacumulação, Trocador a Placas, UTA), cada um com ícone próprio.
2. **Canvas central** — React Flow com zoom, pan, grid pontilhado, minimap, controles, snap-to-grid. Nós customizados mostram ícone, tag editável (ex.: `CP-01`), portas de entrada/saída e badge de status (**OK** verde / **Dados Insuficientes** âmbar). Arestas customizadas representam tubulações com rótulo do material e diâmetro.
3. **Inspetor direito** — formulário do nó/aresta selecionado (shadcn Tabs: "Parâmetros", "Resultado", "Fórmulas").

Barra superior: nome do projeto editável, botões Novo / Abrir / Salvar, indicador de **auto-save** (debounce ~1s) + botão Salvar manual, botão **Calcular balanço**, toggle tema, menu do usuário.

Painel inferior recolhível: **Balanço térmico** do sistema (totais + verificação `Q_c ≈ Q_o + W` com tolerância ±5%).

## Catálogo de parâmetros (por nó)
Cada nó tem schema próprio (Zod) com unidades fixas. Campo vazio = "Dados Insuficientes"; **nunca** preencher com valor "típico".

- **Compressor** — P_suc, P_desc (bar, com seletor abs/man), T_suc, T_desc (°C), ṁ (kg/h), η_vol, η_isen (%), W (kW). Fórmula: `W = ṁ·(h_desc − h_suc)`.
- **Condensador** — T_cond, P_cond, h_ent, h_sai (kJ/kg), ṁ (kg/h), Q_c (kW). Fórmula: `Q_c = ṁ·(h_ent − h_sai)`.
- **Evaporador** — T_ev, P_ev, h_ent, h_sai, ṁ, Q_o (kW + TR). Fórmula: `Q_o = ṁ·(h_sai − h_ent)`.
- **Separador de Líquido** — P, T, taxa de recirculação n:1, ṁ_líq, ṁ_vap.
- **Depósito de Líquido** — P, V (m³/L), T_líq, nível %.
- **Chiller** — Q (kW + TR), T_ent_sec, T_sai_sec, vazão sec (m³/h), fluido sec. `Q = ṁ_sec·cp·ΔT`.
- **Tanque de Termoacumulação** — E (kWh), V (m³), T_carga, T_desc, meio (água/gelo/PCM).
- **Trocador a Placas** — Q (kW), T_quente_ent/sai, T_fria_ent/sai, vazões (m³/h), U (W/m²·K), A (m²), LMTD (°C). `Q = ṁ·cp·ΔT` e `Q = U·A·ΔT_ml`.
- **UTA** — vazão de ar (m³/h), T_insufl, T_retorno, Q_serp, Q_sens, Q_lat.

Unidades fixas: pressão **bar** (declarar abs/man, ciclo trabalha em absoluta), vazão volumétrica **m³/h**, comprimento/diâmetro **mm**, temperatura **°C**, capacidade/potência **kW** (+ TR onde indicado), entalpia **kJ/kg**, vazão mássica **kg/h**. Conversões mostradas em tooltip: `1 TR = 3,517 kW`; `P_abs = P_man + 1,013 bar`.

## Tubulação (aresta)
Painel: **Material — Aço Carbono / Inox** (com nota técnica: NH₃ ataca cobre/latão na presença de umidade — por isso só aço). Diâmetro nominal (mm), comprimento (mm, aceitar m e converter), fluido conduzido (NH₃ / secundário / ar), velocidade (m/s), perda de carga exibida como **ΔT equivalente (°C)** quando refrigerante. Rótulo/tag editável.

## Motor de cálculo (`src/lib/thermal/`)
Módulo puro, sem React. Estrutura:
- `units.ts` — conversões (bar↔kPa, abs↔man, kW↔TR, m↔mm, kg/h↔kg/s).
- `schemas.ts` — Zod por tipo de equipamento; cada campo declara unidade.
- `formulas.ts` — para cada equipamento retorna `{ symbolic, substituted, result, unit, missing[] }`.
- `system.ts` — agrega totais (ΣQ_o, ΣQ_c, ΣW), calcula resíduo `r = Q_c − (Q_o + W)`, sinaliza desvio se `|r|/Q_c > 5%`.
- Suíte de testes unitários (Vitest) cobrindo conversões e cada fórmula, incluindo casos com dados faltantes.

## Painel de balanço
Tabela por componente com três colunas: **Fórmula simbólica → Substituição com valores e unidades → Resultado**. Componentes incompletos listam exatamente os campos faltantes. Totais ao final + verificação Q_c ≈ Q_o + W (badge verde ≤5%, âmbar acima). Fórmulas renderizadas com KaTeX para clareza tipográfica.

## Persistência (Lovable Cloud)
Schema:
- `projects(id, user_id, nome, descricao, created_at, updated_at)`
- `nodes(id, project_id, tipo, tag, pos_x, pos_y, parametros jsonb)`
- `edges(id, project_id, source_node, target_node, material, parametros jsonb)`

RLS em todas as tabelas: `user_id = auth.uid()` em `projects`; `nodes` e `edges` autorizados via `project_id` pertencente ao usuário (helper `is_project_owner(project_id)` em SECURITY DEFINER). GRANTs para `authenticated` e `service_role`.

Salvamento: auto-save com debounce 1s (mutation única que substitui nodes/edges do projeto numa transação via server function) + botão Salvar manual que dispara o mesmo fluxo imediatamente. Indicador "Salvo às HH:MM" / "Salvando…".

## Server functions
- `listProjects`, `createProject`, `renameProject`, `deleteProject`, `loadProject(id)`, `saveProject(id, nodes, edges, meta)` — todas com `requireSupabaseAuth`, RLS aplica como o usuário.

## Out of scope da v1 (já documentar no app)
- Propriedades automáticas do R-717 via CoolProp (entalpias e estados ficam manuais).
- Dimensionamento automático de tubulação e seleção de compressor.

## Detalhes técnicos (resumo)

```text
src/
  lib/thermal/                 motor puro de cálculo + testes
  components/flow/             nós e arestas custom React Flow, paleta, inspetor
  components/balance/          tabela de fórmulas, totais, verificação
  routes/
    index.tsx                  landing
    auth.tsx                   login/registro (email + Google)
    _authenticated/route.tsx   (gerenciado pela integração)
    _authenticated/projects.index.tsx
    _authenticated/projects.$id.tsx   editor
  integrations/supabase/...    clients e middleware
  lib/projects.functions.ts    server fns (CRUD + load/save)
```

Pacotes a instalar: `@xyflow/react`, `zod`, `katex`, `react-katex`, `@fontsource/inter`, `@fontsource/jetbrains-mono`, `vitest` (dev).

## Critérios de aceite
- Login email/senha e Google funcionando; usuário só vê seus projetos.
- Arrastar 9 tipos de equipamento, conectá-los, editar parâmetros, salvar e reabrir o projeto idêntico.
- Cada cálculo aparece com fórmula simbólica → substituída → resultado, na unidade correta.
- Campos vazios geram "Dados Insuficientes" listando o que falta — sem valores fabricados.
- Painel de balanço mostra totais e verifica Q_c ≈ Q_o + W com tolerância ±5%.
- Tema escuro industrial por padrão, alternável para claro; layout responsivo.
