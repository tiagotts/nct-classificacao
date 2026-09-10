// =============================================================================
// Motor de chave dupla (double elimination) — generalizado
// -----------------------------------------------------------------------------
// Suporta N em {4, 8, 16, 32} sempre, e também qualquer N entre 17 e 31
// (nesses casos a chave interna vira 32 e as (32-N) seeds mais baixas viram
// partidas de "passa direto" na WB R1 — as N melhores seeds avançam sem
// jogar a primeira rodada).
//
// Dois modos, escolhidos por opts.modo:
//   - 'classico'    (default): chave dupla clássica com Grande Final (e opcional
//                              segunda final / rebate).
//   - 'semi-simples': a chave dos perdedores para de correr quando sobram
//                     2 finalistas da WB + 2 finalistas da LB. As semifinais
//                     são cruzadas (G1×P2 e G2×P1), seguidas de Final e
//                     disputa de 3º lugar — em eliminação simples.
//
// Estrutura de cada partida:
//   id        — identificador único (W1.., L1.., GF1, SF1/SF2, FIN, TER)
//   fase      — rótulo legível em português ("Ganhadores 1", "Perdedores 3",
//               "Semifinal", "Final", "3º lugar")
//   slot1/2   — origem da dupla:
//                 { seed: N, dupla, bye?: true }
//                 { fromMatch: 'W1', as: 'V'|'P' }
//   bye       — true se a partida inteira é um passa-direto (um dos slots
//               é bye). O consumidor deve tratar como já resolvida — o
//               vencedor é a seed real.
//   byeVencedor — a seed que passa direto (quando bye=true).
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

// Devolve o "tamanho da chave interna" a partir do número real de duplas N.
// Se N já é potência de 2 suportada, é o próprio N; senão sobe pra próxima
// potência (17..31 → 32). Só permite chave interna ∈ TAMANHOS_SUPORTADOS.
function tamanhoChaveInterna(N) {
  if (TAMANHOS_SUPORTADOS.includes(N)) return N;
  // Cobertura de 5..15 (que dariam 8 ou 16) fica proibida por enquanto —
  // só o intervalo 17..31 abre bye automático (chave de 32).
  if (N >= 17 && N <= 31) return 32;
  return null;
}

/**
 * Gera a chave dupla.
 * @param {Array}  seeds - array de { seed: 1..N, dupla: {...} }
 * @param {Object} opts  - {
 *   bracketReset?: boolean,   // só aplica em modo 'classico'
 *   modo?: 'classico' | 'semi-simples',
 * }
 * @returns {Object} { partidas, totalPartidas, N, Nchave, modo }
 */
