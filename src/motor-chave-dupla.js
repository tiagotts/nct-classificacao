// =============================================================================
// Motor de chave dupla (double elimination) — generalizado
// -----------------------------------------------------------------------------
// Suporta N ∈ {4, 8, 16, 32} duplas classificadas para o mata-mata.
//
// Estrutura (para N=2^k duplas):
//   - Winners' Bracket (WB): k rodadas, N-1 partidas
//   - Losers'  Bracket (LB): 2(k-1) rodadas, N-2 partidas
//   - Grand Final (GF): 1 partida (2 com bracket reset)
//   - Total: 2N-2 partidas (2N-1 com reset)
//
// Cada partida carrega:
//   id        — identificador único (W1.., L1.., GF1, GF2)
//   fase      — rótulo legível ("WB R1", "LB R3"...)
//   slot1/2   — origem da dupla: { seed: N } ou { fromMatch: 'W1', as: 'V'|'P' }
//   proxV     — id da partida para onde o vencedor vai (null = campeão)
//   proxP     — id da partida para onde o perdedor vai (null = eliminado)
//   proxVSlot, proxPSlot — 1 ou 2
// =============================================================================

const TAMANHOS_SUPORTADOS = [4, 8, 16, 32];

/**
 * Calcula a ordem dos seeds em uma chave de eliminatória.
 * Fórmula canônica: para N=4 → [1,4,2,3], N=8 → [1,8,4,5,2,7,3,6], etc.
 */
function seedPositions(n) {
  if (n === 1) return [1];
  const half = seedPositions(n / 2);
  const result = [];
  for (const s of half) {
    result.push(s);
    result.push(n + 1 - s);
  }
  return result;
}

/**
 * Gera a chave dupla.
 * @param {Array} seeds - array de { seed: 1..N, dupla: {...} }
 * @param {Object} opts - { bracketReset?: boolean }
 * @returns {Object} { partidas, totalPartidas, N }
 */
