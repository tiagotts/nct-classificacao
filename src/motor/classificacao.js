// =============================================================================
// Motor de classificação da fase de grupos.
// Função pura: recebe duplas, jogos e a configuração; devolve a classificação
// de cada grupo, já ordenada e com os critérios de desempate aplicados.
//
// Critérios suportados (regulamento NCT, item 7):
//   V       - nº de vitórias
//   AVG     - ponto average (razão PP/PC ou diferença PP-PC)
//   SP      - saldo de pontos (PP - PC)
//   H2H     - confronto direto (só resolve empates entre 2 duplas)
//   SORTEIO - sorteio (resolve qualquer empate restante)
//
// Tratamento de resultados (regulamento, itens 13 e 14):
//   wx0         - vitória conta, mas sem saldo de pontos para ninguém;
//                 placar igual (ex.: 0x0) = duplo Wx0, as duas perdem.
//   desistencia - o placar lançado vale normalmente (já é o placar final).
// =============================================================================

const CONFIG_PADRAO = {
  formulaAvg: 'razao',                       // 'razao' | 'diferenca'
  criterios: ['V', 'AVG', 'H2H', 'SORTEIO'],
};

function computeAvg(s, formula) {
  if (formula === 'diferenca') return s.PP - s.PC;
  return s.PC > 0 ? s.PP / s.PC : (s.PP > 0 ? Infinity : 0);
}

// Monta as estatísticas (J, V, D, PP, PC, AVG, SP) de cada dupla.
function buildStats(duplas, jogos, formula) {
  const stats = new Map();
  for (const d of duplas) {
    stats.set(d.id, {
      id: d.id,
      codigo: d.codigo,
      grupo: d.grupo,
      nome: `${d.atleta1_nome} / ${d.atleta2_nome}`,
      J: 0, V: 0, D: 0, PP: 0, PC: 0,
      motivo: null,
    });
  }

  for (const g of jogos) {
    const s1 = stats.get(g.dupla1_id);
    const s2 = stats.get(g.dupla2_id);
    if (!s1 || !s2) continue;
    const tipo = g.tipo_resultado || 'normal';

    if (tipo === 'wx0') {
      // Vitória sem saldo de pontos; placar igual = duplo Wx0.
      s1.J++; s2.J++;
      if (g.placar1 > g.placar2) { s1.V++; s2.D++; }
      else if (g.placar2 > g.placar1) { s2.V++; s1.D++; }
      else { s1.D++; s2.D++; }
      continue;
    }

    // normal e desistência: precisa dos dois placares.
    if (g.placar1 == null || g.placar2 == null) continue;
    s1.J++; s2.J++;
    s1.PP += g.placar1; s1.PC += g.placar2;
    s2.PP += g.placar2; s2.PC += g.placar1;
    if (g.placar1 > g.placar2) { s1.V++; s2.D++; }
    else if (g.placar2 > g.placar1) { s2.V++; s1.D++; }
  }

  for (const s of stats.values()) {
    s.SP = s.PP - s.PC;
    s.AVG = computeAvg(s, formula);
  }
  return stats;
}

// Vencedor do confronto direto entre duas duplas: 'd1', 'd2' ou null.
function headToHead(id1, id2, jogos) {
  const g = jogos.find(x =>
    (x.dupla1_id === id1 && x.dupla2_id === id2) ||
    (x.dupla1_id === id2 && x.dupla2_id === id1));
  if (!g || g.placar1 == null || g.placar2 == null) return null;
  if (g.placar1 === g.placar2) return null;
  const venceuDupla1 = g.placar1 > g.placar2;
  const vencedorId = venceuDupla1 ? g.dupla1_id : g.dupla2_id;
  return vencedorId === id1 ? 'd1' : 'd2';
}

