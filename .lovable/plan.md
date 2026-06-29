# Criar tubulação como polilinha (estilo AutoCAD)

Substituir o botão "Nova linha" (que hoje cria uma linha pronta no centro) por um modo de desenho interativo, onde o usuário define o trajeto vértice por vértice.

## Fluxo de uso

1. Usuário clica em **Nova linha** → entra em "modo desenho" (cursor em mira).
2. Primeiro clique no canvas (ou sobre um equipamento/junção) define o **ponto inicial**.
3. Cliques seguintes adicionam vértices intermediários. O segmento atual em construção segue o cursor em tempo real (prévia em linha tracejada) e é forçado a ser **ortogonal** ao último vértice — horizontal ou vertical, escolhido pelo eixo de maior deslocamento. Todos os pontos fazem snap à grade de 16 px.
4. Clique sobre outro equipamento ou junção, ou **duplo-clique** no canvas, finaliza a polilinha.
5. **Esc** cancela o desenho atual sem criar nada.

Resultado: uma única aresta `ortho` com a sequência de waypoints exatamente como o usuário desenhou. Se o início ou o fim não tocar um equipamento, é criada automaticamente uma junção naquele ponto para servir de âncora — coerente com o modelo atual onde arestas conectam nós.

## Detalhes técnicos

- **`projects.$id.tsx`**
  - Novo estado `drawing: { points: Pt[]; cursor: Pt | null; startNodeId: string | null } | null`.
  - Botão "Nova linha" passa a alternar `drawing` em vez de chamar `addNewLine`. Quando ativo, cursor `crosshair` e overlay de prévia.
  - Handlers no `ReactFlow`:
    - `onPaneClick(evt)`: se `drawing`, adiciona vértice (snap) — usando `screenToFlowPosition`. Constrói ortogonalidade: se o último ponto existe, o novo vértice é projetado no eixo dominante (substituindo o eixo menor pelo do último ponto).
    - `onNodeClick(_, node)`: se `drawing` e node é `equipment`/`junction`, fixa início (se ainda não há) ou finaliza a polilinha conectando ao node.
    - `onPaneDoubleClick`: finaliza com junção criada no último ponto.
    - `onPaneMouseMove` (via `onMouseMove` no wrapper): atualiza `drawing.cursor` para prévia ao vivo.
  - Listener global `keydown` para `Escape` (cancela) e `Enter` (finaliza).
  - Ao finalizar:
    - Cria junções nos endpoints "soltos" (não-nó), reaproveita o ID do nó nos endpoints conectados.
    - Insere uma única aresta `type: "ortho"` com `data.waypoints` = vértices intermediários (sem src/tgt), `startAxis`/`endAxis` derivados dos dois primeiros e dois últimos pontos.

- **Prévia visual** — durante o desenho, renderizar um SVG overlay absoluto sobre o canvas (mesma transform do viewport React Flow via `useStore` para obter `{x, y, zoom}` da transformação), com `polyline` tracejada conectando `[...drawing.points, drawing.cursor]` em formato ortogonal.

- **Helpers reutilizados** — `snap`, `makeJunction`, lógica de inserção de aresta. `splitEdgeAt` permanece útil para Alt+clique.

- **Inspector** — atualizar dica do estado vazio: "Clique em **Nova linha** e depois clique no canvas para definir o ponto inicial, cliques seguintes adicionam vértices, duplo-clique ou Enter finaliza, Esc cancela."

## Pontos a confirmar

- Ortogonalidade forçada por eixo dominante do movimento do cursor está OK, ou prefere alternar H/V automaticamente (estilo AutoCAD ORTHO ON)?
- Endpoint solto deve sempre virar junção, ou prefere ignorar o clique se não acertar um equipamento/junção?
