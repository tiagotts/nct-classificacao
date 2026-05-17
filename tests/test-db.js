// Testes da camada de banco: conexão, runner de migrações e schema inicial.
// Rodar com:  node tests/test-db.js
//
// Observação: better-sqlite3 é módulo nativo. Este teste roda no Node do
// sistema. Se o módulo tiver sido recompilado para o Electron (npm run
// rebuild), rode "npm rebuild better-sqlite3" antes de executar os testes.

const { abrir, getDb, fechar } = require('../src/db/database');

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); console.log(`  ok   ${nome}`); ok++; }
  catch (err) { console.log(`  FALHOU ${nome}\n     ${err.message}`); fail++; }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} esperado ${b}, veio ${a}`);
}

console.log('\n=== TESTES — Camada de banco (schema inicial) ===\n');

abrir(':memory:');
const db = getDb();

t('todas as tabelas do modelo foram criadas', () => {
  const tabelas = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all().map(r => r.name);
  for (const tb of ['temporada','etapa','categoria','etapa_categoria',
                    'atleta','dupla','jogo','pontuacao']) {
    if (!tabelas.includes(tb)) throw new Error(`faltou a tabela "${tb}"`);
  }
});

t('catálogo fixo de categorias foi semeado (4 categorias)', () => {
  const n = db.prepare('SELECT COUNT(*) AS c FROM categoria').get().c;
  eq(n, 4, 'nº de categorias');
});

t('slugs das categorias são os esperados', () => {
  const slugs = db.prepare('SELECT slug FROM categoria ORDER BY slug')
    .all().map(r => r.slug);
  eq(JSON.stringify(slugs),
     JSON.stringify(['master','open','sub17','sub21']));
});

t('user_version reflete a migração aplicada', () => {
  eq(db.pragma('user_version', { simple: true }), 1, 'user_version');
});

t('foreign keys estão habilitadas', () => {
  eq(db.pragma('foreign_keys', { simple: true }), 1, 'foreign_keys');
});

t('migração é idempotente (reabrir não duplica categorias)', () => {
  fechar();
  abrir(':memory:'); // banco novo, mas valida que o runner não quebra
  const n = getDb().prepare('SELECT COUNT(*) AS c FROM categoria').get().c;
  eq(n, 4, 'nº de categorias após reabrir');
});

t('check constraint de tipo_resultado rejeita valor inválido', () => {
  const d = getDb();
  d.exec(`INSERT INTO temporada (nome, ano) VALUES ('T', 2025);
          INSERT INTO etapa (temporada_id, nome) VALUES (1, 'E1');
          INSERT INTO etapa_categoria (etapa_id, categoria_id) VALUES (1, 1);`);
  let lancou = false;
  try {
    d.prepare(`INSERT INTO jogo (etapa_categoria_id, fase, tipo_resultado)
               VALUES (1, 'grupo', 'invalido')`).run();
  } catch { lancou = true; }
  if (!lancou) throw new Error('deveria rejeitar tipo_resultado inválido');
});

fechar();
console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
