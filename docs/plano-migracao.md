# Plano de migração: planilha Excel para SQLite

Documento de referência da evolução do app, que deixa de depender de planilhas
`.xlsx` e passa a usar um banco SQLite local com cadastro completo de
temporada, etapas, categorias, atletas, duplas, jogos e ranking.

## Decisões de base

- Banco: SQLite via `better-sqlite3` (API síncrona no processo main).
- O banco vive no processo main; o renderer fala com ele só por IPC, no mesmo
  padrão de `config:load`/`config:save` que já existe em `main.js`.
- Arquivo do banco: `app.getPath('userData')/nct.db` — mesmo diretório do
  `config.json` atual.
- Renderer continua vanilla JS, sem framework.
- `better-sqlite3` é módulo nativo. Para `node tests/...` ele é compilado para o
  Node do sistema. Para rodar o app (`npm start`/`npm run dist`) precisa ser
  recompilado para o ABI do Electron com `npm run rebuild`. Alternar entre os
  dois contextos exige recompilar. Se a fricção incomodar, o plano B é `sql.js`
  (SQLite em WebAssembly, sem módulo nativo) — só `database.js` e os
  repositórios mudam, o schema permanece.

## Estrutura de arquivos

```text
main.js                      -- + handlers IPC do banco
preload.js                   -- + APIs do banco expostas ao renderer
src/
  db/
    database.js              -- abre conexão, aplica migrações pendentes
    migrations/              -- migrações versionadas (0001_inicial.sql, ...)
    repositorios/            -- query layer por agregado
  motor/
    classificacao.js         -- motor da fase de grupos (portado do index.html)
    chave.js                 -- gerador de chave: eliminação simples + 3º lugar
    pontuacao.js             -- pontos por colocação + ranking de temporada
renderer/                    -- index.html quebrado em telas
tests/
```

O `src/motor-chave-dupla.js` atual fica parado (não é apagado): é dupla
eliminação, formato que o regulamento NCT não usa hoje.

A entrada de dados é 100% manual: não há importador de planilha. O parser
`.xlsx` e a dependência do SheetJS (CDN) em `index.html` serão removidos ao
longo da migração.

## Modelo de dados

```text
temporada(id, nome, ano)
etapa(id, temporada_id, nome, data, local)            -- a etapa do circuito
categoria(id, nome, slug)                             -- catálogo FIXO
etapa_categoria(id, etapa_id, categoria_id,           -- unidade de competição
                num_grupos, config_json)              -- independente
atleta(id, nome)                                      -- cadastro de pessoas
dupla(id, etapa_categoria_id, codigo, grupo,
      atleta1_id, atleta2_id,
      colocacao_final, pontos_ganhos)
jogo(id, etapa_categoria_id, fase, num, grupo,
     dupla1_id, dupla2_id,
     origem1_jogo_id, origem1_tipo,                   -- 'vencedor' | 'perdedor'
     origem2_jogo_id, origem2_tipo,
     placar1, placar2, tipo_resultado)                -- 'normal'|'wx0'|'desistencia'
pontuacao(id, etapa_categoria_id, pos_ini, pos_fim, pontos)
```

Pontos definidos pelo regulamento (item 15): 1º=200, 2º=180, 3º=160, 4º=140,
5º a 8º=120, 9º em diante=100.

## Formato do mata-mata

O regulamento NCT usa eliminação simples com disputa de 3º lugar:

```text
Quartas:  A(1x8)  B(4x5)  C(2x7)  D(3x6)
Semis:    venc.A x venc.B    venc.C x venc.D
Final 1:  perd.SF1 x perd.SF2  (3º lugar)
Final 2:  venc.SF1 x venc.SF2  (1º lugar)
```

Jogos de mata-mata nascem com slots indefinidos (`origem*`); ao gravar o placar
de um jogo, o sistema propaga vencedor/perdedor para o jogo dependente.

## Fases de implementação

- Fase 0 — Infraestrutura: CONCLUÍDA. `better-sqlite3`, `database.js` com
  runner de migrações, handlers IPC em `main.js`/`preload.js`.
- Fase 1 — Schema completo: CONCLUÍDA. Migração `0001_inicial.sql` com todas
  as tabelas, índices e o catálogo fixo de categorias semeado.
- Fase 2 — Camada de dados: CONCLUÍDA. Repositórios de CRUD em
  `src/db/repositorios/` e handlers IPC.
- Fase 3 — Telas de cadastro manual: CONCLUÍDA. Telas em `renderer/telas/`
  para temporadas, etapas, categorias da etapa, duplas (grid em lote) e jogos.
- Fase 4 — Motor de classificação: CONCLUÍDA. `src/motor/classificacao.js`,
  com critérios de desempate e tratamento de Wx0 (item 13) e desistência (item 14).
- Fase 5 — Gerador de chave: CONCLUÍDA. `src/motor/chave.js`, eliminação
  simples + 3º lugar; `src/motor/ranking-geral.js` para os classificados.
- Fase 6 — Propagação de resultados: CONCLUÍDA. Gravar placar do mata-mata
  preenche o jogo dependente e apura `colocacao_final`.
- Fase 7 — Pontuação e ranking de temporada por atleta: CONCLUÍDA.
  `src/motor/pontuacao.js`, com o desempate do item 1.

Todas as fases do plano foram concluídas. A entrada de dados é 100% pelo app
(`renderer/`); o `index.html` antigo (PoC com planilha) não é mais carregado.

## Riscos

- Rebuild do módulo nativo (ver "Decisões de base").
- Cadastro de atletas: a mesma pessoa pode ser cadastrada duas vezes com
  grafias diferentes do nome. As telas de dupla precisam de busca/autocomplete
  de atleta, e pode ser necessária uma tela para mesclar atletas duplicados.
- O cadastro manual de uma etapa inteira é trabalhoso; as telas devem agilizar
  a entrada repetitiva (jogos do grupo, duplas).
