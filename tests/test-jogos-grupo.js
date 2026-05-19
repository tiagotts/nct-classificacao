// Testes da geração de jogos da fase de grupos.
// Rodar com:  npm test

const { gerarConfrontos, gerarDuplaEliminatoria } = require('../src/motor/jogos-grupo');
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

console.log('\n=== TESTES — Geração de jogos da fase de grupos ===\n');

// --- gerarConfrontos (função pura) -------------------------------------
t('grupo de 4 duplas gera 6 confrontos', () => {
  const duplas = [1, 2, 3, 4].map(id => ({ id, grupo: 'A' }));
  eq(gerarConfrontos(duplas).length, 6);
});

t('cada dupla de um grupo de 4 joga 3 vezes', () => {
  const duplas = [1, 2, 3, 4].map(id => ({ id, grupo: 'A' }));
  const confrontos = gerarConfrontos(duplas);
  for (const id of [1, 2, 3, 4]) {
    const n = confrontos.filter(c => c.dupla1Id === id || c.dupla2Id === id).length;
    eq(n, 3, `dupla ${id}`);
  }
});

t('grupo de 4 segue a ordem de rodadas do regulamento', () => {
  // 1x4, 2x3 | 1x3, 2x4 | 1x2, 3x4
  const duplas = [1, 2, 3, 4].map(id => ({ id, grupo: 'A' }));
  const pares = gerarConfrontos(duplas).map(c => [c.dupla1Id, c.dupla2Id]);
  eq(JSON.stringify(pares),
     JSON.stringify([[1, 4], [2, 3], [1, 3], [2, 4], [1, 2], [3, 4]]));
});

t('2 grupos de 4 geram 12 confrontos', () => {
  const duplas = [
    ...[1, 2, 3, 4].map(id => ({ id, grupo: 'A' })),
    ...[5, 6, 7, 8].map(id => ({ id, grupo: 'B' })),
  ];
  eq(gerarConfrontos(duplas).length, 12);
});

t('duplas sem grupo ficam de fora', () => {
  const duplas = [
    { id: 1, grupo: 'A' }, { id: 2, grupo: 'A' },
    { id: 3, grupo: null }, { id: 4, grupo: '' },
  ];
  eq(gerarConfrontos(duplas).length, 1);
});

// --- gerarDuplaEliminatoria (função pura) ------------------------------
t('dupla eliminatória: grupo de 4 gera 5 jogos (2 iniciais + 3 por origem)', () => {
  const duplas = [1, 2, 3, 4].map(id => ({ id, grupo: 'A' }));
  const jogos = gerarDuplaEliminatoria(duplas);
  eq(jogos.length, 5, 'nº de jogos');
  eq(jogos[0].dupla1Id, 1, 'jogo 1 dupla1'); eq(jogos[0].dupla2Id, 4, 'jogo 1 dupla2');
  eq(jogos[1].dupla1Id, 2, 'jogo 2 dupla1'); eq(jogos[1].dupla2Id, 3, 'jogo 2 dupla2');
  eq(jogos.filter(j => j.origem1).length, 3, 'jogos ligados por origem');
});

t('dupla eliminatória: grupo sem 4 duplas é rejeitado', () => {
  let lancou = false;
  try { gerarDuplaEliminatoria([1, 2, 3].map(id => ({ id, grupo: 'A' }))); }
  catch { lancou = true; }
  if (!lancou) throw new Error('deveria rejeitar grupo de 3 duplas');
});

// --- jogo.gerarFaseGrupos (com banco) ----------------------------------
abrir(':memory:');

const temp = temporada.criar({ nome: 'T', ano: 2025 });
const et = etapa.criar({ temporadaId: temp.id, nome: 'E1' });
const cat = categoria.listar().find(c => c.slug === 'sub18');
const ec = etapaCategoria.criar({
  etapaId: et.id, categoriaId: cat.id, tipo: 'masculino', numGrupos: 1 });

// 4 duplas no grupo A (8 atletas).
const atletas = [];
for (let i = 1; i <= 8; i++) atletas.push(atleta.criar({ nome: `Atleta ${i}` }));
for (let n = 1; n <= 4; n++) {
  dupla.criar({
    etapaCategoriaId: ec.id, codigo: `A${n}`, grupo: 'A',
    atleta1Id: atletas[(n - 1) * 2].id, atleta2Id: atletas[(n - 1) * 2 + 1].id,
  });
}

t('gerarFaseGrupos cria 6 jogos para um grupo de 4', () => {
  const jogos = jogo.gerarFaseGrupos(ec.id);
  const deGrupo = jogos.filter(j => j.fase === 'grupo');
  eq(deGrupo.length, 6);
});

t('jogos gerados são numerados em sequência a partir de 1', () => {
  const nums = jogo.listar(ec.id).filter(j => j.fase === 'grupo')
    .map(j => j.num).sort((a, b) => a - b);
  eq(JSON.stringify(nums), JSON.stringify([1, 2, 3, 4, 5, 6]));
});

