// Testes do motor de pontuação e ranking de temporada.
// Rodar com:  npm test

const {
  FAIXAS_PADRAO, pontosDaColocacao, calcularRankingTemporada,
} = require('../src/motor/pontuacao');

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); console.log(`  ok   ${nome}`); ok++; }
  catch (err) { console.log(`  FALHOU ${nome}\n     ${err.message}`); fail++; }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} esperado ${b}, veio ${a}`);
}

console.log('\n=== TESTES — Pontuação e ranking de temporada ===\n');

// --- pontosDaColocacao --------------------------------------------------
t('1º lugar vale 200 pontos', () => eq(pontosDaColocacao(1), 200));
t('4º lugar vale 140 pontos', () => eq(pontosDaColocacao(4), 140));
t('6º lugar cai na faixa 5-8 (120 pontos)', () => eq(pontosDaColocacao(6), 120));
t('12º lugar cai na faixa 9+ (100 pontos)', () => eq(pontosDaColocacao(12), 100));
t('colocação nula não pontua', () => eq(pontosDaColocacao(null), null));

// --- calcularRankingTemporada ------------------------------------------
const nomes = { 1: 'Ana', 2: 'Bia', 3: 'Cau', 4: 'Dani' };

t('pontos da dupla vão para os dois atletas', () => {
  const r = calcularRankingTemporada(
    [{ atleta1_id: 1, atleta2_id: 2, pontos_ganhos: 200, colocacao_final: 1 }],
    nomes);
  eq(r.length, 2);
  eq(r[0].pontos, 200, 'atleta 1');
  eq(r[1].pontos, 200, 'atleta 2');
});

t('soma os pontos do atleta em várias etapas', () => {
  const r = calcularRankingTemporada([
    { atleta1_id: 1, atleta2_id: 2, pontos_ganhos: 200, colocacao_final: 1 },
    { atleta1_id: 1, atleta2_id: 3, pontos_ganhos: 160, colocacao_final: 3 },
  ], nomes);
  const ana = r.find(a => a.atletaId === 1);
  eq(ana.pontos, 360, 'pontos somados');
  eq(ana.etapas, 2, 'etapas jogadas');
});

t('resultado sem colocação apurada (pontos nulos) é ignorado', () => {
  const r = calcularRankingTemporada(
    [{ atleta1_id: 1, atleta2_id: 2, pontos_ganhos: null, colocacao_final: null }],
    nomes);
  eq(r.length, 0);
});

t('desempate por pontos iguais usa as melhores colocações', () => {
  // Ana: 200 (1º) + 100 (9º) = 300. Bia: 160 (3º) + 140 (4º) = 300.
  // Empate em pontos; Ana tem um 1º lugar, Bia não -> Ana na frente.
  const r = calcularRankingTemporada([
    { atleta1_id: 1, atleta2_id: 9, pontos_ganhos: 200, colocacao_final: 1 },
    { atleta1_id: 1, atleta2_id: 9, pontos_ganhos: 100, colocacao_final: 9 },
    { atleta1_id: 2, atleta2_id: 8, pontos_ganhos: 160, colocacao_final: 3 },
    { atleta1_id: 2, atleta2_id: 8, pontos_ganhos: 140, colocacao_final: 4 },
  ], nomes);
  const ana = r.find(a => a.atletaId === 1);
  const bia = r.find(a => a.atletaId === 2);
  eq(ana.pontos, bia.pontos, 'pontos empatados');
  if (ana.posicao >= bia.posicao) {
    throw new Error('Ana deveria ficar à frente por ter um 1º lugar');
  }
});

t('ordena por pontos (maior primeiro)', () => {
  const r = calcularRankingTemporada([
    { atleta1_id: 1, atleta2_id: 2, pontos_ganhos: 100, colocacao_final: 9 },
    { atleta1_id: 3, atleta2_id: 4, pontos_ganhos: 200, colocacao_final: 1 },
  ], nomes);
  eq(r[0].pontos, 200, '1º colocado');
  eq(r[0].posicao, 1);
});

t('faixas padrão cobrem da 1ª colocação em diante', () => {
  for (let pos = 1; pos <= 20; pos++) {
    if (pontosDaColocacao(pos, FAIXAS_PADRAO) == null) {
      throw new Error(`colocação ${pos} sem pontos`);
    }
  }
});

t('pontos iniciais aparecem mesmo sem etapa jogada', () => {
  const r = calcularRankingTemporada([], { 1: 'Ana', 2: 'Bia' }, { 1: 500, 2: 300 });
  eq(r.length, 2);
  eq(r[0].nome, 'Ana');
  eq(r[0].pontos, 500);
  eq(r[0].etapas, 0, 'etapas conta só os jogos disputados');
});

t('pontos iniciais somam com pontos das etapas', () => {
  const resultados = [
    { atleta1_id: 1, atleta2_id: 2, pontos_ganhos: 100, colocacao_final: 5 },
  ];
  const r = calcularRankingTemporada(resultados,
    { 1: 'Ana', 2: 'Bia' }, { 1: 500 });
  const ana = r.find(x => x.atletaId === 1);
  const bia = r.find(x => x.atletaId === 2);
  eq(ana.pontos, 600, 'Ana: 500 inicial + 100 da etapa');
  eq(bia.pontos, 100, 'Bia: só os 100 da etapa');
});

console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
