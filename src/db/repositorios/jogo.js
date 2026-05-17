// Repositório do jogo (fase de grupos e mata-mata).
// A propagação de resultados do mata-mata (preencher o jogo dependente a
// partir do vencedor/perdedor) entra na Fase 6 — aqui registrarPlacar só
// grava o placar.
const { getDb } = require('../database');
const duplaRepo = require('./dupla');
const etapaCategoriaRepo = require('./etapa-categoria');
const pontuacaoRepo = require('./pontuacao');
const motorGrupos = require('../../motor/jogos-grupo');
const { calcularRankingGeral } = require('../../motor/ranking-geral');
const { gerarChave } = require('../../motor/chave');
const { pontosDaColocacao } = require('../../motor/pontuacao');

// listar(etapaCategoriaId): jogos de uma categoria de uma etapa.
function listar(etapaCategoriaId) {
  return getDb()
    .prepare('SELECT * FROM jogo WHERE etapa_categoria_id = ? ORDER BY fase, num')
    .all(etapaCategoriaId);
}

function obter(id) {
  return getDb().prepare('SELECT * FROM jogo WHERE id = ?').get(id);
}

// criar: jogo de grupo informa dupla1Id/dupla2Id; jogo de mata-mata informa
// os campos origem* (id do jogo de origem + 'vencedor'|'perdedor').
function criar(d) {
  const info = getDb()
    .prepare(`INSERT INTO jogo
                (etapa_categoria_id, fase, num, grupo,
                 dupla1_id, dupla2_id,
                 origem1_jogo_id, origem1_tipo, origem2_jogo_id, origem2_tipo)
              VALUES
                (@etapaCategoriaId, @fase, @num, @grupo,
                 @dupla1Id, @dupla2Id,
                 @origem1JogoId, @origem1Tipo, @origem2JogoId, @origem2Tipo)`)
    .run({
      etapaCategoriaId: d.etapaCategoriaId,
      fase: d.fase,
      num: d.num ?? null,
      grupo: d.grupo ?? null,
      dupla1Id: d.dupla1Id ?? null,
      dupla2Id: d.dupla2Id ?? null,
      origem1JogoId: d.origem1JogoId ?? null,
      origem1Tipo: d.origem1Tipo ?? null,
      origem2JogoId: d.origem2JogoId ?? null,
      origem2Tipo: d.origem2Tipo ?? null,
    });
  return obter(info.lastInsertRowid);
}

// Vencedor e perdedor de um jogo, pelos placares. null se não decidido.
function vencedorPerdedor(j) {
  if (j.placar1 == null || j.placar2 == null || j.placar1 === j.placar2) return null;
  const venceu1 = j.placar1 > j.placar2;
  return {
    vencedor: venceu1 ? j.dupla1_id : j.dupla2_id,
    perdedor: venceu1 ? j.dupla2_id : j.dupla1_id,
  };
}

// propagarResultado: ao decidir um jogo, preenche as duplas dos jogos do
// mata-mata que dependem dele (via ponteiros de origem) e segue em cascata.
function propagarResultado(jogoId) {
  const db = getDb();
  const j = obter(jogoId);
  if (!j) return;
  const res = vencedorPerdedor(j);

  const dependentes = db.prepare(
    'SELECT * FROM jogo WHERE origem1_jogo_id = ? OR origem2_jogo_id = ?'
  ).all(jogoId, jogoId);

  for (const dep of dependentes) {
    let d1 = dep.dupla1_id;
    let d2 = dep.dupla2_id;
    if (dep.origem1_jogo_id === jogoId) {
      d1 = res ? (dep.origem1_tipo === 'vencedor' ? res.vencedor : res.perdedor) : null;
    }
    if (dep.origem2_jogo_id === jogoId) {
      d2 = res ? (dep.origem2_tipo === 'vencedor' ? res.vencedor : res.perdedor) : null;
    }
    if (d1 !== dep.dupla1_id || d2 !== dep.dupla2_id) {
      db.prepare('UPDATE jogo SET dupla1_id = ?, dupla2_id = ? WHERE id = ?')
        .run(d1, d2, dep.id);
      propagarResultado(dep.id); // cascata
    }
  }
}

