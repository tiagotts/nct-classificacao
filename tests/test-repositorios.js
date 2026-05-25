// Testes dos repositórios de CRUD (Fase 2).
// Rodar com:  npm test   (ou ELECTRON_RUN_AS_NODE=1 electron tests/test-repositorios.js)

const { abrir, fechar, getDb } = require('../src/db/database');
const temporada = require('../src/db/repositorios/temporada');
const etapa = require('../src/db/repositorios/etapa');
const etapaCategoria = require('../src/db/repositorios/etapa-categoria');
const categoria = require('../src/db/repositorios/categoria');
const atleta = require('../src/db/repositorios/atleta');
const dupla = require('../src/db/repositorios/dupla');
const jogo = require('../src/db/repositorios/jogo');
const pontuacao = require('../src/db/repositorios/pontuacao');

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
  et = etapa.criar({ temporadaId: temp.id, nome: '4ª Etapa',
    dataInicio: '2025-08-01', local: 'Arena 61' });
  eq(et.nome, '4ª Etapa');
  eq(et.temporada_id, temp.id);
});
t('etapa: listar por temporada', () => {
  eq(etapa.listar(temp.id).length, 1);
});

// --- categoria (catálogo fixo) -----------------------------------------
let categoriaTeste;
t('categoria: catálogo fixo tem 6 categorias', () => {
  eq(categoria.listar().length, 6);
  categoriaTeste = categoria.listar().find(c => c.slug === 'sub18');
  if (!categoriaTeste) throw new Error('categoria sub18 não encontrada');
});