function gerarChaveDupla(seeds, opts = {}) {
  const bracketReset = opts.bracketReset === true;
  const N = seeds.length;

  if (!TAMANHOS_SUPORTADOS.includes(N)) {
    throw new Error(`Tamanho não suportado: ${N}. Use ${TAMANHOS_SUPORTADOS.join(', ')}.`);
  }
  for (let i = 1; i <= N; i++) {
    if (!seeds.find(s => s.seed === i)) {
      throw new Error(`Seed ${i} ausente`);
    }
  }

  const k = Math.log2(N);
  const dupla = (s) => seeds.find(x => x.seed === s).dupla;

  const partidas = [];
  const add = (m) => { partidas.push(m); return m; };
  const mk = (id, fase, slot1, slot2) => ({
    id, fase, slot1, slot2,
    proxV: null, proxP: null, proxVSlot: null, proxPSlot: null
  });

  // ===================================================================
  // WINNERS' BRACKET
  // ===================================================================
  // WB R1
  const positions = seedPositions(N);
  const wbR1Ids = [];
  for (let i = 0; i < N / 2; i++) {
    const sA = positions[2 * i];
    const sB = positions[2 * i + 1];
    const id = `W${i + 1}`;
    wbR1Ids.push(id);
    add(mk(id, 'WB R1',
      { seed: sA, dupla: dupla(sA) },
      { seed: sB, dupla: dupla(sB) }));
  }

  // WB R2..R(k)
  let nextWId = N / 2 + 1;
  let prevWB = wbR1Ids;
  const wbRoundIdsByRound = { 1: wbR1Ids };
  for (let r = 2; r <= k; r++) {
    const numMatches = N / (2 ** r);
    const fase = r === k ? 'WB Final' : (r === k - 1 ? 'WB Semi' : `WB R${r}`);
    const curr = [];
    for (let i = 0; i < numMatches; i++) {
      const id = `W${nextWId++}`;
      curr.push(id);
      add(mk(id, fase,
        { fromMatch: prevWB[2 * i],     as: 'V' },
        { fromMatch: prevWB[2 * i + 1], as: 'V' }));
    }
    wbRoundIdsByRound[r] = curr;
    prevWB = curr;
  }
  const wbFinalId = prevWB[0];

  // ===================================================================
  // LOSERS' BRACKET
  // ===================================================================
  // Padrão alternado: rodadas ímpares são "minor" (só duplas da LB);
  // rodadas pares são "major" (LB winners + novos WB losers, cruzados).
  const numLBRounds = 2 * (k - 1);
  let nextLId = 1;
  let prevLB = [];

  for (let lbR = 1; lbR <= numLBRounds; lbR++) {
    const isMinor = lbR % 2 === 1;
    const isFinal = lbR === numLBRounds;
    const fase = isFinal ? 'LB Final' : `LB R${lbR}`;
    const pairings = [];

    if (lbR === 1) {
      // LB R1: pareia perdedores da WB R1.
      // Estratégia para evitar revanche na LB R2:
      //   - Para N=4: 1 par (W1, W2)
      //   - Para N=8: pareamento adjacente (W1+W2)(W3+W4) — top half / bottom half
      //   - Para N>=16: pareamento cruzado dentro de blocos de 4 — (W1,W4)(W2,W3)...
      if (N === 4) {
        pairings.push([
          { fromMatch: wbR1Ids[0], as: 'P' },
          { fromMatch: wbR1Ids[1], as: 'P' },
        ]);
      } else if (N === 8) {
        // Adjacente dentro de cada metade da chave
        pairings.push([{fromMatch:wbR1Ids[0], as:'P'}, {fromMatch:wbR1Ids[1], as:'P'}]);
        pairings.push([{fromMatch:wbR1Ids[2], as:'P'}, {fromMatch:wbR1Ids[3], as:'P'}]);
      } else {
        // N >= 16: blocos de 4, cruzado (1,4)(2,3)
        for (let block = 0; block < wbR1Ids.length; block += 4) {
          const s = wbR1Ids.slice(block, block + 4);
          pairings.push([{fromMatch:s[0], as:'P'}, {fromMatch:s[3], as:'P'}]);
          pairings.push([{fromMatch:s[1], as:'P'}, {fromMatch:s[2], as:'P'}]);
        }
      }
    } else if (isMinor) {
      // Rodada menor interna: pareia vencedores da rodada major anterior, adjacentes.
      for (let i = 0; i < prevLB.length; i += 2) {
        pairings.push([
          { fromMatch: prevLB[i],     as: 'V' },
          { fromMatch: prevLB[i + 1], as: 'V' },
        ]);
      }
    } else {
      // Rodada major: pareia LB winners com WB losers da rodada (lbR/2 + 1).
      // Cruzamento reverso: ven(LB[i]) com per(WB[N-1-i]) para reduzir revanches.
      const wbRoundNum = lbR / 2 + 1;
      const wbLosers = wbRoundIdsByRound[wbRoundNum];
      for (let i = 0; i < prevLB.length; i++) {
        pairings.push([
          { fromMatch: prevLB[i], as: 'V' },
          { fromMatch: wbLosers[wbLosers.length - 1 - i], as: 'P' },
        ]);
      }
    }

    const currIds = [];
    for (const pair of pairings) {
      const id = `L${nextLId++}`;
      currIds.push(id);
      add(mk(id, fase, pair[0], pair[1]));
    }
    prevLB = currIds;
  }
  const lbFinalId = prevLB[0];

  // ===================================================================
  // GRAND FINAL
  // ===================================================================
  add(mk('GF1', 'Grand Final',
    { fromMatch: wbFinalId, as: 'V' },
    { fromMatch: lbFinalId, as: 'V' }));

  if (bracketReset) {
    add(mk('GF2', 'Bracket Reset',
      { fromMatch: 'GF1', as: 'P' }, // WB-1 (perdeu na GF1)
      { fromMatch: 'GF1', as: 'V' })); // LB-1 (venceu na GF1)
  }

  // ===================================================================
  // Resolve ponteiros proxV/proxP a partir das origens
  // ===================================================================
  const byId = new Map(partidas.map(p => [p.id, p]));
  for (const p of partidas) {
    for (const slotName of ['slot1', 'slot2']) {
      const slot = p[slotName];
      if (slot.fromMatch) {
        const origem = byId.get(slot.fromMatch);
        if (!origem) throw new Error(`Origem ${slot.fromMatch} não encontrada (em ${p.id})`);
        const slotIdx = slotName === 'slot1' ? 1 : 2;
        if (slot.as === 'V') {
          origem.proxV = p.id;
          origem.proxVSlot = slotIdx;
        } else if (slot.as === 'P') {
          origem.proxP = p.id;
          origem.proxPSlot = slotIdx;
        }
      }
    }
  }

  return { partidas, totalPartidas: partidas.length, N };
}

