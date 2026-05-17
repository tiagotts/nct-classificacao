// Testes dos repositórios de CRUD (Fase 2).
// Rodar com:  npm test   (ou ELECTRON_RUN_AS_NODE=1 electron tests/test-repositorios.js)

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

console.log('\n=== TESTES — Repositórios de CRUD ===\n');

abrir(':memory:');

// --- temporada ---------------------------------------------------------
let temp;
t('temporada: criar e obter', () => {
  temp = temporada.criar({ nome: 'Circuito NCT', ano: 2025 });
  eq(temp.nome, 'Circuito NCT');
  eq(temp.ano, 2025);
  eq(temporada.obter(temp.id).id, temp.id);
});
t('temporada: atualizar', () => {
  const at = temporada.atualizar(temp.id, { nome: 'Circuito NCT 2025', ano: 2025 });
  eq(at.nome, 'Circuito NCT 2025');
});
t('temporada: listar', () => {
  eq(temporada.listar().length, 1);
});

// --- etapa -------------------------------------------------------------
let et;
t('etapa: criar vinculada à temporada', () => {
  et = etapa.criar({ temporadaId: temp.id, nome: '4ª Etapa', data: '2025-08-01', local: 'Arena 61' });
  eq(et.nome, '4ª Etapa');
  eq(et.temporada_id, temp.id);
});
t('etapa: listar por temporada', () => {
  eq(etapa.listar(temp.id).length, 1);
});

// --- categoria (catálogo fixo) -----------------------------------------
let catSub17;
t('categoria: catálogo fixo tem 4 categorias', () => {
  eq(categoria.listar().length, 4);
  catSub17 = categoria.listar().find(c => c.slug === 'sub17');
  if (!catSub17) throw new Error('categoria sub17 não encontrada');
});

// --- etapa_categoria ---------------------------------------------------
let ec;
t('etapaCategoria: criar e trazer nome da categoria no join', () => {
  ec = etapaCategoria.criar({ etapaId: et.id, categoriaId: catSub17.id, numGrupos: 3 });
  eq(ec.categoria_nome, 'Sub 17');
  eq(ec.num_grupos, 3);
});
t('etapaCategoria: listar por etapa', () => {
  eq(etapaCategoria.listar(et.id).length, 1);
});

// --- atleta ------------------------------------------------------------
let a1, a2, a3, a4;
t('atleta: criar', () => {
  a1 = atleta.criar({ nome: 'João Silva' });
  a2 = atleta.criar({ nome: 'Pedro Souza' });
  a3 = atleta.criar({ nome: 'Carlos Lima' });
  a4 = atleta.criar({ nome: 'Marcos Dias' });
  eq(atleta.listar().length, 4);
});
t('atleta: buscar por termo', () => {
  const r = atleta.buscar('Silva');
  eq(r.length, 1);
  eq(r[0].nome, 'João Silva');
});

// --- dupla -------------------------------------------------------------
let d1, d2;
t('dupla: criar e trazer nomes dos atletas no join', () => {
  d1 = dupla.criar({ etapaCategoriaId: ec.id, codigo: 'A1', grupo: 'A',
                     atleta1Id: a1.id, atleta2Id: a2.id });
  d2 = dupla.criar({ etapaCategoriaId: ec.id, codigo: 'A2', grupo: 'A',
                     atleta1Id: a3.id, atleta2Id: a4.id });
  eq(d1.atleta1_nome, 'João Silva');
  eq(d1.atleta2_nome, 'Pedro Souza');
});
t('dupla: listar por etapa_categoria', () => {
  eq(dupla.listar(ec.id).length, 2);
});
t('dupla: código duplicado na mesma etapa_categoria é rejeitado', () => {
  let lancou = false;
  try {
    dupla.criar({ etapaCategoriaId: ec.id, codigo: 'A1', grupo: 'A',
                  atleta1Id: a1.id, atleta2Id: a3.id });
  } catch { lancou = true; }
  if (!lancou) throw new Error('deveria rejeitar codigo duplicado');
});

// --- jogo --------------------------------------------------------------
let j;
t('jogo: criar jogo de grupo', () => {
  j = jogo.criar({ etapaCategoriaId: ec.id, fase: 'grupo', num: 1, grupo: 'A',
                   dupla1Id: d1.id, dupla2Id: d2.id });
  eq(j.fase, 'grupo');
  eq(j.tipo_resultado, 'normal');
});
t('jogo: registrar placar', () => {
  const jp = jogo.registrarPlacar(j.id, { placar1: 21, placar2: 15 });
  eq(jp.placar1, 21);
  eq(jp.placar2, 15);
});
t('jogo: registrar resultado Wx0', () => {
  const jp = jogo.registrarPlacar(j.id, { placar1: null, placar2: null, tipoResultado: 'wx0' });
  eq(jp.tipo_resultado, 'wx0');
});
t('jogo: criar jogo de mata-mata com ponteiros de origem', () => {
  const jm = jogo.criar({ etapaCategoriaId: ec.id, fase: 'semi', num: 5,
                          origem1JogoId: j.id, origem1Tipo: 'vencedor',
                          origem2JogoId: j.id, origem2Tipo: 'perdedor' });
  eq(jm.origem1_tipo, 'vencedor');
  eq(jm.origem2_tipo, 'perdedor');
  eq(jm.dupla1_id, null);
});
t('jogo: listar por etapa_categoria', () => {
  eq(jogo.listar(ec.id).length, 2);
});

// --- remoção -----------------------------------------------------------
t('remover: dupla some da listagem', () => {
  const novaDupla = dupla.criar({ etapaCategoriaId: ec.id, codigo: 'B1', grupo: 'B',
                                  atleta1Id: a1.id, atleta2Id: a4.id });
  const antes = dupla.listar(ec.id).length;
  dupla.remover(novaDupla.id);
  eq(dupla.listar(ec.id).length, antes - 1);
});

fechar();
console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