// apurarColocacoes: recalcula a colocação final de cada dupla a partir dos
// resultados do mata-mata. 1º/2º (final), 3º/4º (disputa de 3º lugar) são
// exatos; rodadas anteriores às semis viram faixas (5º-8º, 9º-...), e quem
// não foi ao mata-mata fica na faixa logo abaixo dos classificados.
function apurarColocacoes(etapaCategoriaId) {
  const db = getDb();
  const duplas = duplaRepo.listar(etapaCategoriaId);
  const mata = listar(etapaCategoriaId).filter(j => j.fase !== 'grupo');
  const colocacao = new Map();

  if (mata.length > 0) {
    const contagem = {};
    for (const j of mata) {
      if (j.fase === 'terceiro') continue;
      contagem[j.fase] = (contagem[j.fase] || 0) + 1;
    }
    const N = 2 * Math.max(...Object.values(contagem));

    for (const j of mata) {
      const res = vencedorPerdedor(j);
      if (!res) continue;
      if (j.fase === 'final') {
        colocacao.set(res.vencedor, 1);
        colocacao.set(res.perdedor, 2);
      } else if (j.fase === 'terceiro') {
        colocacao.set(res.vencedor, 3);
        colocacao.set(res.perdedor, 4);
      } else if (j.fase !== 'semi') {
        // perdedores de rodada anterior às semis: faixa começa após os
        // que avançaram (1 vencedor por jogo da fase).
        colocacao.set(res.perdedor, contagem[j.fase] + 1);
      }
      // perdedores das semis caem na disputa de 3º lugar — tratada acima.
    }

    // Duplas que não chegaram ao mata-mata ficam na faixa N+1.
    const classificadas = new Set();
    mata.forEach(j => {
      if (j.dupla1_id) classificadas.add(j.dupla1_id);
      if (j.dupla2_id) classificadas.add(j.dupla2_id);
    });
    for (const d of duplas) {
      if (!classificadas.has(d.id) && !colocacao.has(d.id)) {
        colocacao.set(d.id, N + 1);
      }
    }
  }

  // Converte a colocação em pontos pelas faixas da categoria.
  const faixas = pontuacaoRepo.faixas(etapaCategoriaId);
  const atualizar = db.prepare(
    'UPDATE dupla SET colocacao_final = ?, pontos_ganhos = ? WHERE id = ?');
  db.transaction(() => {
    for (const d of duplas) {
      const c = colocacao.has(d.id) ? colocacao.get(d.id) : null;
      const p = c != null ? pontosDaColocacao(c, faixas) : null;
      atualizar.run(c, p, d.id);
    }
  })();
}

// registrarPlacar: grava o resultado de um jogo, propaga o vencedor/perdedor
// para os jogos seguintes do mata-mata e reapura as colocações finais.
// tipoResultado: 'normal' | 'wx0' | 'desistencia' (default 'normal').
function registrarPlacar(id, { placar1, placar2, tipoResultado }) {
  getDb()
    .prepare(`UPDATE jogo SET placar1 = ?, placar2 = ?, tipo_resultado = ?
              WHERE id = ?`)
    .run(placar1 ?? null, placar2 ?? null, tipoResultado || 'normal', id);
  const j = obter(id);
  propagarResultado(id);
  apurarColocacoes(j.etapa_categoria_id);
  return obter(id);
}

