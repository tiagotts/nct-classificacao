# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Visão geral

Aplicativo desktop Electron que gera a classificação da fase de grupos de etapas
do Circuito NCT de Vôlei de Praia. Lê uma planilha `.xlsx` da etapa, aplica os
critérios de desempate do regulamento e monta a chave do mata-mata.

## Comandos

```
npm install            # instala dependências (postinstall recompila o módulo nativo)
npm start              # roda o app (electron .)
npm test               # roda toda a suíte de testes
npm run rebuild        # recompila better-sqlite3 para o ABI do Electron
npm run dist           # gera instaladores para a plataforma atual em dist/
npm run dist:mac       # .dmg (precisa rodar em macOS)
npm run dist:win       # .exe / nsis (precisa rodar em Windows)
npm run dist:linux     # AppImage

node tests/dump-chave.js [N]         # imprime a estrutura da chave para N duplas
```

Os testes são scripts Node puro, sem framework: cada arquivo faz
`process.exit(1)` quando falha. `npm test` os roda com o Node do próprio
Electron (`ELECTRON_RUN_AS_NODE=1 electron`), porque `better-sqlite3` é um
módulo nativo compilado para o ABI do Electron — rodar os testes do banco com
`node` direto falha por incompatibilidade de ABI. Não há lint ou build step;
a UI é HTML/CSS/JS direto, sem transpilação.

## Arquitetura

O app tem dois processos Electron e um motor que ainda não está conectado à UI.

- [main.js](main.js) — processo principal. Cria a `BrowserWindow`, monta o menu
  nativo, abre o diálogo de arquivo, persiste a configuração via IPC
  (`config:load` / `config:save`) e abre o banco SQLite. A config fica em
  `app.getPath('userData')/config.json`; o banco em `.../nct.db`.
- [src/db/](src/db/) — camada de banco SQLite (`better-sqlite3`). `database.js`
  abre a conexão e aplica as migrações de `migrations/` em ordem, controladas
  pelo `PRAGMA user_version`. O banco vive no processo main; o renderer só o
  acessa por IPC. Ver [docs/plano-migracao.md](docs/plano-migracao.md) para o
  modelo de dados e o roteiro da migração que substitui a entrada por planilha.
- [preload.js](preload.js) — expõe `window.electronAPI` ao renderer via
  `contextBridge` (sandbox ligado, sem nodeIntegration). Único canal entre
  main e renderer.
- [index.html](index.html) — a aplicação inteira: UI, parser de planilha e
  motor de classificação da fase de grupos, tudo num só arquivo. SheetJS é
  carregado por CDN.

Fluxo dentro de `index.html` (script no fim do arquivo):
`parseWorkbook` -> `autoDetectConfig` -> `buildConfigUI` -> `runEngine` ->
`compute` -> `render*`. O `compute` chama `sortByCriteria`/`resolveBlock`, que
aplica os critérios de desempate recursivamente (empate em um critério é
resolvido pelo próximo). O bloco `initElectron` no fim só age quando
`window.electronAPI` existe — o mesmo HTML também roda em navegador comum.

### Parser de planilha

`parseWorkbook` espera as abas `TABELA` (jogos), `GRUPOS` (mapa código -> nome)
e `REGULAMENTO` (texto opcional, de onde tenta inferir os cruzamentos). A
detecção de colunas é heurística: localiza a linha de cabeçalho procurando
"jogo" + "grupo", e acha a coluna de placar pela coluna que tem muitos "X".
Mudanças no parser devem preservar essa tolerância a planilhas variadas.

### Motor de chave dupla (NÃO integrado à UI)

[src/motor-chave-dupla.js](src/motor-chave-dupla.js) gera chaves de dupla
eliminação (double elimination) para N em {4, 8, 16, 32}: winners' bracket,
losers' bracket e grand final, com bracket reset opcional. Tem o seu próprio
mapeamento grupo -> seed (`mapearSeedsGrupoChave`, regras "em-blocos" e
"global").

Este módulo é testado mas ainda não é usado pelo `index.html`: a UI hoje só
renderiza cruzamentos simples (`config.cruzamentos`, função `renderBracket`).
O CSS de `index.html` já tem os estilos `.chave-bloco` / `.rounds` / `.match`
preparados para exibir a chave dupla, mas falta a integração. Ao mexer no
mata-mata, verifique de qual dos dois caminhos a tarefa trata.

## Convenções

- Todo o código, comentários e UI estão em português. Mantenha assim.
- Não use emojis em código novo (a UI atual ainda tem alguns; não adicione mais).
- O motor de chave dupla usa `module.exports` para os testes Node e
  `window.*` para o navegador — preserve os dois ao editar `src/`.
