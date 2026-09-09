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
const { gerarChaveDupla } = require('../../motor-chave-dupla');
const rankingEntradaRepo = require('./ranking-entrada');

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

// Ordem das rodadas do mata-mata (a disputa de 3º lugar fica fora).
const ORDEM_FASE_MATA = ['oitavas', 'quartas', 'semi', 'final'];

// apurarColocacoes: recalcula a colocação final de cada dupla a partir dos
// resultados do mata-mata. 1º/2º (final), 3º/4º (disputa de 3º lugar) são
// exatos; rodadas anteriores às semis viram faixas (5º-8º, 9º-...), e quem
// não foi ao mata-mata fica na faixa logo abaixo dos classificados.
function apurarColocacoes(etapaCategoriaId) {
  const db = getDb();
  const ec = etapaCategoriaRepo.obter(etapaCategoriaId);
  const duplas = duplaRepo.listar(etapaCategoriaId);
  const mata = listar(etapaCategoriaId).filter(j => j.fase !== 'grupo');
  const colocacao = new Map();

  const ehChaveDuplaDireta = ec && ec.formato === 'chave-dupla-direta';

  if (mata.length > 0 && ehChaveDuplaDireta) {
    // Chave dupla direta (modo semi-simples): as fases 'Final' e '3º lugar'
    // definem 1º-4º com precisão; os perdedores das 'Semi' são justamente
    // quem foi para o 3º lugar (não geram colocação extra). Para as
    // rodadas anteriores (WB R*/LB R*), quem perde cai em faixas: a
    // colocação é 2 * (nº de duplas vivas depois dessa rodada) + 1.
    // Aproximação: usar a ordem inversa em que a partida aparece nas
    // fases posteriores. O número de duplas que se classificam adiante
    // é a soma de partidas ainda por jogar depois daquela.
    const N = duplas.length;
    // Contagem por fase para as rodadas eliminatórias (não semi/final/3º).
    const fasesOrdem = ['WB R1', 'WB R2', 'WB R3', 'WB Semi',
                        'LB R1', 'LB R2', 'LB R3', 'LB R4', 'LB R5', 'LB R6'];

    for (const j of mata) {
      const res = vencedorPerdedor(j);
      if (!res) continue;
      if (j.fase === 'Final') {
        colocacao.set(res.vencedor, 1);
        colocacao.set(res.perdedor, 2);
      } else if (j.fase === '3º lugar') {
        colocacao.set(res.vencedor, 3);
        colocacao.set(res.perdedor, 4);
      }
      // Perdedores de WB/LB e das Semis ficam em faixas — atribuídas abaixo.
    }
    // Quem foi eliminado antes das semis: agrupa por fase e distribui em
    // faixa (5º-8º, 9º-16º...) — a colocação inicial de cada faixa é
    // determinada pelo número de duplas que sobraram após aquela fase.
    // Para simplificar: quem sai da LB Final tem faixa 5-6, da penúltima
    // rodada 7-8, e assim por diante. Aqui atribuo faixas conservadoras
    // baseadas em quantas partidas ainda restam.
    const perdedoresPorFase = {};
    for (const j of mata) {
      if (['Final', '3º lugar', 'Semi'].includes(j.fase)) continue;
      const res = vencedorPerdedor(j);
      if (!res) continue;
      (perdedoresPorFase[j.fase] = perdedoresPorFase[j.fase] || [])
        .push(res.perdedor);
    }
    // Faixa começa após 4 (os 4 semifinalistas já estão colocados).
    let faixaAtual = 5;
    // Fases mais tardias eliminam menos duplas — quem perdeu na última LB
    // fica na faixa mais alta (5-6).
    const fasesPresentes = fasesOrdem
      .filter(f => perdedoresPorFase[f])
      .reverse();
    for (const f of fasesPresentes) {
      const perdedores = perdedoresPorFase[f];
      for (const p of perdedores) {
        if (!colocacao.has(p)) colocacao.set(p, faixaAtual);
      }
      faixaAtual += perdedores.length;
    }

    // Duplas que não foram para o mata-mata (não deveria ter, mas por
    // segurança): faixa final.
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
  } else if (mata.length > 0) {
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
        // perdedor de uma rodada anterior à semi: a posição começa logo
        // após todos os que avançaram à rodada seguinte. Usa o nº de duplas
        // da rodada seguinte (2 x nº de jogos), o que vale também para
        // chaves com bye, em que os jogos não dobram a cada rodada.
        const prox = ORDEM_FASE_MATA[ORDEM_FASE_MATA.indexOf(j.fase) + 1];
        colocacao.set(res.perdedor, 2 * (contagem[prox] || 0) + 1);
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
// sets: jogo de múltiplos sets — array [[p1,p2], ...]. Quando informado,
// placar1/placar2 passam a guardar os sets vencidos por cada dupla.
function registrarPlacar(id, { placar1, placar2, tipoResultado, sets }) {
  const db = getDb();
  if (Array.isArray(sets)) {
    let s1 = 0, s2 = 0;
    for (const [a, b] of sets) {
      if (a > b) s1++;
      else if (b > a) s2++;
    }
    db.prepare(`UPDATE jogo SET placar1 = ?, placar2 = ?,
                tipo_resultado = 'normal', sets = ? WHERE id = ?`)
      .run(s1, s2, JSON.stringify(sets), id);
  } else {
    db.prepare(`UPDATE jogo SET placar1 = ?, placar2 = ?, tipo_resultado = ?,
                sets = NULL WHERE id = ?`)
      .run(placar1 ?? null, placar2 ?? null, tipoResultado || 'normal', id);
  }
  const j = obter(id);
  propagarResultado(id);
  apurarColocacoes(j.etapa_categoria_id);
  return obter(id);
}

// gerarFaseGrupos: gera os jogos da fase de grupos a partir das duplas já
// cadastradas, numerando-os em sequência. O formato da etapa_categoria
// decide o esquema de jogos:
//   - 'todos-contra-todos': round-robin dentro de cada grupo.
//   - 'dupla-eliminatoria': dupla eliminatória dentro de cada grupo de 4,
//     com os jogos seguintes ligados por ponteiros de origem (o vencedor/
//     perdedor é posicionado automaticamente quando o placar é lançado).
// opts.recriar = true apaga os jogos de grupo existentes antes de gerar.
// Sem recriar, lança erro se já houver jogos de grupo.
function gerarFaseGrupos(etapaCategoriaId, opts = {}) {
  const db = getDb();
  const ec = etapaCategoriaRepo.obter(etapaCategoriaId);
  const formato = (ec && ec.formato) || 'todos-contra-todos';

  const existentes = db.prepare(
    `SELECT COUNT(*) AS c FROM jogo
     WHERE etapa_categoria_id = ? AND fase = 'grupo'`).get(etapaCategoriaId).c;

  if (existentes > 0 && !opts.recriar) {
    throw new Error('Os jogos da fase de grupos já foram gerados.');
  }

  const duplas = duplaRepo.listar(etapaCategoriaId);

  // Monta a lista de jogos conforme o formato. Feito fora da transação para
  // que uma validação que falhe (ex: grupo sem 4 duplas na dupla
  // eliminatória) não chegue a apagar os jogos existentes.
  // especs: [{ grupo, ordem, dupla1Id?, dupla2Id?, origem1?, origem2? }]
  // ordem = índice do jogo dentro do seu grupo.
  let especs;
  if (formato === 'dupla-eliminatoria') {
    especs = motorGrupos.gerarDuplaEliminatoria(duplas);
  } else {
    const contador = {};
    especs = motorGrupos.gerarConfrontos(duplas).map((c) => {
      const ordem = (contador[c.grupo] = (contador[c.grupo] ?? -1) + 1);
      return { grupo: c.grupo, ordem, dupla1Id: c.dupla1Id, dupla2Id: c.dupla2Id };
    });
  }

  // Numera os jogos intercalando por rodada: o 1º jogo de cada grupo, depois
  // o 2º de cada grupo, e assim por diante. É a ordem real de disputa e a
  // mesma numeração das planilhas do circuito.
  especs.sort((a, b) => a.ordem - b.ordem || a.grupo.localeCompare(b.grupo));

  const apagar = db.prepare(
    `DELETE FROM jogo WHERE etapa_categoria_id = ? AND fase = 'grupo'`);
  const inserir = db.prepare(
    `INSERT INTO jogo (etapa_categoria_id, fase, num, grupo, dupla1_id, dupla2_id)
     VALUES (?, 'grupo', ?, ?, ?, ?)`);
  const ligar = db.prepare(
    `UPDATE jogo SET origem1_jogo_id = ?, origem1_tipo = ?,
                     origem2_jogo_id = ?, origem2_tipo = ? WHERE id = ?`);

  db.transaction(() => {
    if (opts.recriar) apagar.run(etapaCategoriaId);
    // 1ª passada: insere os jogos e guarda o id de cada um por grupo+ordem.
    const idPorChave = {};
    especs.forEach((e, idx) => {
      const info = inserir.run(etapaCategoriaId, idx + 1, e.grupo,
        e.dupla1Id ?? null, e.dupla2Id ?? null);
      idPorChave[`${e.grupo}|${e.ordem}`] = info.lastInsertRowid;
    });
    // 2ª passada: liga os jogos que dependem de vencedor/perdedor de outros.
    for (const e of especs) {
      if (!e.origem1) continue;
      ligar.run(
        idPorChave[`${e.grupo}|${e.origem1.ordem}`], e.origem1.tipo,
        idPorChave[`${e.grupo}|${e.origem2.ordem}`], e.origem2.tipo,
        idPorChave[`${e.grupo}|${e.ordem}`]);
    }
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
  // O formato decide como a classificação dos grupos é apurada.
  if (ec) config.formato = ec.formato;

  const duplas = duplaRepo.listar(etapaCategoriaId);
  const jogos = listar(etapaCategoriaId);
  const ranking = calcularRankingGeral(duplas, jogos, config).ranking;

  // 6 classificados de 2 grupos = chave com bye: o 1º de cada grupo entra
  // direto na semifinal; 2º e 3º jogam as quartas cruzando os grupos.
  const grupos = [...new Set(ranking.map(r => r.grupoOrigem))].sort();
  const chaveComBye = ranking.length === 6 && grupos.length === 2;
  const chave = gerarChave(ranking.length,
    chaveComBye ? {} : { cruzamentos: config.cruzamentos });

  const duplaDoSeed = {};
  if (chaveComBye) {
    const [gA, gB] = grupos;
    const idDe = (g, pos) => {
      const r = ranking.find(x => x.grupoOrigem === g && x.posGrupo === pos);
      return r ? r.id : null;
    };
    // seeds 1-2: campeões de grupo (bye à semi); 3-6: 2º e 3º nas quartas,
    // cruzando os grupos (quartas R1J1 = 2A x 3B; R1J2 = 2B x 3A).
    duplaDoSeed[1] = idDe(gB, 1);
    duplaDoSeed[2] = idDe(gA, 1);
    duplaDoSeed[3] = idDe(gA, 2);
    duplaDoSeed[6] = idDe(gB, 3);
    duplaDoSeed[4] = idDe(gB, 2);
    duplaDoSeed[5] = idDe(gA, 3);
  } else {
    ranking.forEach(r => { duplaDoSeed[r.seed] = r.id; });
  }

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

// gerarChaveDuplaDireta: monta a chave dupla eliminação direta (sem fase de
// grupos) no modo semi-simples. Aceita N em {8, 16, 32} e também 17..31
// (com passe direto para as (32-N) melhores seeds). A ordem das duplas vem
// de `origem_ranking` da etapa_categoria:
//   - 'temporada' (padrão): usa rankingEntrada, que ranqueia as duplas pelo
//     histórico da temporada (etapas anteriores) para essa categoria+tipo.
//   - 'manual': espera opts.ordemDuplaIds — array de dupla_id na ordem em
//     que devem receber as seeds 1..N.
// opts.recriar = true apaga os jogos existentes de mata-mata antes de gerar.
function gerarChaveDuplaDireta(etapaCategoriaId, opts = {}) {
  const db = getDb();
  const ec = etapaCategoriaRepo.obter(etapaCategoriaId);
  if (!ec) throw new Error('Categoria da etapa não encontrada.');
  if (ec.formato !== 'chave-dupla-direta') {
    throw new Error(
      "Esta categoria não está configurada como 'chave-dupla-direta'.");
  }

  const existem = db.prepare(
    `SELECT COUNT(*) AS c FROM jogo
     WHERE etapa_categoria_id = ? AND fase <> 'grupo'`).get(etapaCategoriaId).c;
  if (existem > 0 && !opts.recriar) {
    throw new Error('A chave já foi gerada.');
  }

  const duplas = duplaRepo.listar(etapaCategoriaId);
  const N = duplas.length;
  if (N < 8 || N > 32) {
    throw new Error(
      `Chave dupla direta exige entre 8 e 32 duplas (você tem ${N}).`);
  }

  // Descobre a ordem das seeds (dupla_id na ordem 1..N).
  const origem = ec.origem_ranking || 'temporada';
  let ordemDuplaIds;
  if (origem === 'manual') {
    ordemDuplaIds = Array.isArray(opts.ordemDuplaIds) ? opts.ordemDuplaIds : [];
    if (ordemDuplaIds.length !== N) {
      throw new Error(
        `Ordem manual deve ter exatamente ${N} ids (recebeu ${ordemDuplaIds.length}).`);
    }
    const idsExistentes = new Set(duplas.map(d => d.id));
    for (const id of ordemDuplaIds) {
      if (!idsExistentes.has(id)) {
        throw new Error(`Dupla ${id} da ordem manual não pertence à categoria.`);
      }
    }
  } else {
    const rankingEntrada = rankingEntradaRepo.calcular(etapaCategoriaId);
    ordemDuplaIds = rankingEntrada.map(r => r.id);
  }

  // seeds pro motor: { seed, dupla: { id } }. O motor só usa dupla como
  // referência opaca (não lê campos internos).
  const duplaPorId = new Map(duplas.map(d => [d.id, d]));
  const seeds = ordemDuplaIds.map((id, i) => ({
    seed: i + 1,
    dupla: duplaPorId.get(id),
  }));

  const chave = gerarChaveDupla(seeds, { modo: 'semi-simples' });

  // Mapa: id-da-partida-no-motor -> { duplaVencedora, isBye }
  // Byes são pré-resolvidos: a seed que passa direto é a vencedora.
  const resolucaoBye = new Map();
  for (const p of chave.partidas) {
    if (p.bye) {
      const dupla = seeds.find(s => s.seed === p.byeVencedor).dupla;
      resolucaoBye.set(p.id, dupla);
    }
  }

  // Traduz um slot do motor em ({ duplaId, origemJogoId, origemTipo }).
  // Se a origem é uma partida de bye, resolve imediatamente para o dupla_id
  // da seed vencedora (não cria dependência no banco).
  function resolveSlot(slot, idDbPorPartida) {
    if (slot.bye) {
      return { duplaId: null, origemJogoId: null, origemTipo: null };
    }
    if (slot.seed != null) {
      const s = seeds.find(x => x.seed === slot.seed);
      return { duplaId: s ? s.dupla.id : null,
               origemJogoId: null, origemTipo: null };
    }
    // slot com fromMatch: pode vir de uma partida de bye (já resolvida).
    if (resolucaoBye.has(slot.fromMatch) && slot.as === 'V') {
      return { duplaId: resolucaoBye.get(slot.fromMatch).id,
               origemJogoId: null, origemTipo: null };
    }
    // Origem "normal": vira ponteiro pro jogo correspondente no banco.
    return {
      duplaId: null,
      origemJogoId: idDbPorPartida[slot.fromMatch] || null,
      origemTipo: slot.as === 'V' ? 'vencedor' : 'perdedor',
    };
  }

  const apagar = db.prepare(
    `DELETE FROM jogo WHERE etapa_categoria_id = ? AND fase <> 'grupo'`);
  const inserir = db.prepare(
    `INSERT INTO jogo (etapa_categoria_id, fase, num, dupla1_id, dupla2_id)
     VALUES (?, ?, ?, ?, ?)`);
  const ligar = db.prepare(
    `UPDATE jogo SET origem1_jogo_id = ?, origem1_tipo = ?,
                     origem2_jogo_id = ?, origem2_tipo = ? WHERE id = ?`);

  // Só cria no banco partidas que NÃO são bye (as de bye ficam invisíveis
  // — o efeito delas é fazer a seed real aparecer direto na próxima rodada).
  const partidasReais = chave.partidas.filter(p => !p.bye);

  db.transaction(() => {
    if (opts.recriar) apagar.run(etapaCategoriaId);

    // 1ª passada: cria os jogos reais e guarda o mapeamento.
    const idDbPorPartida = {};
    partidasReais.forEach((p, idx) => {
      const info = inserir.run(etapaCategoriaId, p.fase, idx + 1, null, null);
      idDbPorPartida[p.id] = info.lastInsertRowid;
    });

    // 2ª passada: preenche duplas / ponteiros de origem.
    for (const p of partidasReais) {
      const r1 = resolveSlot(p.slot1, idDbPorPartida);
      const r2 = resolveSlot(p.slot2, idDbPorPartida);
      db.prepare('UPDATE jogo SET dupla1_id = ?, dupla2_id = ? WHERE id = ?')
        .run(r1.duplaId, r2.duplaId, idDbPorPartida[p.id]);
      if (r1.origemJogoId || r2.origemJogoId) {
        ligar.run(
          r1.origemJogoId, r1.origemTipo,
          r2.origemJogoId, r2.origemTipo,
          idDbPorPartida[p.id]);
      }
    }
  })();

  return listar(etapaCategoriaId);
}

function remover(id) {
  getDb().prepare('DELETE FROM jogo WHERE id = ?').run(id);
}

// reordenarGrupo: renumera os jogos da fase de grupos conforme a ordem dos
// ids informada (idsNaOrdem[0] vira num 1, e assim por diante). Usado pela
// tela de jogos quando o usuário muda a ordem dos jogos manualmente.
function reordenarGrupo(etapaCategoriaId, idsNaOrdem) {
  const db = getDb();
  const atualizar = db.prepare(
    `UPDATE jogo SET num = ?
     WHERE id = ? AND etapa_categoria_id = ? AND fase = 'grupo'`);
  db.transaction(() => {
    (idsNaOrdem || []).forEach((id, i) => {
      atualizar.run(i + 1, id, etapaCategoriaId);
    });
  })();
  return listar(etapaCategoriaId);
}

module.exports = {
  listar, obter, criar, registrarPlacar,
  gerarFaseGrupos, gerarMataMata, gerarChaveDuplaDireta,
  remover, reordenarGrupo,
};
