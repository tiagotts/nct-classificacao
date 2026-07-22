# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

Aplicativo desktop Electron (`productName` = **BeachPlay**) que administra as
etapas do Circuito NCT de Vôlei de Praia: cadastro de temporadas/etapas/
categorias, duplas, geração e placar dos jogos da fase de grupos, cálculo da
classificação, montagem do mata-mata, ranking acumulado da temporada e
publicação dos resultados como páginas estáticas no GitHub Pages.

Todo o estado persistente vive num SQLite local (`better-sqlite3`); a UI é uma
SPA de HTML/CSS/JS sem transpilação.

## Comandos

```
npm install                       # instala; postinstall recompila better-sqlite3
npm start                         # roda o app (electron .)
npm test                          # roda toda a suíte (Electron como Node)
npm run seed                      # popula o banco com dados de teste
npm run rebuild                   # recompila better-sqlite3 pro ABI do Electron
npm run dist[:mac|:win|:linux]    # gera instalador em dist/

node tests/dump-chave.js [N]      # imprime a chave dupla para N duplas
```

Rodar **um teste** isolado (o Node do próprio Electron é obrigatório porque
`better-sqlite3` é módulo nativo compilado para o ABI do Electron; `node`
direto falha):

```
ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron tests/test-classificacao.js
```

Os testes são scripts Node puros (sem framework); cada arquivo faz
`process.exit(1)` ao falhar. Não há lint nem build step.

## Arquitetura

Dois processos Electron com o banco só no main:

- [main.js](main.js) — cria a `BrowserWindow` (`sandbox: true`, sem
  `nodeIntegration`), monta o menu nativo, abre o banco. Em dev o banco é
  `data/nct.db` na raiz do projeto; empacotado, `userData/nct.db`. Também
  migra o `userData` antigo (quando o app se chamava "NCT Classificação")
  para o novo diretório "BeachPlay" na primeira execução.
- [preload.js](preload.js) — único canal main↔renderer. Expõe
  `window.electronAPI` via `contextBridge`, incluindo o namespace `db.*` com
  as chamadas CRUD e ações específicas de cada repositório.
- [src/db/](src/db/) — camada de banco.
  - `database.js` abre a conexão e aplica as migrações de `migrations/*.sql`
    em ordem, controladas por `PRAGMA user_version` (uma migração = um bump).
    **Nunca edite migrações já aplicadas**: crie um novo arquivo `NNNN_...sql`.
  - `repositorios/` guarda um arquivo por entidade (temporada, etapa,
    etapa-categoria, categoria, atleta, dupla, jogo, classificacao,
    ranking-*, pontuacao). Cada repositório expõe funções puras (sem estado)
    que executam SQL preparado.
  - `ipc.js` registra os handlers IPC (`registrarCrud` cobre o CRUD padrão;
    canais específicos como `jogo:gerarFaseGrupos`, `classificacao:calcular`,
    `publicacao:publicarEtapa` etc. são registrados à mão).
  - `backup.js` faz backup do próprio `nct.db` para um repo GitHub.
- [src/motor/](src/motor/) — regras de negócio puras, sem I/O de banco (os
  repositórios é que chamam essas funções): `classificacao.js` (critérios de
  desempate), `chave.js` (montagem simples), `jogos-grupo.js`, `pontuacao.js`
  (faixas de pontos por colocação), `ranking-entrada.js` (pontos que uma
  dupla ganha na etapa), `ranking-geral.js` (acumulado da temporada) e
  `serpentina.js` (distribuição de seeds em grupos).
- [src/motor-chave-dupla.js](src/motor-chave-dupla.js) — motor **legado** de
  chave de dupla eliminação (N em {4,8,16,32}). Ainda existe e é testado por
  `tests/test-chave-dupla.js`, mas **não é usado pela UI atual**; use
  `src/motor/chave.js` para mata-mata.
