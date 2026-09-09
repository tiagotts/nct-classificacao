// Testes do gerador de chave dupla generalizado (N = 4, 8, 16, 32).
// Rodar com:  node tests/test-chave-dupla.js

const {
  gerarChaveDupla,
  mapearSeedsGrupoChave,
  seedPositions,
} = require('../src/motor-chave-dupla');

let ok = 0, fail = 0;
function t(nome, fn) {
  try {
    fn();
    console.log(`  ✅ ${nome}`);
    ok++;
  } catch (err) {
    console.log(`  ❌ ${nome}\n     ${err.message}`);
    fail++;
  }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} esperado ${b}, veio ${a}`);
}

// Helper: gera seeds 1..N com duplas fictícias
function seedsTeste(N) {
  return Array.from({ length: N }, (_, i) => ({
    seed: i + 1,
    dupla: { codigo: `D${i + 1}`, nome: `Dupla #${i + 1}` }
  }));
}

// Helper: simula o torneio inteiro com "seed menor sempre vence"
function simular(partidas) {
  const placado = new Map();
  function resolveSlot(slot) {
    if (slot.seed != null) return { seed: slot.seed, dupla: slot.dupla };
    const r = placado.get(slot.fromMatch);
    return slot.as === 'V' ? r.ven : r.per;
  }
  for (const p of partidas) {
    const d1 = resolveSlot(p.slot1);
    const d2 = resolveSlot(p.slot2);
    const ven = d1.seed < d2.seed ? d1 : d2;
    const per = d1.seed < d2.seed ? d2 : d1;
    placado.set(p.id, { ven, per });
  }
  return placado;
}

console.log('\n=== TESTES — Gerador de chave dupla generalizado ===\n');

// ----------------------------------------------------------------------
// Fórmula seedPositions (ordem canônica de seeds na chave)
// ----------------------------------------------------------------------
console.log('▶ seedPositions (fórmula canônica)\n');

t('N=4: [1,4,2,3]', () => {
  const p = seedPositions(4);
  eq(JSON.stringify(p), JSON.stringify([1,4,2,3]));
});
t('N=8: [1,8,4,5,2,7,3,6]', () => {
  eq(JSON.stringify(seedPositions(8)), JSON.stringify([1,8,4,5,2,7,3,6]));
});
t('N=16: posições canônicas', () => {
  const esperado = [1,16,8,9,4,13,5,12,2,15,7,10,3,14,6,11];
  eq(JSON.stringify(seedPositions(16)), JSON.stringify(esperado));
});

// ----------------------------------------------------------------------
// Tamanhos suportados
// ----------------------------------------------------------------------
console.log('\n▶ Tamanhos suportados\n');

for (const N of [4, 8, 16, 32]) {
  t(`N=${N}: total de 2N-2 = ${2*N-2} partidas (sem reset)`, () => {
    const { totalPartidas } = gerarChaveDupla(seedsTeste(N));
    eq(totalPartidas, 2*N - 2);
  });
  t(`N=${N} com bracket reset: 2N-1 = ${2*N-1} partidas`, () => {
    const { totalPartidas } = gerarChaveDupla(seedsTeste(N), { bracketReset: true });
    eq(totalPartidas, 2*N - 1);
  });
}

t('Tamanho não suportado (N=6) lança erro', () => {
  let throwed = false;
  try { gerarChaveDupla(seedsTeste(4).concat(seedsTeste(2).map(s => ({seed:s.seed+4, dupla:s.dupla})))); }
  catch { throwed = true; }
  // Como criar N=6 é meio chato; testando via array de tamanho 5:
  const arr5 = Array.from({length:5}, (_,i) => ({seed:i+1, dupla:{}}));
  try { gerarChaveDupla(arr5); throwed = false; }
  catch { throwed = true; }
  if (!throwed) throw new Error('Deveria ter lançado erro para N=5');
});

// ----------------------------------------------------------------------
// Estrutura para cada tamanho
// ----------------------------------------------------------------------
console.log('\n▶ Estrutura interna\n');

t('N=4: 3 WB + 2 LB + 1 GF', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(4));
  eq(partidas.filter(p => p.fase.startsWith('WB')).length, 3, 'WB');
  eq(partidas.filter(p => p.fase.startsWith('LB')).length, 2, 'LB');
  eq(partidas.filter(p => p.fase.startsWith('Grand')).length, 1, 'GF');
});