t('gerarFaseGrupos recusa gerar de novo sem recriar', () => {
  let lancou = false;
  try { jogo.gerarFaseGrupos(ec.id); } catch { lancou = true; }
  if (!lancou) throw new Error('deveria lançar erro');
});

t('gerarFaseGrupos com recriar=true regenera sem duplicar', () => {
  const jogos = jogo.gerarFaseGrupos(ec.id, { recriar: true });
  eq(jogos.filter(j => j.fase === 'grupo').length, 6);
});

t('dupla eliminatória: gera a chave e posiciona vencedor/perdedor automaticamente', () => {
  const ecDE = etapaCategoria.criar({
    etapaId: et.id, categoriaId: cat.id, tipo: 'feminino',
    formato: 'dupla-eliminatoria', numGrupos: 1 });
  const ats = [];
  for (let i = 1; i <= 8; i++) ats.push(atleta.criar({ nome: `DE Atleta ${i}` }));
  const dups = [];
  for (let n = 1; n <= 4; n++) {
    dups.push(dupla.criar({
      etapaCategoriaId: ecDE.id, codigo: `A${n}`, grupo: 'A',
      atleta1Id: ats[(n - 1) * 2].id, atleta2Id: ats[(n - 1) * 2 + 1].id }));
  }

  let jogos = jogo.gerarFaseGrupos(ecDE.id).filter(j => j.fase === 'grupo');
  eq(jogos.length, 5, 'nº de jogos');
  eq(jogos.filter(j => j.dupla1_id && j.dupla2_id).length, 2, 'jogos iniciais');
  eq(jogos.filter(j => j.origem1_jogo_id).length, 3, 'jogos ligados por origem');

  // Jogo inicial A1 x A4: ao lançar o placar, o vencedor/perdedor deve ser
  // posicionado automaticamente nos jogos de vencedores/perdedores.
  const j1 = jogos.find(j => j.dupla1_id === dups[0].id && j.dupla2_id === dups[3].id);
  if (!j1) throw new Error('faltou o jogo inicial A1 x A4');
  jogo.registrarPlacar(j1.id, { placar1: 21, placar2: 15 });

  jogos = jogo.listar(ecDE.id);
  const jVenc = jogos.find(j =>
    j.origem1_jogo_id === j1.id && j.origem1_tipo === 'vencedor');
  eq(jVenc.dupla1_id, dups[0].id, 'vencedor posicionado no jogo dos vencedores');
  const jPerd = jogos.find(j =>
    j.origem1_jogo_id === j1.id && j.origem1_tipo === 'perdedor');
  eq(jPerd.dupla1_id, dups[3].id, 'perdedor posicionado no jogo dos perdedores');
});

t('dupla eliminatória: gerarFaseGrupos recusa grupo que não tem 4 duplas', () => {
  const et2 = etapa.criar({ temporadaId: temp.id, nome: 'E2' });
  const ec3 = etapaCategoria.criar({
    etapaId: et2.id, categoriaId: cat.id, tipo: 'masculino',
    formato: 'dupla-eliminatoria', numGrupos: 1 });
  for (let n = 1; n <= 3; n++) {
    const a1 = atleta.criar({ nome: `T3 ${n}a` });
    const a2 = atleta.criar({ nome: `T3 ${n}b` });
    dupla.criar({
      etapaCategoriaId: ec3.id, codigo: `A${n}`, grupo: 'A',
      atleta1Id: a1.id, atleta2Id: a2.id });
  }
  let lancou = false;
  try { jogo.gerarFaseGrupos(ec3.id); } catch { lancou = true; }
  if (!lancou) throw new Error('deveria recusar grupo de 3 duplas');
});

t('numeração intercala os jogos por rodada entre os grupos', () => {
  const et3 = etapa.criar({ temporadaId: temp.id, nome: 'E3' });
  const ec4 = etapaCategoria.criar({
    etapaId: et3.id, categoriaId: cat.id, tipo: 'masculino', numGrupos: 2 });
  for (const g of ['A', 'B']) {
    for (let n = 1; n <= 4; n++) {
      const a1 = atleta.criar({ nome: `Int ${g}${n}a` });
      const a2 = atleta.criar({ nome: `Int ${g}${n}b` });
      dupla.criar({
        etapaCategoriaId: ec4.id, codigo: `${g}${n}`, grupo: g,
        atleta1Id: a1.id, atleta2Id: a2.id });
    }
  }
  const jogos = jogo.gerarFaseGrupos(ec4.id).filter(j => j.fase === 'grupo');
  const numsA = jogos.filter(j => j.grupo === 'A')
    .map(j => j.num).sort((x, y) => x - y);
  // 2 grupos de 4 (6 jogos por grupo), intercalados -> grupo A = 1,3,5,7,9,11
  eq(JSON.stringify(numsA), JSON.stringify([1, 3, 5, 7, 9, 11]));
});

fechar();
console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
