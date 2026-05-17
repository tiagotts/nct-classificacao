// Repositório da etapa_categoria: a categoria efetivamente disputada numa
// etapa. É a unidade de competição independente (grupos, classificação, chave).
const { getDb } = require('../database');

// Traz o nome/slug da categoria junto, para a UI não precisar de outra consulta.
const SELECT_BASE = `
  SELECT ec.*, c.nome AS categoria_nome, c.slug AS categoria_slug
  FROM etapa_categoria ec
  JOIN categoria c ON c.id = ec.categoria_id`;

// listar(etapaId): categorias disputadas numa etapa.
function listar(etapaId) {
  return getDb()
    .prepare(`${SELECT_BASE} WHERE ec.etapa_id = ? ORDER BY c.nome`)
    .all(etapaId);
}

function obter(id) {
  return getDb().prepare(`${SELECT_BASE} WHERE ec.id = ?`).get(id);
}

function criar({ etapaId, categoriaId, numGrupos, configJson }) {
  const info = getDb()
    .prepare(`INSERT INTO etapa_categoria (etapa_id, categoria_id, num_grupos, config_json)
              VALUES (?, ?, ?, ?)`)
    .run(etapaId, categoriaId, numGrupos ?? null, configJson ?? null);
  return obter(info.lastInsertRowid);
}

function atualizar(id, { numGrupos, configJson }) {
  getDb()
    .prepare('UPDATE etapa_categoria SET num_grupos = ?, config_json = ? WHERE id = ?')
    .run(numGrupos ?? null, configJson ?? null, id);
  return obter(id);
}

function remover(id) {
  getDb().prepare('DELETE FROM etapa_categoria WHERE id = ?').run(id);
}

module.exports = { listar, obter, criar, atualizar, remover };
