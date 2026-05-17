// Orquestra o ranking de temporada por atleta: lê os resultados das duplas
// de uma categoria, em todas as etapas da temporada, e chama o motor.
const { getDb } = require('../database');
const motor = require('../../motor/pontuacao');

// calcular(temporadaId, categoriaId): ranking de temporada por atleta.
function calcular(temporadaId, categoriaId) {
  const db = getDb();
  const resultados = db.prepare(`
    SELECT d.atleta1_id, d.atleta2_id, d.pontos_ganhos, d.colocacao_final
    FROM dupla d
    JOIN etapa_categoria ec ON ec.id = d.etapa_categoria_id
    JOIN etapa e ON e.id = ec.etapa_id
    WHERE e.temporada_id = ? AND ec.categoria_id = ?
  `).all(temporadaId, categoriaId);

  const nomePorAtleta = {};
  for (const a of db.prepare('SELECT id, nome FROM atleta').all()) {
    nomePorAtleta[a.id] = a.nome;
  }
  return motor.calcularRankingTemporada(resultados, nomePorAtleta);
}

module.exports = { calcular };