function gerarChaveDupla(seeds, opts = {}) {
  const modo = opts.modo || 'classico';
  const bracketReset = opts.bracketReset === true && modo === 'classico';
  const N = seeds.length;

  const Nchave = tamanhoChaveInterna(N);
  if (Nchave == null) {
    throw new Error(
      `Tamanho não suportado: ${N}. Use ${TAMANHOS_SUPORTADOS.join(', ')} ` +
      `ou 17..31 (com passe direto).`
    );
  }
  if (modo === 'semi-simples' && Nchave < 8) {
    throw new Error("Modo 'semi-simples' exige chave interna >= 8.");
  }
  for (let i = 1; i <= N; i++) {
    if (!seeds.find(s => s.seed === i)) {
      throw new Error(`Seed ${i} ausente`);
    }
  }

  const k = Math.log2(Nchave);
  // A seed pode não existir (quando é bye): devolve null nesse caso.
  const duplaDe = (s) => {
    const item = seeds.find(x => x.seed === s);
    return item ? item.dupla : null;
  };
  // Uma "seed" > N é bye.
  const isBye = (s) => s > N;

  const partidas = [];
  const add = (m) => { partidas.push(m); return m; };
  const mk = (id, fase, slot1, slot2, extra = {}) => Object.assign({
    id, fase, slot1, slot2,
    proxV: null, proxP: null, proxVSlot: null, proxPSlot: null,
  }, extra);

  // ===================================================================
  // WINNERS' BRACKET
  // ===================================================================
  // WB R1 — algumas partidas podem ser "passa direto" quando um dos slots
  // é bye. O vencedor desses jogos já está definido pela seed real; ele
  // avança automaticamente para a WB R2.
  const positions = seedPositions(Nchave);
  const wbR1Ids = [];
  for (let i = 0; i < Nchave / 2; i++) {
    const sA = positions[2 * i];
    const sB = positions[2 * i + 1];
    const id = `W${i + 1}`;
    wbR1Ids.push(id);
    const slot1 = { seed: sA, dupla: duplaDe(sA), bye: isBye(sA) };
    const slot2 = { seed: sB, dupla: duplaDe(sB), bye: isBye(sB) };
    const extra = {};
    if (slot1.bye || slot2.bye) {
      extra.bye = true;
      extra.byeVencedor = slot1.bye ? sB : sA;
    }
    add(mk(id, 'Ganhadores 1', slot1, slot2, extra));
  }

  // WB R2..R(k). No modo 'semi-simples' a WB para na semi — não gera a Final.
  const wbUltimaRodada = modo === 'semi-simples' ? Math.max(k - 1, 1) : k;

  let nextWId = Nchave / 2 + 1;
  let prevWB = wbR1Ids;
  const wbRoundIdsByRound = { 1: wbR1Ids };
  for (let r = 2; r <= wbUltimaRodada; r++) {
    const numMatches = Nchave / (2 ** r);
    let fase;
    if (r === k && modo === 'classico') fase = 'Ganhadores Final';
    else if (r === k - 1) fase = 'Ganhadores Semi';
    else fase = `Ganhadores ${r}`;
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
  // No modo clássico prevWB tem 1 elemento (o campeão da WB);
  // no semi-simples tem 2 (os finalistas da WB).
  const wbFinalId = modo === 'classico' ? prevWB[0] : null;
  const wbFinalistIds = modo === 'semi-simples' ? prevWB : null;

  // ===================================================================
  // LOSERS' BRACKET
  // ===================================================================
  // Padrão alternado: rodadas ímpares são "minor" (só duplas da LB);
  // rodadas pares são "major" (LB winners + novos WB losers, cruzados).
  //
  // Modo clássico: 2(k-1) rodadas — até sobrar 1 finalista.
  // Modo semi-simples: para logo após a rodada major que consome os
  // perdedores da WB Semi — sobram 2 finalistas.
  const numLBRoundsClassico = 2 * (k - 1);
  const numLBRoundsSemi     = 2 * (k - 2); // consome até WB Semi, para em 2 finalistas
  const numLBRounds = modo === 'semi-simples' ? numLBRoundsSemi : numLBRoundsClassico;

  let nextLId = 1;
  let prevLB = [];

  for (let lbR = 1; lbR <= numLBRounds; lbR++) {
    const isMinor = lbR % 2 === 1;
    const isFinal = lbR === numLBRounds && modo === 'classico';
    const fase = isFinal ? 'Perdedores Final' : `Perdedores ${lbR}`;
    const pairings = [];

    if (lbR === 1) {
      // LB R1: pareia perdedores da WB R1.
      // Estratégia para evitar revanche na LB R2:
      //   - Nchave=4: 1 par (W1, W2)
      //   - Nchave=8: pareamento adjacente por metade
      //   - Nchave>=16: cruzado dentro de blocos de 4 — (1,4)(2,3)
      if (Nchave === 4) {
        pairings.push([
          { fromMatch: wbR1Ids[0], as: 'P' },
          { fromMatch: wbR1Ids[1], as: 'P' },
        ]);
      } else if (Nchave === 8) {
        pairings.push([{fromMatch:wbR1Ids[0], as:'P'}, {fromMatch:wbR1Ids[1], as:'P'}]);
        pairings.push([{fromMatch:wbR1Ids[2], as:'P'}, {fromMatch:wbR1Ids[3], as:'P'}]);
      } else {
        for (let block = 0; block < wbR1Ids.length; block += 4) {
          const s = wbR1Ids.slice(block, block + 4);
          pairings.push([{fromMatch:s[0], as:'P'}, {fromMatch:s[3], as:'P'}]);
          pairings.push([{fromMatch:s[1], as:'P'}, {fromMatch:s[2], as:'P'}]);
        }
      }
    } else if (isMinor) {
      // Minor: pareia vencedores da rodada major anterior, adjacentes.
      for (let i = 0; i < prevLB.length; i += 2) {
        pairings.push([
          { fromMatch: prevLB[i],     as: 'V' },
          { fromMatch: prevLB[i + 1], as: 'V' },
        ]);
      }
    } else {
      // Major: cruza LB winners com WB losers da rodada (lbR/2 + 1),
      // em ordem reversa para reduzir revanches.
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
  // Clássico: prevLB tem 1 elemento (finalista LB único);
  // Semi-simples: prevLB tem 2 (finalistas LB).
  const lbFinalId = modo === 'classico' ? prevLB[0] : null;
  const lbFinalistIds = modo === 'semi-simples' ? prevLB : null;

  // ===================================================================
  // ENCERRAMENTO
  // ===================================================================
  if (modo === 'classico') {
    add(mk('GF1', 'Grande Final',
      { fromMatch: wbFinalId, as: 'V' },
      { fromMatch: lbFinalId, as: 'V' }));

    if (bracketReset) {
      add(mk('GF2', 'Segunda Final',
        { fromMatch: 'GF1', as: 'P' }, // vindo dos ganhadores (perdeu na 1ª final)
        { fromMatch: 'GF1', as: 'V' })); // vindo dos perdedores (venceu na 1ª final)
    }
  } else {
    // Semi-simples: cruzamento máximo Ganhador × Perdedor (opção A).
    // G1 = topo dos finalistas dos ganhadores; G2 = fundo. Análogo para P1/P2.
    // Semi 1: G1 × P2. Semi 2: G2 × P1.
    // O finalista de "topo" dos perdedores é o vencedor da rodada major que
    // consumiu o perdedor da semi dos ganhadores de "topo" — daí o
    // cruzamento antipode.
    const [g1, g2] = wbFinalistIds;
    const [p1, p2] = lbFinalistIds;

    add(mk('SF1', 'Semifinal',
      { fromMatch: g1, as: 'V' },
      { fromMatch: p2, as: 'V' }));
    add(mk('SF2', 'Semifinal',
      { fromMatch: g2, as: 'V' },
      { fromMatch: p1, as: 'V' }));

    add(mk('FIN', 'Final',
      { fromMatch: 'SF1', as: 'V' },
      { fromMatch: 'SF2', as: 'V' }));
    add(mk('TER', '3º lugar',
      { fromMatch: 'SF1', as: 'P' },
      { fromMatch: 'SF2', as: 'P' }));
  }

  // ===================================================================
  // Resolve ponteiros proxV/proxP a partir das origens.
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

  return { partidas, totalPartidas: partidas.length, N, Nchave, modo };
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
    tamanhoChaveInterna,
    TAMANHOS_SUPORTADOS,
  };
}
if (typeof window !== 'undefined') {
  window.gerarChaveDupla = gerarChaveDupla;
  window.mapearSeedsGrupoChave = mapearSeedsGrupoChave;
}
