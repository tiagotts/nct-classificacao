// Repositório da etapa (um evento do circuito).
const { getDb } = require('../database');

// listar(temporadaId): etapas de uma temporada.
function listar(temporadaId) {
  return getDb()
    .prepare('SELECT * FROM etapa WHERE temporada_id = ? ORDER BY data_inicio, nome')
    .all(temporadaId);
}

function obter(id) {
  return getDb().prepare('SELECT * FROM etapa WHERE id = ?').get(id);
}

function criar({ temporadaId, nome, dataInicio, dataFim, local }) {
  const info = getDb()
    .prepare(`INSERT INTO etapa (temporada_id, nome, data_inicio, data_fim, local)
              VALUES (?, ?, ?, ?, ?)`)
    .run(temporadaId, nome, dataInicio ?? null, dataFim ?? null, local ?? null);
  return obter(info.lastInsertRowid);
}

function atualizar(id, { nome, dataInicio, dataFim, local }) {
  getDb()
    .prepare(`UPDATE etapa SET nome = ?, data_inicio = ?, data_fim = ?, local = ?
              WHERE id = ?`)
    .run(nome, dataInicio ?? null, dataFim ?? null, local ?? null, id);
  return obter(id);
}

// Remove a etapa em cascata: apaga as etapa_categoria dela e, de cada uma,
// os jogos, as duplas e a pontuação. Os atletas são compartilhados entre
// etapas e não são removidos. defer_foreign_keys adia a checagem das FKs
// até o commit — necessário porque os jogos referenciam uns aos outros.
function remover(id) {
  const db = getDb();
  const escopoEc = '(SELECT id FROM etapa_categoria WHERE etapa_id = ?)';
  db.transaction(() => {
    db.pragma('defer_foreign_keys = ON');
    db.prepare(`DELETE FROM jogo WHERE etapa_categoria_id IN ${escopoEc}`).run(id);
    db.prepare(`DELETE FROM dupla WHERE etapa_categoria_id IN ${escopoEc}`).run(id);
    db.prepare(`DELETE FROM pontuacao WHERE etapa_categoria_id IN ${escopoEc}`).run(id);
    db.prepare('DELETE FROM etapa_categoria WHERE etapa_id = ?').run(id);
    db.prepare('DELETE FROM etapa WHERE id = ?').run(id);
  })();
}

module.exports = { listar, obter, criar, atualizar, remover };
