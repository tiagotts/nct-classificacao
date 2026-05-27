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
  try { gerarChave(5); } catch { lancou = true; }
  if (!lancou) throw new Error('deveria lançar erro para N=5');
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

t('tamanhoChave fixo força oitavas (16) mesmo com poucos diretos', () => {
  // Mesmo cenário: 3 grupos de 4 com 2 diretos = 6. Forçando tamanhoChave=16
  // deve trazer 10 duplas por repescagem para completar.
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
  // Só temos 12 duplas no total, então 12 é o máximo de classificados. Mas
  // tamanhoChave=16 ainda deveria pedir 10 repescados (mesmo que só haja 6
  // candidatos). O ranking final fica com 6 diretos + 6 candidatos = 12.
  const r = calcularRankingGeral(duplas, jogos,
    { classPorGrupo: 2, tamanhoChave: 16 });
  // Diretos: 6. Candidatos disponíveis: 6 (os 3ºs e 4ºs). repescados = min(10, 6)
  // (slice limita ao tamanho do array). Total = 12.
  eq(r.ranking.length, 12, 'pega todos os candidatos disponíveis ao mirar 16');
});

t('tamanhoChave fixo erra quando diretos > tamanho', () => {
  // 4 grupos × 3 diretos = 12 diretos, mas tamanhoChave = 8 -> erro claro.
  const duplas = [];
  const jogos = [];
  for (const g of ['A', 'B', 'C', 'D']) {
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
  let lancou = false;
  try {
    calcularRankingGeral(duplas, jogos, { classPorGrupo: 3, tamanhoChave: 8 });
  } catch (e) {
    lancou = /Não cabe/.test(e.message);
  }
  if (!lancou) throw new Error('deveria lançar erro de "não cabe"');
});

t('9 duplas (3 grupos de 3): 8 classificados, 1 eliminado, chave de 8', () => {
  // Formato Master 50+ do regulamento: 3 grupos de 3, todos-contra-todos.
  // 2 diretos por grupo = 6, repescagem completa para 8; o pior 3º cai fora.
  const duplas = [];
  const jogos = [];
  for (const g of ['A', 'B', 'C']) {
    const ds = [1, 2, 3].map(n => ({
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
  eq(duplas.length, 9, '9 duplas');
  const r = calcularRankingGeral(duplas, jogos, { classPorGrupo: 2 });
  eq(r.ranking.length, 8, '8 classificados (6 diretos + 2 repescagem)');
  const eliminados = duplas.filter(d => !r.ranking.find(x => x.id === d.id));
  eq(eliminados.length, 1, '1 dupla eliminada (pior 3º colocado)');

  // Cruzamento da chave de 8 = regulamento: 1×8, 4×5, 2×7, 3×6.
  const chave = gerarChave(r.ranking.length);
  eq(chave.partidas.length, 8, '8 jogos no mata-mata');
  const r1 = chave.partidas.filter(p => p.rodada === 1)
    .map(p => `${p.slot1.seed}x${p.slot2.seed}`).join(' ');
  eq(r1, '1x8 4x5 2x7 3x6', 'cruzamento das quartas');
});

t('ranking geral: 4 duplas em 1 grupo -> as 4 vão ao mata-mata', () => {
  // 1 grupo de 4, 2 diretos: a repescagem puxa o 3º e o 4º para fechar a
  // chave de 4 (antes só ia o 3º e a chave de 3 quebrava).
  const duplas = [1, 2, 3, 4].map(n => ({
    id: `A${n}`, codigo: `A${n}`, grupo: 'A',
    atleta1_nome: 'x', atleta2_nome: 'y',
  }));
  const jogos = [];
  for (let i = 0; i < duplas.length; i++) {
    for (let j = i + 1; j < duplas.length; j++) {
      jogos.push({
        fase: 'grupo', dupla1_id: duplas[i].id, dupla2_id: duplas[j].id,
        placar1: 21, placar2: 10, tipo_resultado: 'normal',
      });
    }
  }
  const r = calcularRankingGeral(duplas, jogos, { classPorGrupo: 2 });
  eq(r.ranking.length, 4, '2 diretos + 2 repescagem = chave de 4');
});

t('ranking geral em blocos: 1º de grupo nunca fica atrás de 2º', () => {
  // 2 grupos de 3. No grupo A o 2º colocado (A2) tem average altíssimo
  // (venceu o A3 por 21x1) — maior que o de qualquer 1º colocado.
  const mk = (g, n) => ({
    id: `${g}${n}`, codigo: `${g}${n}`, grupo: g,
    atleta1_nome: 'x', atleta2_nome: 'y',
  });
  const duplas = ['A', 'B'].flatMap(g => [1, 2, 3].map(n => mk(g, n)));
  const jg = (d1, d2, p1, p2) => ({
    fase: 'grupo', dupla1_id: d1, dupla2_id: d2,
    placar1: p1, placar2: p2, tipo_resultado: 'normal',
  });
  const jogos = [
    jg('A1', 'A2', 21, 19), jg('A1', 'A3', 21, 10), jg('A2', 'A3', 21, 1),
    jg('B1', 'B2', 21, 15), jg('B1', 'B3', 21, 15), jg('B2', 'B3', 21, 15),
  ];
  // Critérios só por average: sem o bloco, A2 (average maior) seria seed 1.
  const r = calcularRankingGeral(duplas, jogos,
    { classPorGrupo: 2, repescagem: 0, criterios: ['AVG', 'SORTEIO'] });
  eq(r.ranking[0].posGrupo, 1, 'seed 1 é 1º de grupo');
  eq(r.ranking[1].posGrupo, 1, 'seed 2 é 1º de grupo');
  eq(r.ranking[2].posGrupo, 2, 'seed 3 é 2º de grupo');
  eq(r.ranking[3].posGrupo, 2, 'seed 4 é 2º de grupo');
});

// --- ranking geral + gerarMataMata (com banco) -------------------------
abrir(':memory:');

const temp = temporada.criar({ nome: 'T', ano: 2025 });
const et = etapa.criar({ temporadaId: temp.id, nome: 'E1' });
const cat = categoria.listar().find(c => c.slug === 'sub18');
const ec = etapaCategoria.criar({
  etapaId: et.id, categoriaId: cat.id, tipo: 'masculino', numGrupos: 2 });

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

t('chave de 6: 6 jogos, com bye das seeds 1 e 2 à semifinal', () => {
  const c = gerarChave(6);
  eq(c.partidas.length, 6, 'nº de partidas');
  const fases = c.partidas.map(p => p.fase);
  eq(fases.filter(f => f === 'quartas').length, 2, 'quartas');
  eq(fases.filter(f => f === 'semi').length, 2, 'semis');
  eq(fases.filter(f => f === 'final').length, 1, 'final');
  eq(fases.filter(f => f === 'terceiro').length, 1, 'terceiro');
  const semisComBye = c.partidas.filter(p =>
    p.fase === 'semi' && (p.slot1.seed === 1 || p.slot1.seed === 2));
  eq(semisComBye.length, 2, 'as duas semis recebem uma seed com bye');
});

t('ranking geral independente: 2º de grupo pode passar à frente de um 1º', () => {
  const mk = (g, n) => ({
    id: `${g}${n}`, codigo: `${g}${n}`, grupo: g,
    atleta1_nome: 'x', atleta2_nome: 'y',
  });
  const ds = ['A', 'B'].flatMap(g => [1, 2, 3].map(n => mk(g, n)));
  const jg = (d1, d2, p1, p2) => ({
    fase: 'grupo', dupla1_id: d1, dupla2_id: d2,
    placar1: p1, placar2: p2, tipo_resultado: 'normal',
  });
  // Grupo A com averages altos; grupo B com averages baixos.
  const js = [
    jg('A1', 'A2', 21, 19), jg('A1', 'A3', 21, 5), jg('A2', 'A3', 21, 5),
    jg('B1', 'B2', 21, 19), jg('B1', 'B3', 21, 19), jg('B2', 'B3', 21, 19),
  ];
  const cfg = {
    classPorGrupo: 2, repescagem: 0, criterios: ['AVG', 'SORTEIO'],
  };
  const indep = calcularRankingGeral(ds, js,
    { ...cfg, rankingGeral: 'independente' });
  // Por average: A1, A2, B1, B2 -> o 2º de A (seed 2) fica à frente do 1º de B.
  eq(indep.ranking[1].id, 'A2', 'seed 2 é A2 (2º colocado de grupo)');
  eq(indep.ranking[1].posGrupo, 2, 'A2 é 2º colocado');
  eq(indep.ranking[2].id, 'B1', 'seed 3 é B1 (1º de grupo, atrás de um 2º)');

  // Em blocos, o 1º de B vem antes de qualquer 2º colocado.
  const blocos = calcularRankingGeral(ds, js, { ...cfg, rankingGeral: 'blocos' });
  eq(blocos.ranking[1].posGrupo, 1, 'em blocos, seed 2 ainda é 1º de grupo');
});

t('mata-mata com bye: 2 grupos classificando 3 -> chave de 6 jogos', () => {
  const et2 = etapa.criar({ temporadaId: temp.id, nome: 'E-bye' });
  const ec2 = etapaCategoria.criar({
    etapaId: et2.id, categoriaId: cat.id, tipo: 'feminino', numGrupos: 2,
    configJson: JSON.stringify({ classPorGrupo: 3, repescagem: 0 }),
  });
  const dups = [];
  ['A', 'B'].forEach(g => {
    for (let n = 1; n <= 4; n++) {
      const a1 = atleta.criar({ nome: `Bye ${g}${n}a` });
      const a2 = atleta.criar({ nome: `Bye ${g}${n}b` });
      dups.push(dupla.criar({
        etapaCategoriaId: ec2.id, codigo: `${g}${n}`, grupo: g,
        atleta1Id: a1.id, atleta2Id: a2.id }));
    }
  });
  jogo.gerarFaseGrupos(ec2.id);
  for (const j of jogo.listar(ec2.id).filter(x => x.fase === 'grupo')) {
    const ordem = id => dups.findIndex(d => d.id === id);
    const venceu1 = ordem(j.dupla1_id) < ordem(j.dupla2_id);
    jogo.registrarPlacar(j.id, {
      placar1: venceu1 ? 21 : 15, placar2: venceu1 ? 15 : 21 });
  }

  const mata = jogo.gerarMataMata(ec2.id).filter(j => j.fase !== 'grupo');
  eq(mata.length, 6, 'chave de 6 jogos');
  eq(mata.filter(j => j.fase === 'quartas').length, 2, 'quartas');
  eq(mata.filter(j => j.fase === 'semi').length, 2, 'semis');
  for (const s of mata.filter(j => j.fase === 'semi')) {
    if (!s.dupla1_id) throw new Error('semi sem o campeão de grupo (bye)');
  }

  // Joga a chave até o fim e confere as colocações.
  jogo.listar(ec2.id).filter(j => j.fase === 'quartas')
    .forEach(j => jogo.registrarPlacar(j.id, { placar1: 21, placar2: 15 }));
  jogo.listar(ec2.id).filter(j => j.fase === 'semi')
    .forEach(j => jogo.registrarPlacar(j.id, { placar1: 21, placar2: 15 }));
  const fin = jogo.listar(ec2.id).find(j => j.fase === 'final');
  const ter = jogo.listar(ec2.id).find(j => j.fase === 'terceiro');
  jogo.registrarPlacar(fin.id, { placar1: 21, placar2: 18 });
  jogo.registrarPlacar(ter.id, { placar1: 21, placar2: 18 });
  const colocs = dupla.listar(ec2.id).map(d => d.colocacao_final)
    .filter(c => c != null).sort((a, b) => a - b);
  // 1, 2 (final), 3, 4 (3º lugar), e 5 para quartas/não classificadas.
  eq(JSON.stringify(colocs), JSON.stringify([1, 2, 3, 4, 5, 5, 5, 5]),
    'colocações da chave com bye');
});

fechar();
console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
