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
const TAMANHOS_VALIDOS = [4, 6, 8, 16]; // 6 é o caso especial com bye (chave.js)

/**
 * Calcula o ranking geral dos classificados.
 * @param {Array} duplas - duplas da etapa_categoria
 * @param {Array} jogos  - jogos da etapa_categoria
 * @param {Object} config - { classPorGrupo, repescagem, criterios, formulaAvg,
 *   tamanhoChave }. tamanhoChave fixa o tamanho do mata-mata (4|6|8|16);
 *   quando ausente, o app pega o menor tamanho válido que cabem os diretos.
 * @returns {Object} { criterios, formulaAvg, grupos, ranking: [statComSeed] }
 */
function calcularRankingGeral(duplas, jogos, config = {}) {
  const cls = calcularClassificacao(duplas, jogos, config);
  const classPorGrupo = config.classPorGrupo ?? CONFIG_PADRAO.classPorGrupo;
  const criterios = (config.criterios && config.criterios.length)
    ? config.criterios : CONFIG_PADRAO.criterios;
  const prioridadeSorteio = config.prioridadeSorteio || [];

  const diretos = [];
  // naoDiretos: duplas não classificadas direto. posGrupo (posição no grupo)
  // é guardado em todas para a repescagem priorizar os terceiros, depois os
  // quartos, etc., e para o ranqueamento em blocos.
  const naoDiretos = [];
  for (const g of Object.keys(cls.grupos)) {
    cls.grupos[g].forEach((s, i) => {
      // motivo é zerado: o desempate relevante aqui é o do ranking geral.
      const copia = { ...s, motivo: null, posGrupo: i + 1, grupoOrigem: g };
      if (i < classPorGrupo) {
        copia.classificadoPor = `${i + 1}º do grupo ${g}`;
        diretos.push(copia);
      } else {
        naoDiretos.push(copia);
      }
    });
  }

  // Tamanho do mata-mata. Precedência:
  //  1) tamanhoChave fixo (configurado pelo usuário) — força esse tamanho.
  //  2) repescagem explícita — define diretamente quantas duplas vêm da
  //     repescagem (compat. com o knob antigo).
  //  3) Automático — pega o menor tamanho de chave válido que comporta os
  //     diretos. Ex.: 3 grupos com 2 diretos = 6 -> completa para 8.
  let repescagem;
  if (config.tamanhoChave != null) {
    if (!TAMANHOS_VALIDOS.includes(config.tamanhoChave)) {
      throw new Error(
        `Tamanho do mata-mata inválido (${config.tamanhoChave}). `
        + `Use 4, 6, 8 ou 16.`);
    }
    if (diretos.length > config.tamanhoChave) {
      throw new Error(
        `Não cabe: ${diretos.length} duplas classificadas direto, mas o `
        + `mata-mata foi fixado em ${config.tamanhoChave}.`);
    }
    repescagem = config.tamanhoChave - diretos.length;
  } else if (config.repescagem != null) {
    repescagem = config.repescagem;
  } else {
    const alvo = TAMANHOS_CHAVE.find(n => n >= diretos.length);
    repescagem = alvo ? alvo - diretos.length : 0;
  }

  // Ordena os candidatos à repescagem por faixa de posição no grupo: todos
  // os terceiros antes de todos os quartos, etc.; dentro da faixa, pelos
  // critérios de desempate. Assim os "melhores terceiros" têm prioridade e
  // os quartos só entram para completar uma chave válida (ex.: 4 duplas em
  // 1 grupo -> os 4 vão ao mata-mata).
  const porPosicao = {};
  for (const c of naoDiretos) {
    (porPosicao[c.posGrupo] = porPosicao[c.posGrupo] || []).push(c);
  }
  const candidatos = [];
  for (const pos of Object.keys(porPosicao).map(Number).sort((a, b) => a - b)) {
    candidatos.push(...ordenarPorCriterios(porPosicao[pos], jogos, criterios, prioridadeSorteio));
  }
  const repescados = candidatos.slice(0, repescagem);
  repescados.forEach(c => {
    c.classificadoPor = `${c.posGrupo}º do grupo ${c.grupoOrigem} (repescagem)`;
  });

  // Pendentes: duplas que ficaram empatadas com o último repescado no
  // critério de desempate (motivo='Sorteio' marca exatamente isso — empate
  // que cairia em sorteio). Elas aparecem na tela de Classificação logo
  // depois do último in, com a tag Sorteio, para o usuário poder decidir
  // manualmente quem entra de fato no mata-mata via setas ↑↓.
  const pendentes = [];
  for (let i = repescagem; i < candidatos.length; i++) {
    if (candidatos[i].motivo !== 'Sorteio') break;
    pendentes.push(candidatos[i]);
  }
  if (pendentes.length > 0 && repescados.length > 0) {
    // O último in também faz parte do empate — marca para a UI destacar.
    repescados[repescados.length - 1].empateRepescagem = true;
    pendentes.forEach(p => { p.empateRepescagem = true; });
  }

  // Ranking geral, em dois modos (config.rankingGeral):
  //  - 'blocos' (padrão): ordena primeiro pela posição no grupo (todos os 1º
  //    colocados, depois os 2º, depois os repescados...) e, dentro de cada
  //    bloco, pelos critérios. Um 2º nunca passa à frente de um 1º.
  //  - 'independente': ordena todos os classificados só pelos critérios de
  //    desempate, independente da posição que tiveram no grupo.
  const classificados = [...diretos, ...repescados];
  let ranking;
  if (config.rankingGeral === 'independente') {
    ranking = ordenarPorCriterios(classificados, jogos, criterios, prioridadeSorteio);
  } else {
    const porBloco = {};
    for (const c of classificados) {
      (porBloco[c.posGrupo] = porBloco[c.posGrupo] || []).push(c);
    }
    ranking = [];
    for (const pos of Object.keys(porBloco).map(Number).sort((a, b) => a - b)) {
      ranking.push(...ordenarPorCriterios(porBloco[pos], jogos, criterios, prioridadeSorteio));
    }
  }

  // Override manual: o usuário pode reordenar livremente a Classificação
  // pela UI. O pool do override é TODAS as duplas (ranking + pendentes +
  // eliminadas) — assim qualquer dupla pode ser promovida ao mata-mata ou
  // movida pra fora. Depois do sort estável pela ordem do usuário, os
  // primeiros N (= tamanho original do ranking) viram seeds; o resto vira
  // pendentes/eliminadas (a UI decide visualmente).
  const ordemManual = Array.isArray(config.ordemManualClassificacao)
    ? config.ordemManualClassificacao : null;
  let pendentesFinal = pendentes;
  if (ordemManual && ordemManual.length) {
    const N = ranking.length;
    const inPool = new Set([...ranking, ...pendentes].map(s => s.id));
    const eliminadas = [];
    for (const g of Object.keys(cls.grupos)) {
      cls.grupos[g].forEach((s, i) => {
        if (!inPool.has(s.id)) {
          eliminadas.push({ ...s, posGrupo: i + 1, grupoOrigem: g });
        }
      });
    }
    const pool = [...ranking, ...pendentes, ...eliminadas];
    const peso = (id) => {
      const i = ordemManual.indexOf(id);
      return i === -1 ? Infinity : i;
    };
    pool.sort((a, b) => peso(a.id) - peso(b.id));
    ranking = pool.slice(0, N);
    // Com override ativo, não tem mais sentido marcar "pendentes" — o
    // usuário já decidiu quem entra e quem fica de fora. A UI mostra
    // todos os de fora como eliminados (vermelho).
    pendentesFinal = [];
  }

  ranking.forEach((s, i) => { s.seed = i + 1; });

  return {
    criterios,
    formulaAvg: cls.formulaAvg,
    pendentes: pendentesFinal,
    grupos: cls.grupos,
    ranking,
  };
}

module.exports = { calcularRankingGeral };