t('N=8: 7 WB + 6 LB + 1 GF', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(8));
  eq(partidas.filter(p => p.fase.startsWith('WB')).length, 7);
  eq(partidas.filter(p => p.fase.startsWith('LB')).length, 6);
  eq(partidas.filter(p => p.fase.startsWith('Grand')).length, 1);
});

t('N=16: 15 WB + 14 LB + 1 GF', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16));
  eq(partidas.filter(p => p.fase.startsWith('WB')).length, 15);
  eq(partidas.filter(p => p.fase.startsWith('LB')).length, 14);
  eq(partidas.filter(p => p.fase.startsWith('Grand')).length, 1);
});

t('N=32: 31 WB + 30 LB + 1 GF', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(32));
  eq(partidas.filter(p => p.fase.startsWith('WB')).length, 31);
  eq(partidas.filter(p => p.fase.startsWith('LB')).length, 30);
  eq(partidas.filter(p => p.fase.startsWith('Grand')).length, 1);
});

// ----------------------------------------------------------------------
// WB R1 com seeds nas posições corretas
// ----------------------------------------------------------------------
console.log('\n▶ Emparelhamentos da WB R1\n');

t('N=4 WB R1: (1,4) e (2,3)', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(4));
  const wbR1 = partidas.filter(p => p.fase === 'WB R1');
  const pares = wbR1.map(p => [p.slot1.seed, p.slot2.seed]);
  eq(JSON.stringify(pares), JSON.stringify([[1,4],[2,3]]));
});

t('N=8 WB R1: (1,8)(4,5)(2,7)(3,6)', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(8));
  const pares = partidas.filter(p => p.fase === 'WB R1').map(p => [p.slot1.seed, p.slot2.seed]);
  eq(JSON.stringify(pares), JSON.stringify([[1,8],[4,5],[2,7],[3,6]]));
});

t('N=16 WB R1: padrão canônico', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16));
  const pares = partidas.filter(p => p.fase === 'WB R1').map(p => [p.slot1.seed, p.slot2.seed]);
  const esperado = [[1,16],[8,9],[4,13],[5,12],[2,15],[7,10],[3,14],[6,11]];
  eq(JSON.stringify(pares), JSON.stringify(esperado));
});

t('Todos os seeds aparecem exatamente uma vez na WB R1 (N=32)', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(32));
  const todos = partidas
    .filter(p => p.fase === 'WB R1')
    .flatMap(p => [p.slot1.seed, p.slot2.seed])
    .sort((a,b) => a-b);
  for (let i = 1; i <= 32; i++) eq(todos[i-1], i, `seed ${i}`);
});

// ----------------------------------------------------------------------
// Simulação: seed 1 vence tudo → é a campeã, em qualquer tamanho
// ----------------------------------------------------------------------
console.log('\n▶ Simulação: seed 1 vence tudo\n');

for (const N of [4, 8, 16, 32]) {
  t(`N=${N}: campeã = seed 1, vice = seed ≠ 1`, () => {
    const { partidas } = gerarChaveDupla(seedsTeste(N));
    const placado = simular(partidas);
    const campeao = placado.get('GF1').ven;
    const vice = placado.get('GF1').per;
    eq(campeao.seed, 1, 'campeã');
    if (vice.seed === 1) throw new Error('vice não pode ser seed 1');
  });
}

// ----------------------------------------------------------------------
// Toda partida tem destino (exceto a final e os eliminados)
// ----------------------------------------------------------------------
console.log('\n▶ Conectividade da chave\n');

for (const N of [4, 8, 16, 32]) {
  t(`N=${N}: toda partida (exceto GF) tem proxV definido`, () => {
    const { partidas } = gerarChaveDupla(seedsTeste(N));
    partidas.forEach(p => {
      if (p.id.startsWith('GF')) return;
      if (!p.proxV) throw new Error(`${p.id} (${p.fase}) sem proxV`);
    });
  });
}

t('N=16: perdedor da WB Final cai na LB Final', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16));
  const wbFinal = partidas.find(p => p.fase === 'WB Final');
  const lbFinal = partidas.find(p => p.fase === 'LB Final');
  eq(wbFinal.proxP, lbFinal.id);
});