// =============================================================================
// REGRA DE SEED — mapeamento posição-no-grupo → seed da chave
// =============================================================================
//
// Recebe:
//   - groups: { 'A': [dupla1ª, dupla2ª, ...], 'B': [...], ... }
//     (cada dupla deve ter ao menos { cod, nome, V, AVG, ... })
//   - opts: { regra: 'em-blocos' | 'global' | 'manual', N?: number }
//
// Devolve: array de { seed: 1..N, dupla, origem: string }

/**
 * Estratégia "em-blocos":
 * Seeds 1..M = 1ºs dos M grupos (ordenados entre si por V → AVG → ...).
 * Seeds M+1..2M = 2ºs, etc., até preencher N.
 */
function seedsEmBlocos(groups, N, comparador) {
  const groupKeys = Object.keys(groups).sort();
  const M = groupKeys.length;
  if (M === 0) throw new Error('Nenhum grupo informado');

  const seeds = [];
  let seedNum = 1;
  // Maior posição a coletar de cada grupo
  const maxPos = Math.ceil(N / M);

  for (let pos = 0; pos < maxPos; pos++) {
    // Coleta dupla na posição "pos" de cada grupo (se existir)
    const bloco = [];
    for (const g of groupKeys) {
      const lista = groups[g];
      if (lista[pos]) bloco.push({ dupla: lista[pos], grupo: g, posNoGrupo: pos + 1 });
    }
    // Ordena bloco pelos critérios (mais forte primeiro)
    bloco.sort((a, b) => comparador(a.dupla, b.dupla));
    for (const item of bloco) {
      if (seedNum > N) break;
      seeds.push({
        seed: seedNum++,
        dupla: item.dupla,
        origem: `${item.posNoGrupo}º do grupo ${item.grupo}`,
      });
    }
    if (seedNum > N) break;
  }
  return seeds;
}

/**
 * Estratégia "global":
 * Junta todas as duplas dos grupos e ordena pelos critérios.
 * As N primeiras viram seeds 1..N.
 */
function seedsGlobal(groups, N, comparador) {
  const todas = [];
  for (const g of Object.keys(groups)) {
    groups[g].forEach((dupla, idx) => todas.push({ dupla, grupo: g, posNoGrupo: idx + 1 }));
  }
  todas.sort((a, b) => comparador(a.dupla, b.dupla));
  return todas.slice(0, N).map((item, i) => ({
    seed: i + 1,
    dupla: item.dupla,
    origem: `${item.posNoGrupo}º do grupo ${item.grupo}`,
  }));
}

/**
 * Comparador padrão: maior V primeiro, depois maior AVG, depois maior PP.
 * Pode ser substituído pelo motor da fase de grupos.
 */
function comparadorPadrao(a, b) {
  if (b.V !== a.V) return b.V - a.V;
  if (b.AVG !== a.AVG) return b.AVG - a.AVG;
  return (b.PP || 0) - (a.PP || 0);
}

/**
 * Função pública para mapear grupos → seeds.
 */
function mapearSeedsGrupoChave(groups, opts = {}) {
  const regra = opts.regra || 'em-blocos';
  const N = opts.N || 16;
  const comparador = opts.comparador || comparadorPadrao;

  switch (regra) {
    case 'em-blocos': return seedsEmBlocos(groups, N, comparador);
    case 'global':    return seedsGlobal(groups, N, comparador);
    case 'manual':
      throw new Error('Regra "manual" deve ser preenchida na UI; chame gerarChaveDupla diretamente com os seeds.');
    default:
      throw new Error(`Regra desconhecida: ${regra}`);
  }
}

// =============================================================================
// Exports
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    gerarChaveDupla,
    gerarChaveDupla16: (seeds, opts) => gerarChaveDupla(seeds, opts), // compat
    mapearSeedsGrupoChave,
    seedPositions,
    TAMANHOS_SUPORTADOS,
  };
}
if (typeof window !== 'undefined') {
  window.gerarChaveDupla = gerarChaveDupla;
  window.mapearSeedsGrupoChave = mapearSeedsGrupoChave;
}
