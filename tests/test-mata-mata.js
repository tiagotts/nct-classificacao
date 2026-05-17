// Testes do ranking geral e do gerador de chave do mata-mata.
// Rodar com:  npm test

const { gerarChave, seedPositions } = require('../src/motor/chave');
const { calcularRankingGeral } = require('../src/motor/ranking-geral');
const { abrir, fechar } = require('../src/db/database');
const temporada = require('../src/db/repositorios/temporada');
const etapa = require('../src/db/repositorios/etapa');
const etapaCategoria = require('../src/db/repositorios/etapa-categoria');
const categoria = require('../src/db/repositorios/categoria');
const atleta = require('../src/db/repositorios/atleta');
const dupla = require('../src/db/repositorios/dupla');
const jogo = require('../src/db/repositorios/jogo');

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); console.log(`  ok   ${nome}`); ok++; }
  catch (err) { console.log(`  FALHOU ${nome}\n     ${err.message}`); fail++; }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} esperado ${b}, veio ${a}`);
}

console.log('\n=== TESTES — Ranking geral e chave do mata-mata ===\n');

// --- chave (função pura) -----------------------------------------------
t('seedPositions N=8 = [1,8,4,5,2,7,3,6]', () => {
  eq(JSON.stringify(seedPositions(8)), JSON.stringify([1, 8, 4, 5, 2, 7, 3, 6]));
});

t('chave de 8: 8 jogos (4 quartas + 2 semis + final + 3º lugar)', () => {
  const { partidas } = gerarChave(8);
  eq(partidas.length, 8);
  eq(partidas.filter(p => p.fase === 'quartas').length, 4, 'quartas');
  eq(partidas.filter(p => p.fase === 'semi').length, 2, 'semis');
  eq(partidas.filter(p => p.fase === 'final').length, 1, 'final');
  eq(partidas.filter(p => p.fase === 'terceiro').length, 1, '3º lugar');
});

t('chave de 8: cruzamentos padrão da rodada 1', () => {
  const { partidas } = gerarChave(8);
  const r1 = partidas.filter(p => p.rodada === 1)
    .map(p => [p.slot1.seed, p.slot2.seed]);
  eq(JSON.stringify(r1), JSON.stringify([[1, 8], [4, 5], [2, 7], [3, 6]]));
});

t('chave de 8: usa cruzamentos informados', () => {
  const { partidas } = gerarChave(8, { cruzamentos: [[1, 8], [2, 7], [3, 6], [4, 5]] });
  const r1 = partidas.filter(p => p.rodada === 1)
    .map(p => [p.slot1.seed, p.slot2.seed]);
  eq(JSON.stringify(r1), JSON.stringify([[1, 8], [2, 7], [3, 6], [4, 5]]));
});

t('chave de 4: 4 jogos (2 semis + final + 3º lugar)', () => {
  const { partidas } = gerarChave(4);
  eq(partidas.length, 4);
  eq(partidas.filter(p => p.fase === 'semi').length, 2);
  eq(partidas.filter(p => p.fase === 'final').length, 1);
  eq(partidas.filter(p => p.fase === 'terceiro').length, 1);
});

t('chave de 16: 16 jogos', () => {
  eq(gerarChave(16).partidas.length, 16);
});

t('tamanho não suportado lança erro', () => {
  let lancou = false;
  try { gerarChave(6); } catch { lancou = true; }
  if (!lancou) throw new Error('deveria lançar erro para N=6');
});

t('3º lugar vem dos perdedores das semifinais', () => {
  const { partidas } = gerarChave(8);
  const semis = partidas.filter(p => p.fase === 'semi');
  const terceiro = partidas.find(p => p.fase === 'terceiro');
  eq(terceiro.slot1.tipo, 'perdedor');
  eq(terceiro.slot2.tipo, 'perdedor');
  eq(terceiro.slot1.origem, semis[0].id);
  eq(terceiro.slot2.origem, semis[1].id);
});

t('final recebe os vencedores das semifinais', () => {
  const { partidas } = gerarChave(8);
  const semis = partidas.filter(p => p.fase === 'semi');
  const final = partidas.find(p => p.fase === 'final');
  eq(final.slot1.tipo, 'vencedor');
  eq(final.slot1.origem, semis[0].id);
  eq(final.slot2.origem, semis[1].id);
});

t('ranking geral completa a repescagem automaticamente (3 grupos -> 8)', () => {
  // 3 grupos de 4: 2 diretos por grupo = 6; deve completar para 8.
  const duplas = [];
  const jogos = [];
  for (const g of ['A', 'B', 'C']) {
    const ds = [1, 2, 3, 4].map(n => ({
      id: `${g}${n}`, codigo: `${g}${n}`, grupo: g,
      atleta1_nome: 'x', atleta2_nome: 'y',
    }));
    duplas.push(...ds);
    for (let i = 0; i < ds.length; i++) {
      for (let j = i + 1; j < ds.length; j++) {
        jogos.push({
          fase: 'grupo', dupla1_id: ds[i].id, dupla2_id: ds[j].id,
          placar1: 21, placar2: 10, tipo_resultado: 'normal',
        });
      }
    }
  }
  const r = calcularRankingGeral(duplas, jogos, { classPorGrupo: 2 });
  eq(r.ranking.length, 8, 'classificados com repescagem automática');
});

// --- ranking geral + gerarMataMata (com banco) -------------------------
abrir(':memory:');

const temp = temporada.criar({ nome: 'T', ano: 2025 });
const et = etapa.criar({ temporadaId: temp.id, nome: 'E1' });
const sub17 = categoria.listar().find(c => c.slug === 'sub17');
const ec = etapaCategoria.criar({ etapaId: et.id, categoriaId: sub17.id, numGrupos: 2 });

// 2 grupos de 4 duplas (16 atletas).
const atletas = [];
for (let i = 1; i <= 16; i++) atletas.push(atleta.criar({ nome: `Atleta ${i}` }));
const duplas = [];
['A', 'B'].forEach((g, gi) => {
  for (let n = 1; n <= 4; n++) {
    const base = gi * 8 + (n - 1) * 2;
    duplas.push(dupla.criar({
      etapaCategoriaId: ec.id, codigo: `${g}${n}`, grupo: g,
      atleta1Id: atletas[base].id, atleta2Id: atletas[base + 1].id,
    }));
  }
});

// Gera e lança os jogos de grupo (placares decrescentes: A1>A2>A3>A4 etc.).
jogo.gerarFaseGrupos(ec.id);
for (const j of jogo.listar(ec.id).filter(x => x.fase === 'grupo')) {
  const ordem = id => duplas.findIndex(d => d.id === id);
  const venceu1 = ordem(j.dupla1_id) < ordem(j.dupla2_id);
  jogo.registrarPlacar(j.id, {
    placar1: venceu1 ? 21 : 15, placar2: venceu1 ? 15 : 21,
  });
}

t('ranking geral: 2 grupos, 2 por grupo -> 4 classificados com seeds 1..4', () => {
  const r = calcularRankingGeral(
    dupla.listar(ec.id), jogo.listar(ec.id), { classPorGrupo: 2, repescagem: 0 });
  eq(r.ranking.length, 4);
  eq(JSON.stringify(r.ranking.map(x => x.seed)), JSON.stringify([1, 2, 3, 4]));
});

t('gerarMataMata cria 4 jogos de mata-mata (chave de 4)', () => {
  const todos = jogo.gerarMataMata(ec.id);
  eq(todos.filter(j => j.fase !== 'grupo').length, 4);
});

t('jogos da rodada 1 do mata-mata já nascem com as duplas', () => {
  const semis = jogo.listar(ec.id).filter(j => j.fase === 'semi');
  eq(semis.length, 2);
  for (const s of semis) {
    if (!s.dupla1_id || !s.dupla2_id) throw new Error('semi sem duplas definidas');
  }
});

t('final e 3º lugar nascem com ponteiros de origem (duplas a definir)', () => {
  const final = jogo.listar(ec.id).find(j => j.fase === 'final');
  eq(final.dupla1_id, null);
  if (!final.origem1_jogo_id) throw new Error('final sem ponteiro de origem');
  eq(final.origem1_tipo, 'vencedor');
});

t('gerarMataMata recusa gerar de novo sem recriar', () => {
  let lancou = false;
  try { jogo.gerarMataMata(ec.id); } catch { lancou = true; }
  if (!lancou) throw new Error('deveria lançar erro');
});

t('propagação: resultado das semis preenche a final e o 3º lugar', () => {
  const semis = jogo.listar(ec.id).filter(j => j.fase === 'semi');
  jogo.registrarPlacar(semis[0].id, { placar1: 21, placar2: 15 });
  jogo.registrarPlacar(semis[1].id, { placar1: 15, placar2: 21 });
  const final = jogo.listar(ec.id).find(j => j.fase === 'final');
  const terceiro = jogo.listar(ec.id).find(j => j.fase === 'terceiro');
  if (!final.dupla1_id || !final.dupla2_id) throw new Error('final não foi preenchida');
  if (!terceiro.dupla1_id || !terceiro.dupla2_id) {
    throw new Error('disputa de 3º lugar não foi preenchida');
  }
});

t('apuração: colocações 1 a 4 são gravadas ao fechar final e 3º lugar', () => {
  const final = jogo.listar(ec.id).find(j => j.fase === 'final');
  const terceiro = jogo.listar(ec.id).find(j => j.fase === 'terceiro');
  jogo.registrarPlacar(final.id, { placar1: 21, placar2: 18 });
  jogo.registrarPlacar(terceiro.id, { placar1: 21, placar2: 12 });
  const colocs = dupla.listar(ec.id)
    .map(d => d.colocacao_final)
    .filter(c => c != null)
    .sort((a, b) => a - b);
  for (const pos of [1, 2, 3, 4]) {
    if (!colocs.includes(pos)) {
      throw new Error(`faltou a colocação ${pos}: ${colocs.join(',')}`);
    }
  }
});

t('apuração: duplas não classificadas ficam na faixa N+1', () => {
  // 8 duplas, 4 classificadas (chave de 4) -> não classificadas na faixa 5.
  const naoClassificadas = dupla.listar(ec.id).filter(d => d.colocacao_final === 5);
  eq(naoClassificadas.length, 4, 'duplas fora do mata-mata');
});

fechar();
console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
