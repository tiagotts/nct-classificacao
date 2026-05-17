// Testes do motor de classificação da fase de grupos.
// Rodar com:  npm test

const { calcularClassificacao } = require('../src/motor/classificacao');

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); console.log(`  ok   ${nome}`); ok++; }
  catch (err) { console.log(`  FALHOU ${nome}\n     ${err.message}`); fail++; }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} esperado ${b}, veio ${a}`);
}

// Helpers para montar o cenário.
function dupla(id, grupo) {
  return { id, codigo: `${grupo}${id}`, grupo,
           atleta1_nome: `Atleta ${id}A`, atleta2_nome: `Atleta ${id}B` };
}
function jogo(d1, d2, p1, p2, tipo = 'normal') {
  return { fase: 'grupo', dupla1_id: d1, dupla2_id: d2,
           placar1: p1, placar2: p2, tipo_resultado: tipo };
}

console.log('\n=== TESTES — Motor de classificação ===\n');

t('ordena por nº de vitórias', () => {
  const duplas = [dupla(1, 'A'), dupla(2, 'A'), dupla(3, 'A')];
  const jogos = [
    jogo(1, 2, 21, 10), // 1 vence
    jogo(1, 3, 21, 15), // 1 vence
    jogo(2, 3, 21, 18), // 2 vence
  ];
  const r = calcularClassificacao(duplas, jogos);
  const A = r.grupos.A;
  eq(A[0].id, 1, '1º');
  eq(A[1].id, 2, '2º');
  eq(A[2].id, 3, '3º');
  eq(A[0].V, 2, 'vitórias do 1º');
});

t('empate em vitórias é resolvido pelo average', () => {
  // Ciclo: todos com 1 vitória; average separa.
  const duplas = [dupla(1, 'A'), dupla(2, 'A'), dupla(3, 'A')];
  const jogos = [
    jogo(1, 2, 21, 19), // 1: +21/-19   2: +19/-21
    jogo(2, 3, 21, 10), // 2: +21/-10   3: +10/-21
    jogo(3, 1, 21, 15), // 3: +21/-15   1: +15/-21
  ];
  const r = calcularClassificacao(duplas, jogos);
  const A = r.grupos.A;
  // AVG: 2 = 40/31 ≈ 1.29 ; 1 = 36/40 = 0.90 ; 3 = 31/36 ≈ 0.86
  eq(A[0].id, 2, '1º por average');
  eq(A[1].id, 1, '2º por average');
  eq(A[2].id, 3, '3º por average');
  eq(A[1].motivo, 'Average', 'motivo do desempate');
});

t('empate em V e AVG é resolvido pelo confronto direto', () => {
  // Grupo de 4: duplas 1 e 2 terminam empatadas (2V, mesmos PP/PC).
  const duplas = [dupla(1, 'A'), dupla(2, 'A'), dupla(3, 'A'), dupla(4, 'A')];
  const jogos = [
    jogo(1, 2, 21, 10), // 1 vence 2  (confronto direto)
    jogo(1, 3, 21, 10), // 1 vence
    jogo(1, 4, 10, 21), // 1 perde
    jogo(2, 3, 21, 10), // 2 vence
    jogo(2, 4, 21, 10), // 2 vence
    jogo(3, 4, 21, 10), // 3 vence
  ];
  const r = calcularClassificacao(duplas, jogos);
  const A = r.grupos.A;
  // 1 e 2: ambos 2V, PP=52 PC=41 -> mesmo AVG. H2H: 1 venceu 2.
  eq(A[0].id, 1, '1º pelo confronto direto');
  eq(A[1].id, 2, '2º');
  eq(A[1].motivo, 'Confronto direto', 'motivo do desempate');
});

t('Wx0: vitória conta mas sem saldo de pontos', () => {
  const duplas = [dupla(1, 'A'), dupla(2, 'A')];
  const r = calcularClassificacao(duplas, [jogo(1, 2, 1, 0, 'wx0')]);
  const A = r.grupos.A;
  const venc = A.find(s => s.id === 1);
  eq(venc.V, 1, 'vitória do vencedor');
  eq(venc.PP, 0, 'sem pontos pró');
  eq(venc.PC, 0, 'sem pontos contra');
  eq(A.find(s => s.id === 2).D, 1, 'derrota do perdedor');
});

t('duplo Wx0: as duas duplas são derrotadas', () => {
  const duplas = [dupla(1, 'A'), dupla(2, 'A')];
  const r = calcularClassificacao(duplas, [jogo(1, 2, 0, 0, 'wx0')]);
  const A = r.grupos.A;
  eq(A[0].V, 0, 'sem vitórias');
  eq(A[0].D, 1, 'derrota 1');
  eq(A[1].D, 1, 'derrota 2');
});

t('desistência: o placar lançado vale normalmente', () => {
  const duplas = [dupla(1, 'A'), dupla(2, 'A')];
  const r = calcularClassificacao(duplas, [jogo(1, 2, 21, 15, 'desistencia')]);
  const venc = r.grupos.A.find(s => s.id === 1);
  eq(venc.V, 1, 'vitória');
  eq(venc.PP, 21, 'pontos pró contam');
  eq(venc.PC, 15, 'pontos contra contam');
});

t('jogo sem placar não é contabilizado', () => {
  const duplas = [dupla(1, 'A'), dupla(2, 'A')];
  const r = calcularClassificacao(duplas, [jogo(1, 2, null, null)]);
  eq(r.grupos.A[0].J, 0, 'nenhum jogo contado');
});

t('separa as duplas por grupo', () => {
  const duplas = [dupla(1, 'A'), dupla(2, 'A'), dupla(3, 'B'), dupla(4, 'B')];
  const jogos = [jogo(1, 2, 21, 10), jogo(3, 4, 21, 10)];
  const r = calcularClassificacao(duplas, jogos);
  eq(Object.keys(r.grupos).join(','), 'A,B', 'grupos');
  eq(r.grupos.A.length, 2, 'tamanho do grupo A');
});

console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
