// Repositório do atleta (a pessoa). Cadastro reutilizável entre etapas.
const { getDb } = require('../database');

function listar() {
  return getDb().prepare('SELECT * FROM atleta ORDER BY nome').all();
}

// buscar(termo): para autocomplete no cadastro de duplas.
function buscar(termo) {
  return getDb()
    .prepare('SELECT * FROM atleta WHERE nome LIKE ? ORDER BY nome LIMIT 20')
    .all(`%${termo}%`);
}

function obter(id) {
  return getDb().prepare('SELECT * FROM atleta WHERE id = ?').get(id);
}

function criar({ nome, nome_completo = null }) {
  const info = getDb()
    .prepare('INSERT INTO atleta (nome, nome_completo) VALUES (?, ?)')
    .run(nome, nome_completo || null);
  return obter(info.lastInsertRowid);
}

function atualizar(id, { nome, nome_completo }) {
  getDb()
    .prepare('UPDATE atleta SET nome = ?, nome_completo = ? WHERE id = ?')
    .run(nome, nome_completo || null, id);
  return obter(id);
}

function remover(id) {
  getDb().prepare('DELETE FROM atleta WHERE id = ?').run(id);
}

module.exports = { listar, buscar, obter, criar, atualizar, remover };
