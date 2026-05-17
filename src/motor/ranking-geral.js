// =============================================================================
// Motor do ranking geral dos classificados (regulamento NCT, item 8).
// A partir da classificação dos grupos, determina quem avança ao mata-mata:
//   - os classPorGrupo primeiros de cada grupo (classificados diretos);
//   - os melhores (classPorGrupo+1)-ésimos colocados, via repescagem.
// Em seguida ordena todos os classificados em um ranking geral de 1 a N,
// independente da posição no grupo, pelos mesmos critérios de desempate.
// =============================================================================

const { calcularClassificacao, ordenarPorCriterios } = require('./classificacao');

const CONFIG_PADRAO = {
  classPorGrupo: 2,
  criterios: ['V', 'AVG', 'H2H', 'SORTEIO'],
};

const TAMANHOS_CHAVE = [4, 8, 16];

/**
 * Calcula o ranking geral dos classificados.
 * @param {Array} duplas - duplas da etapa_categoria
 * @param {Array} jogos  - jogos da etapa_categoria
 * @param {Object} config - { classPorGrupo, repescagem, criterios, formulaAvg }
 * @returns {Object} { criterios, formulaAvg, grupos, ranking: [statComSeed] }
 */
function calcularRankingGeral(duplas, jogos, config = {}) {
  const cls = calcularClassificacao(duplas, jogos, config);
  const classPorGrupo = config.classPorGrupo ?? CONFIG_PADRAO.classPorGrupo;
  const criterios = (config.criterios && config.criterios.length)
    ? config.criterios : CONFIG_PADRAO.criterios;

  const diretos = [];
  const candidatosRepescagem = [];
  for (const g of Object.keys(cls.grupos)) {
    cls.grupos[g].forEach((s, i) => {
      // motivo é zerado: o desempate relevante aqui é o do ranking geral.
      const copia = { ...s, motivo: null };
      if (i < classPorGrupo) {
        copia.classificadoPor = `${i + 1}º do grupo ${g}`;
        diretos.push(copia);
      } else if (i === classPorGrupo) {
        copia.classificadoPor = `${i + 1}º do grupo ${g} (repescagem)`;
        candidatosRepescagem.push(copia);
      }
    });
  }

  // Quantas duplas entram por repescagem: o valor configurado, ou — quando
  // não configurado — o necessário para completar a próxima chave válida
  // (4, 8 ou 16). Ex.: 3 grupos com 2 diretos = 6 -> completa para 8.
  let repescagem;
  if (config.repescagem != null) {
    repescagem = config.repescagem;
  } else {
    const alvo = TAMANHOS_CHAVE.find(n => n >= diretos.length);
    repescagem = alvo ? alvo - diretos.length : 0;
  }

  // Escolhe os melhores terceiros (ou n-ésimos) para a repescagem.
  const repescados = ordenarPorCriterios(candidatosRepescagem, jogos, criterios)
    .slice(0, repescagem);

  // Ranking geral 1..N de todos os classificados.
  const ranking = ordenarPorCriterios([...diretos, ...repescados], jogos, criterios);
  ranking.forEach((s, i) => { s.seed = i + 1; });

  return {
    criterios,
    formulaAvg: cls.formulaAvg,
    grupos: cls.grupos,
    ranking,
  };
}

module.exports = { calcularRankingGeral };
