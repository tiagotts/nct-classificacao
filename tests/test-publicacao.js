// Testes do gerador da página pública (uma página por categoria).
// Rodar com:  npm test

const { abrir, fechar } = require('../src/db/database');
const temporada = require('../src/db/repositorios/temporada');
const etapa = require('../src/db/repositorios/etapa');
const etapaCategoria = require('../src/db/repositorios/etapa-categoria');
const categoria = require('../src/db/repositorios/categoria');
const atleta = require('../src/db/repositorios/atleta');
const dupla = require('../src/db/repositorios/dupla');
const { gerarPaginaCategoria } = require('../src/publicacao/gerar-pagina');

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); console.log(`  ok   ${nome}`); ok++; }
  catch (err) { console.log(`  FALHOU ${nome}\n     ${err.message}`); fail++; }
}

console.log('\n=== TESTES — Gerador da página pública ===\n');

abrir(':memory:');

const temp = temporada.criar({ nome: 'Circuito NCT 2025', ano: 2025 });
const et = etapa.criar({
  temporadaId: temp.id, nome: '4ª Etapa', data: '2025-08-01', local: 'Arena 61',
});
const cat = categoria.listar().find(c => c.slug === 'sub18');
const ec = etapaCategoria.criar({
  etapaId: et.id, categoriaId: cat.id, tipo: 'masculino', numGrupos: 1,
});
const a1 = atleta.criar({ nome: 'João Silva' });
const a2 = atleta.criar({ nome: 'Pedro Souza' });
dupla.criar({
  etapaCategoriaId: ec.id, codigo: 'A1', grupo: 'A',
  atleta1Id: a1.id, atleta2Id: a2.id,
});

t('gera um documento HTML completo', () => {
  const html = gerarPaginaCategoria(ec.id);
  if (!html.includes('<!DOCTYPE html>')) throw new Error('não é um documento HTML');
  if (!html.includes('</html>')) throw new Error('HTML incompleto');
});

t('inclui o nome da categoria e da etapa', () => {
  const html = gerarPaginaCategoria(ec.id);
  if (!html.includes('Sub 18')) throw new Error('faltou a categoria');
  if (!html.includes('4ª Etapa')) throw new Error('faltou o nome da etapa');
});

t('inclui a dupla cadastrada na classificação', () => {
  const html = gerarPaginaCategoria(ec.id);
  if (!html.includes('João Silva')) throw new Error('faltou o atleta na página');
});

t('não inclui nenhum ranking (só grupos, jogos e mata-mata)', () => {
  const html = gerarPaginaCategoria(ec.id);
  if (/Ranking da temporada/i.test(html)) {
    throw new Error('a página não deveria ter o ranking da temporada');
  }
  if (/Ranking da etapa/i.test(html)) {
    throw new Error('a página não deveria ter o ranking da etapa');
  }
});

t('categoria inexistente lança erro', () => {
  let lancou = false;
  try { gerarPaginaCategoria(999999); } catch { lancou = true; }
  if (!lancou) throw new Error('deveria lançar erro');
});

fechar();
console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