// --- etapa_categoria ---------------------------------------------------
let ec;
t('etapaCategoria: criar e trazer nome da categoria no join', () => {
  ec = etapaCategoria.criar({
    etapaId: et.id, categoriaId: categoriaTeste.id, tipo: 'masculino', numGrupos: 3 });
  eq(ec.categoria_nome, 'Sub 18');
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
t('jogo: registrar placar por sets (melhor de 3)', () => {
  const jp = jogo.registrarPlacar(j.id, { sets: [[21, 18], [19, 21], [15, 12]] });
  eq(jp.placar1, 2, 'sets vencidos pela dupla 1');
  eq(jp.placar2, 1, 'sets vencidos pela dupla 2');
  eq(JSON.parse(jp.sets).length, 3, 'placar de cada set gravado');
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

// --- pontuação ---------------------------------------------------------
t('pontuacao: sem faixas cadastradas usa o padrão', () => {
  const f = pontuacao.faixas(ec.id);
  if (!f.length) throw new Error('deveria devolver as faixas padrão');
});
t('pontuacao: salvar e ler faixas customizadas', () => {
  pontuacao.salvar(ec.id, [
    { ini: 1, fim: 1, pontos: 300 },
    { ini: 2, fim: 2, pontos: 240 },
    { ini: 5, fim: 8, pontos: 120 },
  ]);
  const f = pontuacao.faixas(ec.id);
  eq(f.length, 3, 'nº de faixas');
  eq(f[0].pontos, 300, 'pontos da 1ª colocação');
  eq(f[2].fim, 8, 'fim da faixa 5-8');
});

// --- remoção -----------------------------------------------------------
t('remover: dupla some da listagem', () => {
  const novaDupla = dupla.criar({ etapaCategoriaId: ec.id, codigo: 'B1', grupo: 'B',
                                  atleta1Id: a1.id, atleta2Id: a4.id });
  const antes = dupla.listar(ec.id).length;
  dupla.remover(novaDupla.id);
  eq(dupla.listar(ec.id).length, antes - 1);
});

// --- remoção em cascata ------------------------------------------------
// Cada teste monta a sua própria árvore isolada para não interferir nos
// objetos compartilhados (temp/et/ec) usados acima.
function contar(tabela, coluna, valor) {
  return getDb().prepare(
    `SELECT COUNT(*) AS n FROM ${tabela} WHERE ${coluna} = ?`).get(valor).n;
}

// Monta uma árvore completa (etapa_categoria + 2 duplas + jogo de grupo +
// jogo de mata-mata que referencia o de grupo) e devolve os ids.
function montarArvore(etapaId) {
  const ecx = etapaCategoria.criar({
    etapaId, categoriaId: categoriaTeste.id, tipo: 'masculino', numGrupos: 1 });
  const dx1 = dupla.criar({ etapaCategoriaId: ecx.id, codigo: 'A1', grupo: 'A',
                            atleta1Id: a1.id, atleta2Id: a2.id });
  const dx2 = dupla.criar({ etapaCategoriaId: ecx.id, codigo: 'A2', grupo: 'A',
                            atleta1Id: a3.id, atleta2Id: a4.id });
  const jg = jogo.criar({ etapaCategoriaId: ecx.id, fase: 'grupo', num: 1, grupo: 'A',
                          dupla1Id: dx1.id, dupla2Id: dx2.id });
  // Jogo que referencia outro jogo (origem) — exercita o defer_foreign_keys.
  jogo.criar({ etapaCategoriaId: ecx.id, fase: 'final', num: 2,
               origem1JogoId: jg.id, origem1Tipo: 'vencedor',
               origem2JogoId: jg.id, origem2Tipo: 'perdedor' });
  getDb().prepare(`INSERT INTO pontuacao (etapa_categoria_id, pos_ini, pos_fim, pontos)
                   VALUES (?, 1, 1, 200)`).run(ecx.id);
  return ecx.id;
}

t('remover etapa_categoria: apaga jogos, duplas e pontuação; mantém atletas', () => {
  const etx = etapa.criar({ temporadaId: temp.id, nome: 'Etapa cascata EC' });
  const ecx = montarArvore(etx.id);
  const atletasAntes = atleta.listar().length;

  etapaCategoria.remover(ecx);

  eq(etapaCategoria.obter(ecx), undefined, 'etapa_categoria removida');
  eq(contar('dupla', 'etapa_categoria_id', ecx), 0, 'duplas');
  eq(contar('jogo', 'etapa_categoria_id', ecx), 0, 'jogos');
  eq(contar('pontuacao', 'etapa_categoria_id', ecx), 0, 'pontuação');
  eq(atleta.listar().length, atletasAntes, 'atletas preservados');
});

t('remover etapa: apaga etapa_categoria e seus jogos/duplas em cascata', () => {
  const etx = etapa.criar({ temporadaId: temp.id, nome: 'Etapa cascata' });
  const ecx = montarArvore(etx.id);
  const atletasAntes = atleta.listar().length;

  etapa.remover(etx.id);

  eq(etapa.obter(etx.id), undefined, 'etapa removida');
  eq(etapaCategoria.listar(etx.id).length, 0, 'etapa_categoria');
  eq(contar('dupla', 'etapa_categoria_id', ecx), 0, 'duplas');
  eq(contar('jogo', 'etapa_categoria_id', ecx), 0, 'jogos');
  eq(atleta.listar().length, atletasAntes, 'atletas preservados');
});

t('remover temporada: apaga etapas, categorias, duplas e jogos em cascata', () => {
  const tx = temporada.criar({ nome: 'Temporada cascata', ano: 2099 });
  const etx = etapa.criar({ temporadaId: tx.id, nome: 'Etapa T' });
  const ecx = montarArvore(etx.id);
  const atletasAntes = atleta.listar().length;

  temporada.remover(tx.id);

  eq(temporada.obter(tx.id), undefined, 'temporada removida');
  eq(etapa.listar(tx.id).length, 0, 'etapas');
  eq(contar('etapa_categoria', 'etapa_id', etx.id), 0, 'etapa_categoria');
  eq(contar('dupla', 'etapa_categoria_id', ecx), 0, 'duplas');
  eq(contar('jogo', 'etapa_categoria_id', ecx), 0, 'jogos');
  eq(atleta.listar().length, atletasAntes, 'atletas preservados');
});

fechar();
console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