t('N=8: perdedor da WB Final cai na LB Final', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(8));
  const wbFinal = partidas.find(p => p.fase === 'WB Final');
  const lbFinal = partidas.find(p => p.fase === 'LB Final');
  eq(wbFinal.proxP, lbFinal.id);
});

// ----------------------------------------------------------------------
// Mapeamento grupo → seed
// ----------------------------------------------------------------------
console.log('\n▶ Mapeamento grupo → seed\n');

// Helper: cria grupos com duplas ordenadas
function montaGrupos(M, tamanho) {
  const groups = {};
  let dupId = 1;
  for (let g = 0; g < M; g++) {
    const letra = String.fromCharCode(65 + g);
    groups[letra] = [];
    for (let p = 0; p < tamanho; p++) {
      groups[letra].push({
        cod: `${letra}${p+1}`,
        nome: `Dupla ${letra}${p+1}`,
        V: tamanho - 1 - p, // 1º tem mais V
        AVG: 2.0 - p * 0.3,
        PP: 100 - p * 10,
      });
    }
  }
  return groups;
}

t('Regra "em-blocos": 4 grupos de 4 → 16 seeds (1ºs, depois 2ºs...)', () => {
  const groups = montaGrupos(4, 4);
  const seeds = mapearSeedsGrupoChave(groups, { regra: 'em-blocos', N: 16 });
  eq(seeds.length, 16);
  // Seeds 1-4 devem ser todos 1ºs colocados
  for (let i = 0; i < 4; i++) {
    if (!seeds[i].origem.startsWith('1º')) throw new Error(`Seed ${i+1} deveria ser 1º`);
  }
  // Seeds 5-8 devem ser todos 2ºs colocados
  for (let i = 4; i < 8; i++) {
    if (!seeds[i].origem.startsWith('2º')) throw new Error(`Seed ${i+1} deveria ser 2º`);
  }
  // Seeds 9-12: 3ºs
  for (let i = 8; i < 12; i++) {
    if (!seeds[i].origem.startsWith('3º')) throw new Error(`Seed ${i+1} deveria ser 3º`);
  }
  // Seeds 13-16: 4ºs
  for (let i = 12; i < 16; i++) {
    if (!seeds[i].origem.startsWith('4º')) throw new Error(`Seed ${i+1} deveria ser 4º`);
  }
});

t('Regra "em-blocos" com 2 grupos de 4 → 8 seeds: 1ºs, 2ºs, 3ºs, 4ºs', () => {
  const groups = montaGrupos(2, 4);
  const seeds = mapearSeedsGrupoChave(groups, { regra: 'em-blocos', N: 8 });
  eq(seeds.length, 8);
  eq(seeds[0].origem.startsWith('1º'), true, 'seed 1 deve ser 1º');
  eq(seeds[1].origem.startsWith('1º'), true, 'seed 2 deve ser 1º');
  eq(seeds[2].origem.startsWith('2º'), true, 'seed 3 deve ser 2º');
});

t('Regra "global": ranqueia todas as duplas independente de posição', () => {
  // Cenário: 2º do grupo A tem mais V que 1º do grupo B (grupo desbalanceado)
  const groups = {
    A: [
      {cod:'A1', V: 3, AVG: 2.0, PP: 60},
      {cod:'A2', V: 2, AVG: 1.5, PP: 50}, // alto V apesar de 2º
    ],
    B: [
      {cod:'B1', V: 1, AVG: 1.2, PP: 40}, // 1º do B mas com V menor
      {cod:'B2', V: 0, AVG: 0.5, PP: 30},
    ],
  };
  const seeds = mapearSeedsGrupoChave(groups, { regra: 'global', N: 4 });
  eq(seeds[0].dupla.cod, 'A1');
  eq(seeds[1].dupla.cod, 'A2'); // 2º do A passa na frente do 1º do B
  eq(seeds[2].dupla.cod, 'B1');
  eq(seeds[3].dupla.cod, 'B2');
});

// ----------------------------------------------------------------------
// Fluxo completo: grupos → seeds → chave dupla
// ----------------------------------------------------------------------
console.log('\n▶ Fluxo integrado\n');