function critCompare(a, b, crit) {
  if (crit === 'V') return b.V - a.V;
  if (crit === 'AVG') return b.AVG - a.AVG;
  if (crit === 'SP') return b.SP - a.SP;
  return 0;
}
function critEquals(a, b, crit) {
  if (crit === 'V') return a.V === b.V;
  if (crit === 'AVG') return a.AVG === b.AVG;
  if (crit === 'SP') return a.SP === b.SP;
  return true; // H2H e SORTEIO não comparam valores
}

const ROTULO = {
  V: 'Vitórias', AVG: 'Average', SP: 'Saldo de pontos',
  H2H: 'Confronto direto', SORTEIO: 'Sorteio',
};

// Ordena um bloco de duplas aplicando os critérios em ordem; empates em um
// critério são resolvidos recursivamente pelo próximo.
// prioridadeSorteio (opcional): array de ids de duplas em ordem de prioridade
// para resolver empates no critério SORTEIO. Ids ausentes vão para o final
// preservando a ordem natural (sort estável).
function resolveBlock(block, critIdx, jogos, criterios, prioridadeSorteio) {
  if (block.length <= 1 || critIdx >= criterios.length) return block;
  const crit = criterios[critIdx];

  if (crit === 'H2H') {
    if (block.length === 2) {
      const r = headToHead(block[0].id, block[1].id, jogos);
      if (r === 'd2') {
        [block[0], block[1]] = [block[1], block[0]];
        block[1].motivo = ROTULO.H2H;
        return block;
      }
      if (r === 'd1') { block[1].motivo = ROTULO.H2H; return block; }
    }
    return resolveBlock(block, critIdx + 1, jogos, criterios, prioridadeSorteio);
  }

  if (crit === 'SORTEIO') {
    if (prioridadeSorteio && prioridadeSorteio.length) {
      const peso = (id) => {
        const i = prioridadeSorteio.indexOf(id);
        return i === -1 ? Infinity : i;
      };
      block.sort((a, b) => peso(a.id) - peso(b.id));
    }
    for (let k = 1; k < block.length; k++) block[k].motivo = ROTULO.SORTEIO;
    return block;
  }

  // Critérios comparativos: V, AVG, SP.
  block.sort((a, b) => critCompare(a, b, crit));
  const saida = [];
  let i = 0;
  while (i < block.length) {
    let j = i + 1;
    while (j < block.length && critEquals(block[i], block[j], crit)) j++;
    let sub = block.slice(i, j);
    if (sub.length > 1) {
      sub = resolveBlock(sub, critIdx + 1, jogos, criterios, prioridadeSorteio);
    }
    // critIdx > 0: este bloco já era um empate; quem não é o 1º do bloco
    // foi separado do grupo anterior justamente por este critério.
    if (i > 0 && critIdx > 0 && !sub[0].motivo) sub[0].motivo = ROTULO[crit];
    saida.push(...sub);
    i = j;
  }
  return saida;
}

// Vencedor e perdedor de um jogo, pelos placares. null se não decidido.
function vencedorPerdedorJogo(g) {
  if (!g || g.placar1 == null || g.placar2 == null
      || g.placar1 === g.placar2) return null;
  const venceu1 = g.placar1 > g.placar2;
  return {
    vencedor: venceu1 ? g.dupla1_id : g.dupla2_id,
    perdedor: venceu1 ? g.dupla2_id : g.dupla1_id,
  };
}

