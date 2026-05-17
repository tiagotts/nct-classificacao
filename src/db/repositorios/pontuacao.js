// Repositório da tabela de pontuação por colocação.
// Cada etapa_categoria pode ter a sua; quando não há nenhuma cadastrada,
// usa-se as faixas padrão do regulamento.
const { getDb } = require('../database');
const { FAIXAS_PADRAO } = require('../../motor/pontuacao');

// faixas(etapaCategoriaId): faixas de pontuação da categoria, ou as padrão.
function faixas(etapaCategoriaId) {
  const rows = getDb().prepare(
    `SELECT pos_ini, pos_fim, pontos FROM pontuacao
     WHERE etapa_categoria_id = ? ORDER BY pos_ini`).all(etapaCategoriaId);
  if (!rows.length) return FAIXAS_PADRAO;
  return rows.map(r => ({ ini: r.pos_ini, fim: r.pos_fim, pontos: r.pontos }));
}

module.exports = { faixas };
