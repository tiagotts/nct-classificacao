// Orquestra o cálculo da classificação: lê duplas, jogos e a configuração
// da etapa_categoria do banco e chama o motor.
const { calcularRankingGeral } = require('../../motor/ranking-geral');
const etapaCategoria = require('./etapa-categoria');
const dupla = require('./dupla');
const jogo = require('./jogo');

// calcular(etapaCategoriaId): devolve a classificação de cada grupo (grupos)
// e o ranking geral dos classificados, 1..N (ranking).
function calcular(etapaCategoriaId) {
  const ec = etapaCategoria.obter(etapaCategoriaId);
  let config = {};
  if (ec && ec.config_json) {
    try { config = JSON.parse(ec.config_json); } catch { config = {}; }
  }
  // O formato decide o esquema de classificação (pontos x chave do grupo).
  if (ec) config.formato = ec.formato;
  const duplas = dupla.listar(etapaCategoriaId);
  const jogos = jogo.listar(etapaCategoriaId);
  const r = calcularRankingGeral(duplas, jogos, config);
  return { ...r, formato: config.formato || 'todos-contra-todos' };
}

module.exports = { calcular };
