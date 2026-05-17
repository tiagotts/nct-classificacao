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

function criar({ nome }) {
  const info = getDb().prepare('INSERT INTO atleta (nome) VALUES (?)').run(nome);
  return obter(info.lastInsertRowid);
}

function atualizar(id, { nome }) {
  getDb().prepare('UPDATE atleta SET nome = ? WHERE id = ?').run(nome, id);
  return obter(id);
}

function remover(id) {
  getDb().prepare('DELETE FROM atleta WHERE id = ?').run(id);
}

module.exports = { listar, buscar, obter, criar, atualizar, remover };
