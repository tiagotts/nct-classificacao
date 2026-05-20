// Orquestra o cálculo do ranking de entrada de uma etapa: junta pontos
// iniciais cadastrados, pontos ganhos em etapas anteriores e as colocações
// de cada atleta, e chama o motor.
const { getDb } = require('../database');
const etapaCategoriaRepo = require('./etapa-categoria');
const etapaRepo = require('./etapa');
const duplaRepo = require('./dupla');
const rankingInicial = require('./ranking-inicial');
const { calcularRankingEntrada } = require('../../motor/ranking-entrada');

// calcular(etapaCategoriaId): ranking de entrada das duplas desta categoria
// da etapa, considerando o histórico da temporada (etapas anteriores) e o
// ranking inicial cadastrado. Devolve a lista de duplas ordenadas.
function calcular(etapaCategoriaId) {
  const ec = etapaCategoriaRepo.obter(etapaCategoriaId);
  if (!ec) return [];
  const etapa = etapaRepo.obter(ec.etapa_id);
  if (!etapa) return [];

  const duplas = duplaRepo.listar(etapaCategoriaId);
  if (!duplas.length) return [];

  // Pontos iniciais cadastrados para a (temporada, categoria, tipo).
  const pontos = { ...rankingInicial.porAtleta(
    etapa.temporada_id, ec.categoria_id, ec.tipo) };
  const colocs = {};

  // Resultados das etapas ANTERIORES (id menor) na mesma temporada/categoria/tipo.
  const resultados = getDb().prepare(`
    SELECT d.atleta1_id, d.atleta2_id, d.pontos_ganhos, d.colocacao_final
    FROM dupla d
    JOIN etapa_categoria ec ON ec.id = d.etapa_categoria_id
    JOIN etapa e ON e.id = ec.etapa_id
    WHERE e.temporada_id = ? AND ec.categoria_id = ? AND ec.tipo = ?
      AND e.id < ?
  `).all(etapa.temporada_id, ec.categoria_id, ec.tipo, etapa.id);

  for (const r of resultados) {
    for (const aid of [r.atleta1_id, r.atleta2_id]) {
      if (aid == null) continue;
      if (r.pontos_ganhos != null) {
        pontos[aid] = (pontos[aid] || 0) + r.pontos_ganhos;
      }
      if (r.colocacao_final != null) {
        (colocs[aid] = colocs[aid] || []).push(r.colocacao_final);
      }
    }
  }

  return calcularRankingEntrada(duplas, {
    pontosPorAtleta: pontos,
    colocacoesPorAtleta: colocs,
  });
}

module.exports = { calcular };