t('Fluxo integrado: 4 grupos de 4 → seeds em blocos → chave dupla de 16', () => {
  const groups = montaGrupos(4, 4);
  const seeds = mapearSeedsGrupoChave(groups, { regra: 'em-blocos', N: 16 });
  // Adapta seeds para o formato esperado por gerarChaveDupla
  const seedsParaChave = seeds.map(s => ({ seed: s.seed, dupla: s.dupla }));
  const { partidas, totalPartidas } = gerarChaveDupla(seedsParaChave);
  eq(totalPartidas, 30, 'total partidas');
  // WB R1 W1: seed 1 (1º do grupo A, B, C ou D — quem tiver mais V) vs seed 16 (4º do grupo com menos pontuação)
  const w1 = partidas.find(p => p.id === 'W1');
  eq(w1.slot1.seed, 1);
  eq(w1.slot2.seed, 16);
});

// ----------------------------------------------------------------------
// Modo semi-simples: chave dupla até as semifinais, com cruzamento G×P
// nas semis (opção "cruzamento máximo": G1×P2 e G2×P1) e disputa de 3º.
// ----------------------------------------------------------------------
console.log('\n▶ Modo semi-simples\n');

// Contagem esperada em semi-simples: (N-2) + (N-4) + 4 = 2N-2 (mesma
// contagem total do clássico, mas com partidas diferentes: sem WB Final
// e sem "afunilamento" da LB até 1 finalista).
for (const N of [8, 16, 32]) {
  t(`N=${N} semi-simples: total = ${2*N-2} partidas`, () => {
    const { totalPartidas } = gerarChaveDupla(seedsTeste(N), { modo: 'semi-simples' });
    eq(totalPartidas, 2*N - 2);
  });
}

t('semi-simples não gera WB Final', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16), { modo: 'semi-simples' });
  const temFinalWB = partidas.some(p => p.fase === 'WB Final');
  eq(temFinalWB, false);
});

t('semi-simples não gera LB Final nem GF', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16), { modo: 'semi-simples' });
  eq(partidas.some(p => p.fase === 'LB Final'), false);
  eq(partidas.some(p => p.fase === 'Grand Final'), false);
});

t('semi-simples gera exatamente 2 Semis, 1 Final e 1 3º lugar', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16), { modo: 'semi-simples' });
  eq(partidas.filter(p => p.fase === 'Semi').length, 2);
  eq(partidas.filter(p => p.fase === 'Final').length, 1);
  eq(partidas.filter(p => p.fase === '3º lugar').length, 1);
});

t('semi-simples: WB Semi tem 2 partidas (2 finalistas WB)', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16), { modo: 'semi-simples' });
  const wbSemis = partidas.filter(p => p.fase === 'WB Semi');
  eq(wbSemis.length, 2);
});

t('semi-simples: cruzamento das semis é G×P (nunca G×G ou P×P)', () => {
  // Cada Semi tem slot1 vindo de WB Semi e slot2 vindo da última rodada LB.
  const { partidas } = gerarChaveDupla(seedsTeste(16), { modo: 'semi-simples' });
  const wbSemiIds = partidas.filter(p => p.fase === 'WB Semi').map(p => p.id);
  const semis = partidas.filter(p => p.fase === 'Semi');
  for (const s of semis) {
    const vemDeWB = wbSemiIds.includes(s.slot1.fromMatch);
    const outroVemDeLB = !wbSemiIds.includes(s.slot2.fromMatch);
    if (!vemDeWB || !outroVemDeLB) {
      throw new Error(`Semi ${s.id} não é cruzamento G×P: ${JSON.stringify(s)}`);
    }
  }
});

t('semi-simples: cruzamento máximo G1×P2 / G2×P1 (opção A)', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16), { modo: 'semi-simples' });
  const wbSemis = partidas.filter(p => p.fase === 'WB Semi');
  // Últimas 2 partidas da LB (finalistas)
  const lbAll = partidas.filter(p => p.fase.startsWith('LB '));
  const lbFinalistas = lbAll.slice(-2);
  const semis = partidas.filter(p => p.fase === 'Semi');
  // SF1: G1 (wbSemis[0]) × P2 (lbFinalistas[1])
  eq(semis[0].slot1.fromMatch, wbSemis[0].id, 'SF1 slot1');
  eq(semis[0].slot2.fromMatch, lbFinalistas[1].id, 'SF1 slot2 (P2)');
  // SF2: G2 (wbSemis[1]) × P1 (lbFinalistas[0])
  eq(semis[1].slot1.fromMatch, wbSemis[1].id, 'SF2 slot1');
  eq(semis[1].slot2.fromMatch, lbFinalistas[0].id, 'SF2 slot2 (P1)');
});