- [src/publicacao/](src/publicacao/) — geração das páginas estáticas.
  `gerar-pagina.js` monta o HTML (por categoria e página geral da etapa);
  `github.js` faz o commit/push via API REST para servir por GitHub Pages.
  IPC `publicacao:publicarEtapa`/`publicarCategoria` recebe as credenciais,
  publica e devolve `url` + QR code SVG. `publicacao:statusBuild` verifica se
  o Pages já publicou o commit específico.
- [renderer/](renderer/) — SPA. Ver seção abaixo.

O arquivo [index.html](index.html) na raiz é a **PoC v0.1 legada** (upload de
`.xlsx` com SheetJS, motor de classificação inline). Não é mais carregado pelo
`main.js` (que abre `renderer/index.html`) e não deve receber novas
funcionalidades — o fluxo atual é banco-centrado, não planilha-centrado.

### Renderer (SPA)

[renderer/index.html](renderer/index.html) carrega scripts em ordem:
`app.js` (roteador) → utilitários compartilhados → cada `telas/*.js` se
registra em `App.registrarTela(nome, { render })` → `App.iniciar()`.

- [renderer/app.js](renderer/app.js) — roteador, pilha de navegação, árvore
  do menu lateral e temas (paleta e logo da temporada corrente via CSS vars).
  Também tem `imprimirCategoria` e `imprimirRankingTemporada`, que injetam
  um `.print-header` no DOM e chamam `window.print()` (o CSS de
  `@media print` cuida do layout do PDF).
- Hierarquia de navegação: **Temporadas → Etapas → Categorias**; cada
  categoria abre as seções `duplas`, `jogos`, `classificacao`, `chave`,
  `ranking-temporada`, `config-categoria`. Alternar entre seções da mesma
  categoria usa `navegarSecao` (substitui o topo da pilha, não empilha).
- Chaves comuns nos `params` de tela: `temporadaId`, `etapaId`,
  `etapaCategoriaId`, `categoriaId`, `tipo` (`'masculino'` | `'feminino'`).
  A árvore lateral usa os `params` para expandir/destacar o nó certo.
- Renderer nunca faz SQL: só chama `window.electronAPI.db.*`, que roteia via
  IPC até os repositórios no main.

### Fluxo típico de uma etapa

1. Cria temporada e etapa; adiciona categorias (`etapaCategoria`).
2. Cadastra duplas na categoria.
3. `jogo:gerarFaseGrupos` cria a rodada. Placares entram por
   `jogo:registrarPlacar`. Ordem dos jogos é editável por
   `jogo:reordenarGrupo`.
4. `classificacao:calcular` aplica critérios de desempate e devolve a lista
   ordenada por grupo (com `seed` global via serpentina).
5. `jogo:gerarMataMata` monta a chave a partir da classificação.
6. `rankingEntrada:calcular` traduz colocação em pontos (usa
   `pontuacao.faixas`); `rankingTemporada:calcular` soma pelas etapas
   daquela temporada.
7. `publicacao:publicar*` publica HTML no GitHub Pages e devolve URL + QR.

## Convenções

- **Todo o código, comentários, mensagens de commit e UI em português.**
- **Nunca use emojis** em código, comentários ou UI (a PoC legada em
  `index.html` tem alguns; não adicione mais em lugar nenhum).
- Ao alterar o esquema do banco: novo arquivo em
  `src/db/migrations/NNNN_descricao.sql`, com `PRAGMA user_version = NNNN;` no
  fim. Nunca edite migrações antigas.
- Renderer não importa nada de `src/db/*` diretamente — só `window.electronAPI`.
  Se precisar de um dado novo no renderer, adicione handler em `ipc.js` e
  método em `preload.js`.
- Motores em `src/motor/` devem continuar puros (entram objetos JS, saem
  objetos JS; sem `require` de repositórios).
- `src/motor-chave-dupla.js` mantém a dupla exportação (`module.exports` +
  `window.*`) porque é testado como Node e originalmente usado no navegador.
