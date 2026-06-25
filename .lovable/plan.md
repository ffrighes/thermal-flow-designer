## Mudanças solicitadas

### 1. Não deletar tubulações quando equipamento é removido

Hoje, ao remover um nó (equipamento), todas as arestas (tubulações) conectadas a ele são removidas junto. O usuário quer preservar as linhas.

**Comportamento novo:** ao deletar um equipamento, as tubulações que estavam ligadas a ele permanecem no diagrama, com a extremidade que estava no equipamento agora "solta" — ancorada a um ponto livre na grade (na posição onde o equipamento estava). Essa extremidade vira um nó-junção (ver item 2) na mesma posição da porta antiga, para que a linha continue visível e editável.

### 2. Linhas conectáveis a outras linhas (via snap na grade)

React Flow só conecta arestas entre `Node`s, não entre `Edge`s diretamente. Para permitir "ligar uma tubulação a outra tubulação" mantendo snap na grade, vamos introduzir um novo tipo de nó:

- **Nó-junção** (`junction`): nó minúsculo (ponto/quadradinho 8x8) que existe apenas para servir de ponto de conexão. Snap na grade já existente (16px).
- Quando o usuário quiser ramificar uma linha existente, ele clica sobre a tubulação no ponto desejado → criamos um nó-junção naquele ponto (com snap à grade) e dividimos a aresta original em duas arestas que passam pela junção. A partir daí ele pode arrastar uma nova tubulação saindo da junção até outro equipamento/junção.
- Junções também são criadas automaticamente quando um equipamento conectado é deletado (item 1), preservando os endpoints das linhas.
- Junções podem ser arrastadas (continuam com snap) e deletadas individualmente; ao deletar uma junção, suas arestas adjacentes são fundidas novamente (se houver exatamente 2) ou removidas (se a junção ficar isolada).

### Mudanças técnicas

- `src/lib/thermal/equipment.ts`: nenhum efeito (junção não é "equipamento").
- Novo `src/components/flow/JunctionNode.tsx`: nó visual mínimo, com handles "source" e "target" sobrepostos no centro, para aceitar conexões em qualquer direção.
- `src/routes/_authenticated/projects.$id.tsx`:
  - Registrar `junction` em `nodeTypes`.
  - Alterar `deleteNode`: em vez de filtrar arestas, criar uma junção na posição do nó removido (centro aproximado) e reapontar as arestas afetadas para essa junção.
  - Adicionar `onEdgeClick` com modificador (ex.: `Alt+clique` ou um botão "Ramificar" no Inspector da tubulação) que cria junção no ponto clicado (com snap a 16px) e quebra a aresta em duas.
  - Garantir `snapToGrid` continua aplicado também ao arrasto da junção.
  - Persistência: ajustar `saveProject`/`loadProject` para aceitar nós do tipo `junction` (mesmo formato de nó, novo `tipo` lógico, sem `tag`/`parametros` significativos). Confirmar se o schema atual aceita string livre em `tipo`; caso contrário, plano de migração mínima é apenas armazenar `tipo: 'junction'` como string.
- `src/components/flow/Inspector.tsx`: quando o nó selecionado for uma junção, mostrar um painel reduzido ("Junção" + botão "Remover"). Quando uma tubulação for selecionada, adicionar botão "Ramificar aqui" que insere uma junção no centro da linha (fallback simples) — o fluxo principal de criação por clique no ponto exato vai pelo handler do canvas.

### Pontos a confirmar antes de implementar

- Para criar a junção sobre uma linha existente, a interação preferida é: **(a)** Alt+clique direto sobre a tubulação no canvas, **(b)** botão "Ramificar aqui" no Inspector da tubulação selecionada, ou **(c)** ambos? (Plano atual: ambos.)
- Aceita o comportamento de manter linhas "soltas" como junções após deletar equipamento? (Plano atual: sim.)