t('semi-simples: 3º lugar vem dos perdedores das duas semis', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16), { modo: 'semi-simples' });
  const terceiro = partidas.find(p => p.fase === '3º lugar');
  eq(terceiro.slot1.as, 'P');
  eq(terceiro.slot2.as, 'P');
  const semiIds = partidas.filter(p => p.fase === 'Semi').map(p => p.id);
  eq(semiIds.includes(terceiro.slot1.fromMatch), true);
  eq(semiIds.includes(terceiro.slot2.fromMatch), true);
});

t('semi-simples: simulação "seed 1 sempre vence" leva seed 1 à final', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(16), { modo: 'semi-simples' });
  const placado = simular(partidas);
  const fin = partidas.find(p => p.fase === 'Final');
  const r = placado.get(fin.id);
  eq(r.ven.seed, 1, 'seed 1 deve ser campeã');
});

t('semi-simples proibido para chave interna < 8', () => {
  let throwed = false;
  try { gerarChaveDupla(seedsTeste(4), { modo: 'semi-simples' }); }
  catch { throwed = true; }
  if (!throwed) throw new Error('Deveria ter lançado erro para N=4 semi-simples');
});

// ----------------------------------------------------------------------
// Passes livres (byes): N entre 17 e 31 monta chave interna de 32 e
// marca as (32-N) partidas onde a seed "fantasma" apareceria como bye.
// ----------------------------------------------------------------------
console.log('\n▶ Passes livres (17..31 duplas)\n');

t('N=20: aceita e produz chave interna de 32', () => {
  const { Nchave, N } = gerarChaveDupla(seedsTeste(20), { modo: 'semi-simples' });
  eq(Nchave, 32);
  eq(N, 20);
});

t('N=20: exatamente 12 partidas da WB R1 são bye', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(20), { modo: 'semi-simples' });
  const wbR1 = partidas.filter(p => p.fase === 'WB R1');
  eq(wbR1.length, 16, 'WB R1 tem 16 partidas na chave de 32');
  const byes = wbR1.filter(p => p.bye === true);
  eq(byes.length, 12, 'devem existir 12 partidas de bye');
});

t('N=20: as 12 seeds que passam direto são exatamente 1..12', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(20), { modo: 'semi-simples' });
  const byes = partidas.filter(p => p.fase === 'WB R1' && p.bye === true);
  const seedsQuePassam = byes.map(p => p.byeVencedor).sort((a, b) => a - b);
  const esperado = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  eq(JSON.stringify(seedsQuePassam), JSON.stringify(esperado));
});

t('N=25: 7 byes; seeds 1..7 passam direto', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(25), { modo: 'semi-simples' });
  const byes = partidas.filter(p => p.fase === 'WB R1' && p.bye === true);
  eq(byes.length, 7);
  const seedsQuePassam = byes.map(p => p.byeVencedor).sort((a, b) => a - b);
  eq(JSON.stringify(seedsQuePassam), JSON.stringify([1, 2, 3, 4, 5, 6, 7]));
});

t('N=17: apenas 1 partida real na WB R1; 15 byes', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(17), { modo: 'semi-simples' });
  const wbR1 = partidas.filter(p => p.fase === 'WB R1');
  const reais = wbR1.filter(p => !p.bye);
  eq(reais.length, 1);
  eq(wbR1.length - reais.length, 15);
});

t('N=32: zero byes (chave cheia)', () => {
  const { partidas } = gerarChaveDupla(seedsTeste(32), { modo: 'semi-simples' });
  const byes = partidas.filter(p => p.bye === true);
  eq(byes.length, 0);
});

t('N=16 (potência de 2): não é considerado bye', () => {
  const { partidas, Nchave } = gerarChaveDupla(seedsTeste(16), { modo: 'semi-simples' });
  eq(Nchave, 16);
  eq(partidas.some(p => p.bye === true), false);
});

t('N fora de 17..31 e fora de {4,8,16,32} lança erro (ex.: N=10)', () => {
  let throwed = false;
  try { gerarChaveDupla(seedsTeste(10)); }
  catch { throwed = true; }
  if (!throwed) throw new Error('Deveria ter lançado erro para N=10');
});

console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
