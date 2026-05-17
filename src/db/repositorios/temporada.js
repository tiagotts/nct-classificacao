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

function remover(id) {
  getDb().prepare('DELETE FROM temporada WHERE id = ?').run(id);
}

module.exports = { listar, obter, criar, atualizar, remover };
