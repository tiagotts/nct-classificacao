// =============================================================================
// Motor de pontuação e ranking de temporada.
// - Converte a colocação final de uma dupla em pontos, por faixas.
// - Soma os pontos por atleta ao longo das etapas da temporada.
//
// Faixas padrão (regulamento NCT, item 15): 1º=200, 2º=180, 3º=160, 4º=140,
// 5º-8º=120, 9º em diante=100. Assumem mata-mata de 8 duplas; outras
// configurações devem ajustar a tabela de pontuação da etapa_categoria.
// =============================================================================

const FAIXAS_PADRAO = [
  { ini: 1, fim: 1, pontos: 200 },
  { ini: 2, fim: 2, pontos: 180 },
  { ini: 3, fim: 3, pontos: 160 },
  { ini: 4, fim: 4, pontos: 140 },
  { ini: 5, fim: 8, pontos: 120 },
  { ini: 9, fim: 9999, pontos: 100 },
];

// Pontos correspondentes a uma colocação final, segundo as faixas.
function pontosDaColocacao(colocacao, faixas = FAIXAS_PADRAO) {
  if (colocacao == null) return null;
  const faixa = faixas.find(f => colocacao >= f.ini && colocacao <= f.fim);
  return faixa ? faixa.pontos : null;
}

// Desempate do ranking de temporada (regulamento, item 1): mais pontos;
// empate em pontos resolve por quem tem mais melhores colocações (mais 1ºs
// lugares, depois 2ºs, etc.); persistindo, fica empatado (sorteio).
function compararAtletas(a, b) {
  if (b.pontos !== a.pontos) return b.pontos - a.pontos;
  const maxPos = Math.max(0, ...a.colocacoes, ...b.colocacoes);
  for (let pos = 1; pos <= maxPos; pos++) {
    const ca = a.colocacoes.filter(c => c === pos).length;
    const cb = b.colocacoes.filter(c => c === pos).length;
    if (ca !== cb) return cb - ca;
  }
  return 0; // empate real -> sorteio
}

/**
 * Calcula o ranking de temporada por atleta para uma categoria.
 * Cada dupla rende os seus pontos para os DOIS atletas.
 * @param {Array} resultados - [{ atleta1_id, atleta2_id, pontos_ganhos, colocacao_final }]
 * @param {Object} nomePorAtleta - mapa { atletaId: nome }
 * @returns {Array} atletas ordenados, com { posicao, atletaId, nome, pontos,
 *   etapas, colocacoes }
 */
function calcularRankingTemporada(resultados, nomePorAtleta = {}) {
  const porAtleta = new Map();
  const garantir = (id) => {
    if (!porAtleta.has(id)) {
      porAtleta.set(id, {
        atletaId: id, nome: nomePorAtleta[id] || `Atleta ${id}`,
        pontos: 0, etapas: 0, colocacoes: [],
      });
    }
    return porAtleta.get(id);
  };

  for (const r of resultados) {
    if (r.pontos_ganhos == null) continue; // dupla ainda sem colocação apurada
    for (const atletaId of [r.atleta1_id, r.atleta2_id]) {
      if (atletaId == null) continue;
      const a = garantir(atletaId);
      a.pontos += r.pontos_ganhos;
      a.etapas += 1;
      if (r.colocacao_final != null) a.colocacoes.push(r.colocacao_final);
    }
  }

  const lista = [...porAtleta.values()].sort(compararAtletas);
  lista.forEach((a, i) => { a.posicao = i + 1; });
  return lista;
}

module.exports = { FAIXAS_PADRAO, pontosDaColocacao, calcularRankingTemporada };
