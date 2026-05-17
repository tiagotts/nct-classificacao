// Repositório da temporada (o circuito de um ano).
const { getDb } = require('../database');

function listar() {
  return getDb().prepare('SELECT * FROM temporada ORDER BY ano DESC, nome').all();
}

function obter(id) {
  return getDb().prepare('SELECT * FROM temporada WHERE id = ?').get(id);
}

function criar({ nome, ano }) {
  const info = getDb()
    .prepare('INSERT INTO temporada (nome, ano) VALUES (?, ?)')
    .run(nome, ano);
  return obter(info.lastInsertRowid);
}

function atualizar(id, { nome, ano }) {
  getDb()
    .prepare('UPDATE temporada SET nome = ?, ano = ? WHERE id = ?')
    .run(nome, ano, id);
  return obter(id);
}

// Remove a temporada em cascata: apaga as etapas dela e, de cada uma, as
// etapa_categoria com seus jogos, duplas e pontuação. Os atletas são
// compartilhados entre etapas e não são removidos. defer_foreign_keys adia
// a checagem das FKs até o commit — necessário pelas referências entre jogos.
function remover(id) {
  const db = getDb();
  const escopoEtapa = '(SELECT id FROM etapa WHERE temporada_id = ?)';
  const escopoEc =
    `(SELECT id FROM etapa_categoria WHERE etapa_id IN ${escopoEtapa})`;
  db.transaction(() => {
    db.pragma('defer_foreign_keys = ON');
    db.prepare(`DELETE FROM jogo WHERE etapa_categoria_id IN ${escopoEc}`).run(id);
    db.prepare(`DELETE FROM dupla WHERE etapa_categoria_id IN ${escopoEc}`).run(id);
    db.prepare(`DELETE FROM pontuacao WHERE etapa_categoria_id IN ${escopoEc}`).run(id);
    db.prepare(`DELETE FROM etapa_categoria WHERE etapa_id IN ${escopoEtapa}`).run(id);
    db.prepare('DELETE FROM etapa WHERE temporada_id = ?').run(id);
    db.prepare('DELETE FROM temporada WHERE id = ?').run(id);
  })();
}

module.exports = { listar, obter, criar, atualizar, remover };
