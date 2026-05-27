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
    .prepare(`${SELECT_BASE} WHERE ec.etapa_id = ? ORDER BY c.nome, ec.tipo`)
    .all(etapaId);
}

function obter(id) {
  return getDb().prepare(`${SELECT_BASE} WHERE ec.id = ?`).get(id);
}

function criar({ etapaId, categoriaId, tipo, numGrupos, configJson, formato,
                 dataCompeticao }) {
  const info = getDb()
    .prepare(`INSERT INTO etapa_categoria
                (etapa_id, categoria_id, tipo, num_grupos, config_json, formato,
                 data_competicao)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(etapaId, categoriaId, tipo || null, numGrupos ?? null,
         configJson ?? null, formato || 'todos-contra-todos',
         dataCompeticao || null);
  return obter(info.lastInsertRowid);
}

// atualizar: formato e dataCompeticao são opcionais — quando undefined o
// valor atual é preservado (ex.: salvando só o config_json pela tela de
// configuração não deve apagar a data já cadastrada). null é tratado como
// "limpar"; undefined como "não tocar".
function atualizar(id, { numGrupos, configJson, formato, dataCompeticao }) {
  const atual = obter(id);
  const dataFinal = dataCompeticao === undefined
    ? (atual && atual.data_competicao)
    : (dataCompeticao || null);
  getDb()
    .prepare(`UPDATE etapa_categoria
              SET num_grupos = ?, config_json = ?, formato = ?,
                  data_competicao = ?
              WHERE id = ?`)
    .run(numGrupos ?? null, configJson ?? null,
         formato || (atual && atual.formato) || 'todos-contra-todos',
         dataFinal, id);
  return obter(id);
}

// Remove a etapa_categoria em cascata: apaga antes os jogos, as duplas e a
// pontuação dela. Os atletas são compartilhados entre etapas e não são
// removidos. defer_foreign_keys adia a checagem das FKs até o commit —
// necessário porque os jogos do mata-mata referenciam uns aos outros (origem).
function remover(id) {
  const db = getDb();
  db.transaction(() => {
    db.pragma('defer_foreign_keys = ON');
    db.prepare('DELETE FROM jogo WHERE etapa_categoria_id = ?').run(id);
    db.prepare('DELETE FROM dupla WHERE etapa_categoria_id = ?').run(id);
    db.prepare('DELETE FROM pontuacao WHERE etapa_categoria_id = ?').run(id);
    db.prepare('DELETE FROM etapa_categoria WHERE id = ?').run(id);
  })();
}

module.exports = { listar, obter, criar, atualizar, remover };
