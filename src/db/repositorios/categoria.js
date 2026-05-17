// Repositório da categoria. Catálogo fixo, semeado pela migração 0001:
// só leitura, sem criar/atualizar/remover.
const { getDb } = require('../database');

function listar() {
  return getDb().prepare('SELECT * FROM categoria ORDER BY nome').all();
}

function obter(id) {
  return getDb().prepare('SELECT * FROM categoria WHERE id = ?').get(id);
}

module.exports = { listar, obter };
