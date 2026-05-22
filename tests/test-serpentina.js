// Testes da distribuição em serpentina (motor src/motor/serpentina.js).
// Rodar com:  npm test

const { distribuirEmGrupos } = require('../src/motor/serpentina');

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); console.log(`  ok   ${nome}`); ok++; }
  catch (err) { console.log(`  FALHOU ${nome}\n     ${err.message}`); fail++; }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} esperado ${b}, veio ${a}`);
}

// Devolve { grupo: [ranks...] } a partir do resultado da serpentina.
function ranksPorGrupo(res) {
  const m = {};
  res.forEach((d, i) => { (m[d.grupo] = m[d.grupo] || []).push(i + 1); });
  return m;
}

console.log('\n=== TESTES — Distribuição em serpentina ===\n');

t('16 duplas em 4 grupos: serpentina pura, 4 por grupo', () => {
  const r = distribuirEmGrupos(16, 4);
  eq(r.length, 16);
  const g = ranksPorGrupo(r);
  eq(JSON.stringify(g.A), JSON.stringify([1, 8, 9, 16]), 'grupo A');
  eq(JSON.stringify(g.B), JSON.stringify([2, 7, 10, 15]), 'grupo B');
  eq(JSON.stringify(g.C), JSON.stringify([3, 6, 11, 14]), 'grupo C');
  eq(JSON.stringify(g.D), JSON.stringify([4, 5, 12, 13]), 'grupo D');
});

t('16 duplas: o último do ranking cai no grupo do primeiro (sem inversão extra)', () => {
  const r = distribuirEmGrupos(16, 4);
  eq(r[0].grupo, 'A', '1º colocado');
  eq(r[15].grupo, 'A', '16º colocado');
});

t('9 duplas em 3 grupos: 3 por grupo', () => {
  const r = distribuirEmGrupos(9, 3);
  eq(r.length, 9);
  const g = ranksPorGrupo(r);
  eq(JSON.stringify(g.A), JSON.stringify([1, 6, 9]), 'grupo A');
  eq(JSON.stringify(g.B), JSON.stringify([2, 5, 8]), 'grupo B');
  eq(JSON.stringify(g.C), JSON.stringify([3, 4, 7]), 'grupo C');
});

t('9 duplas: nº ímpar de grupos força a última linha invertida (9º no grupo A)', () => {
  const r = distribuirEmGrupos(9, 3);
  eq(r[0].grupo, 'A', '1º colocado');
  eq(r[8].grupo, 'A', '9º colocado fica no grupo do 1º');
});

t('12 duplas em 4 grupos: serpentina pura (nº par de grupos)', () => {
  const r = distribuirEmGrupos(12, 4);
  const g = ranksPorGrupo(r);
  eq(JSON.stringify(g.A), JSON.stringify([1, 8, 9]), 'grupo A');
  eq(JSON.stringify(g.D), JSON.stringify([4, 5, 12]), 'grupo D');
  // Com grupos pares NÃO se força a última linha: o 12º fica no grupo D.
  eq(r[11].grupo, 'D', '12º colocado');
});

t('os códigos são sequenciais dentro de cada grupo', () => {
  const r = distribuirEmGrupos(16, 4);
  const g = {};
  for (const d of r) {
    g[d.grupo] = (g[d.grupo] || 0) + 1;
    eq(d.codigo, `${d.grupo}${g[d.grupo]}`, 'código');
  }
});

console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
