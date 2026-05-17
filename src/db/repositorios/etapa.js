// Repositório da etapa (um evento do circuito).
const { getDb } = require('../database');

// listar(temporadaId): etapas de uma temporada.
function listar(temporadaId) {
  return getDb()
    .prepare('SELECT * FROM etapa WHERE temporada_id = ? ORDER BY data, nome')
    .all(temporadaId);
}

function obter(id) {
  return getDb().prepare('SELECT * FROM etapa WHERE id = ?').get(id);
}

function criar({ temporadaId, nome, data, local }) {
  const info = getDb()
    .prepare('INSERT INTO etapa (temporada_id, nome, data, local) VALUES (?, ?, ?, ?)')
    .run(temporadaId, nome, data ?? null, local ?? null);
  return obter(info.lastInsertRowid);
}

function atualizar(id, { nome, data, local }) {
  getDb()
    .prepare('UPDATE etapa SET nome = ?, data = ?, local = ? WHERE id = ?')
    .run(nome, data ?? null, local ?? null, id);
  return obter(id);
}

function remover(id) {
  getDb().prepare('DELETE FROM etapa WHERE id = ?').run(id);
}

module.exports = { listar, obter, criar, atualizar, remover };
