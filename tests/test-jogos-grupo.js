// Testes da geração de jogos da fase de grupos.
// Rodar com:  npm test

const { gerarConfrontos } = require('../src/motor/jogos-grupo');
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

// --- jogo.gerarFaseGrupos (com banco) ----------------------------------
abrir(':memory:');

const temp = temporada.criar({ nome: 'T', ano: 2025 });
const et = etapa.criar({ temporadaId: temp.id, nome: 'E1' });
const sub17 = categoria.listar().find(c => c.slug === 'sub17');
const ec = etapaCategoria.criar({ etapaId: et.id, categoriaId: sub17.id, numGrupos: 1 });

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

fechar();
console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
