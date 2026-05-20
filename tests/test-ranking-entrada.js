// Testes do motor de ranking de entrada (define a ordem das duplas que
// vai dirigir a serpentina). Rodar com:  npm test

const { calcularRankingEntrada } = require('../src/motor/ranking-entrada');

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); console.log(`  ok   ${nome}`); ok++; }
  catch (err) { console.log(`  FALHOU ${nome}\n     ${err.message}`); fail++; }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} esperado ${b}, veio ${a}`);
}

const mk = (id, a1, a2) => ({ id, codigo: `D${id}`, atleta1_id: a1, atleta2_id: a2 });

console.log('\n=== TESTES — Ranking de entrada ===\n');

t('ordena pela soma dos pontos dos atletas (maior primeiro)', () => {
  const duplas = [mk(1, 10, 11), mk(2, 20, 21), mk(3, 30, 31)];
  const r = calcularRankingEntrada(duplas, {
    pontosPorAtleta: {
      10: 200, 11: 180,  // dupla 1 = 380
      20: 300, 21: 290,  // dupla 2 = 590
      30: 50,  31: 50,   // dupla 3 = 100
    },
  });
  eq(r[0].id, 2, '1º = dupla 2');
  eq(r[1].id, 1, '2º = dupla 1');
  eq(r[2].id, 3, '3º = dupla 3');
  eq(r[0].score, 590, 'score da dupla 1');
});

t('empate em pontos: desempate pelo melhor atleta de cada dupla', () => {
  // Mesmo total. Melhor atleta da dupla 1 tem um 1º; da dupla 2, um 2º.
  const duplas = [mk(1, 10, 11), mk(2, 20, 21)];
  const r = calcularRankingEntrada(duplas, {
    pontosPorAtleta: { 10: 100, 11: 100, 20: 100, 21: 100 },
    colocacoesPorAtleta: {
      10: [1, 3], 11: [5],
      20: [2, 4], 21: [3],
    },
  });
  eq(r[0].id, 1, 'dupla com atleta que tem 1º colocação vence');
});

t('empate até no melhor atleta: desempate pelo segundo atleta', () => {
  // Melhor atleta de cada uma tem o mesmo histórico [1,3]. Segundo atleta:
  // dupla 1 tem [5], dupla 2 tem [3] -> dupla 2 vence (3 é melhor que 5).
  const duplas = [mk(1, 10, 11), mk(2, 20, 21)];
  const r = calcularRankingEntrada(duplas, {
    pontosPorAtleta: { 10: 100, 11: 100, 20: 100, 21: 100 },
    colocacoesPorAtleta: {
      10: [1, 3], 11: [5],
      20: [1, 3], 21: [3],
    },
  });
  eq(r[0].id, 2, 'dupla com 2º atleta melhor vence');
});

t('empate total: o app sorteia e marca como sorteada', () => {
  const duplas = [mk(1, 10, 11), mk(2, 20, 21), mk(3, 30, 31)];
  // random determinístico para o teste.
  const seq = [0.9, 0.1, 0.5, 0.0, 0.7];
  let i = 0;
  const r = calcularRankingEntrada(duplas,
    { random: () => seq[i++ % seq.length] });
  eq(r.length, 3);
  for (const d of r) {
    if (!d.sorteada) throw new Error('empate total deveria marcar sorteada');
  }
});

t('todas têm pos sequencial 1..N', () => {
  const duplas = [mk(1, 10, 11), mk(2, 20, 21), mk(3, 30, 31)];
  const r = calcularRankingEntrada(duplas, {
    pontosPorAtleta: { 10: 100, 20: 200, 30: 50 },
  });
  eq(r[0].pos, 1); eq(r[1].pos, 2); eq(r[2].pos, 3);
});

console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