// gerarFaseGrupos: gera (todos-contra-todos) os jogos da fase de grupos a
// partir das duplas já cadastradas, numerando-os em sequência.
// opts.recriar = true apaga os jogos de grupo existentes antes de gerar.
// Sem recriar, lança erro se já houver jogos de grupo.
function gerarFaseGrupos(etapaCategoriaId, opts = {}) {
  const db = getDb();
  const existentes = db.prepare(
    `SELECT COUNT(*) AS c FROM jogo
     WHERE etapa_categoria_id = ? AND fase = 'grupo'`).get(etapaCategoriaId).c;

  if (existentes > 0 && !opts.recriar) {
    throw new Error('Os jogos da fase de grupos já foram gerados.');
  }

  const duplas = duplaRepo.listar(etapaCategoriaId);
  const confrontos = motorGrupos.gerarConfrontos(duplas);

  const apagar = db.prepare(
    `DELETE FROM jogo WHERE etapa_categoria_id = ? AND fase = 'grupo'`);
  const inserir = db.prepare(
    `INSERT INTO jogo (etapa_categoria_id, fase, num, grupo, dupla1_id, dupla2_id)
     VALUES (?, 'grupo', ?, ?, ?, ?)`);

  db.transaction(() => {
    if (opts.recriar) apagar.run(etapaCategoriaId);
    confrontos.forEach((c, idx) => {
      inserir.run(etapaCategoriaId, idx + 1, c.grupo, c.dupla1Id, c.dupla2Id);
    });
  })();

  return listar(etapaCategoriaId);
}

// gerarMataMata: monta a chave do mata-mata (eliminação simples + 3º lugar)
// a partir do ranking geral dos classificados. Os jogos da rodada 1 já nascem
// com as duplas (seeds); os demais ficam com ponteiros de origem.
// opts.recriar = true apaga o mata-mata existente antes de gerar.
function gerarMataMata(etapaCategoriaId, opts = {}) {
  const db = getDb();
  const existem = db.prepare(
    `SELECT COUNT(*) AS c FROM jogo
     WHERE etapa_categoria_id = ? AND fase <> 'grupo'`).get(etapaCategoriaId).c;
  if (existem > 0 && !opts.recriar) {
    throw new Error('O mata-mata já foi gerado.');
  }

  const ec = etapaCategoriaRepo.obter(etapaCategoriaId);
  let config = {};
  if (ec && ec.config_json) {
    try { config = JSON.parse(ec.config_json); } catch { config = {}; }
  }

  const duplas = duplaRepo.listar(etapaCategoriaId);
  const jogos = listar(etapaCategoriaId);
  const ranking = calcularRankingGeral(duplas, jogos, config).ranking;
  const chave = gerarChave(ranking.length, { cruzamentos: config.cruzamentos });

  const duplaDoSeed = {};
  ranking.forEach(r => { duplaDoSeed[r.seed] = r.id; });

  const apagar = db.prepare(
    `DELETE FROM jogo WHERE etapa_categoria_id = ? AND fase <> 'grupo'`);
  const inserir = db.prepare(
    `INSERT INTO jogo (etapa_categoria_id, fase, num, dupla1_id, dupla2_id)
     VALUES (?, ?, ?, ?, ?)`);
  const ligar = db.prepare(
    `UPDATE jogo SET origem1_jogo_id = ?, origem1_tipo = ?,
                     origem2_jogo_id = ?, origem2_tipo = ? WHERE id = ?`);

  db.transaction(() => {
    if (opts.recriar) apagar.run(etapaCategoriaId);
    const idDb = {};
    chave.partidas.forEach((p, idx) => {
      const d1 = p.slot1.seed != null ? duplaDoSeed[p.slot1.seed] : null;
      const d2 = p.slot2.seed != null ? duplaDoSeed[p.slot2.seed] : null;
      const info = inserir.run(etapaCategoriaId, p.fase, idx + 1, d1, d2);
      idDb[p.id] = info.lastInsertRowid;
    });
    chave.partidas.forEach(p => {
      const o1 = p.slot1.origem ? idDb[p.slot1.origem] : null;
      const o2 = p.slot2.origem ? idDb[p.slot2.origem] : null;
      if (o1 || o2) {
        ligar.run(o1, p.slot1.tipo || null, o2, p.slot2.tipo || null, idDb[p.id]);
      }
    });
  })();

  return listar(etapaCategoriaId);
}

function remover(id) {
  getDb().prepare('DELETE FROM jogo WHERE id = ?').run(id);
}

module.exports = {
  listar, obter, criar, registrarPlacar,
  gerarFaseGrupos, gerarMataMata, remover,
};
