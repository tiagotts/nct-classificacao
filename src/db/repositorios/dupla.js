// Repositório da dupla: parceria de dois atletas inscrita numa etapa_categoria.
const { getDb } = require('../database');

// Traz os nomes dos dois atletas junto.
const SELECT_BASE = `
  SELECT d.*, a1.nome AS atleta1_nome, a2.nome AS atleta2_nome
  FROM dupla d
  JOIN atleta a1 ON a1.id = d.atleta1_id
  JOIN atleta a2 ON a2.id = d.atleta2_id`;

// listar(etapaCategoriaId): duplas de uma categoria de uma etapa.
function listar(etapaCategoriaId) {
  return getDb()
    .prepare(`${SELECT_BASE} WHERE d.etapa_categoria_id = ? ORDER BY d.grupo, d.codigo`)
    .all(etapaCategoriaId);
}

function obter(id) {
  return getDb().prepare(`${SELECT_BASE} WHERE d.id = ?`).get(id);
}

function criar({ etapaCategoriaId, codigo, grupo, atleta1Id, atleta2Id }) {
  const info = getDb()
    .prepare(`INSERT INTO dupla
                (etapa_categoria_id, codigo, grupo, atleta1_id, atleta2_id)
              VALUES (?, ?, ?, ?, ?)`)
    .run(etapaCategoriaId, codigo, grupo ?? null, atleta1Id, atleta2Id);
  return obter(info.lastInsertRowid);
}

function atualizar(id, { codigo, grupo, atleta1Id, atleta2Id }) {
  getDb()
    .prepare(`UPDATE dupla
              SET codigo = ?, grupo = ?, atleta1_id = ?, atleta2_id = ?
              WHERE id = ?`)
    .run(codigo, grupo ?? null, atleta1Id, atleta2Id, id);
  return obter(id);
}

function remover(id) {
  getDb().prepare('DELETE FROM dupla WHERE id = ?').run(id);
}

module.exports = { listar, obter, criar, atualizar, remover };