// Ordena um grupo do formato dupla eliminatória pela chave (não por pontos):
//   1º = vencedor do jogo dos vencedores (invicto, 2V/0D)
//   2º = vencedor da repescagem (2V/1D)
//   3º = perdedor da repescagem    4º = perdedor do jogo dos perdedores
// Os 5 jogos do grupo vêm na ordem de geração (num): games[2]=vencedores,
// games[3]=perdedores, games[4]=repescagem. Posições ainda não decididas
// recebem as duplas pendentes em ordem provisória — a classificação fecha
// quando a chave acaba.
function classificarGrupoDuplaElim(statsDoGrupo, jogosDoGrupo) {
  const games = jogosDoGrupo.slice().sort((a, b) => (a.num || 0) - (b.num || 0));
  const slots = [null, null, null, null]; // ids das duplas em 1º..4º

  if (games.length === 5) {
    const venc = vencedorPerdedorJogo(games[2]); // jogo dos vencedores
    const perd = vencedorPerdedorJogo(games[3]); // jogo dos perdedores
    const rep = vencedorPerdedorJogo(games[4]);  // repescagem
    if (venc) slots[0] = venc.vencedor;
    if (rep) { slots[1] = rep.vencedor; slots[2] = rep.perdedor; }
    if (perd) slots[3] = perd.perdedor;
  }

  const statById = new Map(statsDoGrupo.map(s => [s.id, s]));
  const usados = new Set(slots.filter(id => id != null));
  const pendentes = statsDoGrupo.filter(s => !usados.has(s.id));

  const ordenado = [];
  let pi = 0;
  for (let i = 0; i < 4; i++) {
    if (slots[i] != null && statById.has(slots[i])) {
      ordenado.push(statById.get(slots[i]));
    } else if (pi < pendentes.length) {
      ordenado.push(pendentes[pi++]);
    }
  }
  while (pi < pendentes.length) ordenado.push(pendentes[pi++]);
  return ordenado;
}

/**
 * Calcula a classificação de cada grupo.
 * @param {Array} duplas - [{ id, codigo, grupo, atleta1_nome, atleta2_nome }]
 * @param {Array} jogos  - jogos da etapa_categoria (só os de fase 'grupo' contam)
 * @param {Object} config - { formulaAvg, criterios, formato } (opcional)
 * @returns {Object} { formulaAvg, criterios, formato, grupos: { 'A': [...] } }
 */
function calcularClassificacao(duplas, jogos, config = {}) {
  const cfg = {
    formulaAvg: config.formulaAvg || CONFIG_PADRAO.formulaAvg,
    criterios: (config.criterios && config.criterios.length)
      ? config.criterios : CONFIG_PADRAO.criterios,
    prioridadeSorteio: config.prioridadeSorteio || [],
  };
  const formato = config.formato || 'todos-contra-todos';

  const jogosGrupo = jogos.filter(j => (j.fase || 'grupo') === 'grupo');
  const stats = buildStats(duplas, jogosGrupo, cfg.formulaAvg);

  const porGrupo = {};
  for (const s of stats.values()) {
    if (!s.grupo) continue;
    (porGrupo[s.grupo] = porGrupo[s.grupo] || []).push(s);
  }

  const grupos = {};
  for (const g of Object.keys(porGrupo).sort()) {
    const ordenado = formato === 'dupla-eliminatoria'
      ? classificarGrupoDuplaElim(porGrupo[g], jogosGrupo.filter(j => j.grupo === g))
      : resolveBlock(porGrupo[g], 0, jogosGrupo, cfg.criterios, cfg.prioridadeSorteio);
    ordenado.forEach((s, i) => { s.posicao = i + 1; });
    grupos[g] = ordenado;
  }

  return { formulaAvg: cfg.formulaAvg, criterios: cfg.criterios, formato, grupos };
}

// Ordena uma lista de estatísticas de duplas pelos critérios informados.
// Usado pelo ranking geral para ordenar duplas de grupos diferentes
// (H2H entre duplas que não se enfrentaram simplesmente não se aplica).
function ordenarPorCriterios(stats, jogos, criterios, prioridadeSorteio) {
  const jogosGrupo = jogos.filter(j => (j.fase || 'grupo') === 'grupo');
  const crits = (criterios && criterios.length) ? criterios : CONFIG_PADRAO.criterios;
  return resolveBlock(stats.slice(), 0, jogosGrupo, crits, prioridadeSorteio || []);
}

module.exports = { calcularClassificacao, ordenarPorCriterios };
