// =============================================================================
// Motor do ranking de entrada de uma etapa — define a ordem das duplas que
// dirige a serpentina. Função pura.
//
// Regra (regulamento NCT):
//   1) Score da dupla = soma dos pontos dos dois atletas (pontos iniciais
//      cadastrados + pontos ganhos em etapas anteriores).
//   2) Desempate: compara as duplas atleta a atleta. Para cada dupla, ordena
//      seus 2 atletas pelo histórico de colocações (melhor primeiro), depois
//      compara o "melhor atleta" de A com o de B; persistindo, o "segundo
//      atleta" de cada uma.
//   3) Persistindo o empate: o motor marca a dupla com `sorteada: true` e
//      mantém a ordem natural. Quem resolve o empate é o usuário (sorteio
//      manual) — a tela exibe as duplas empatadas e permite reordenar.
//
// Histórico de um atleta = lista de colocação_final que ele teve em duplas
// de etapas anteriores na mesma temporada + categoria + tipo. "Melhor" é
// quem tem mais 1ºs lugares, depois 2ºs, etc.
// =============================================================================

// Compara duas listas de colocações: vence quem tiver mais 1ºs lugares;
// depois 2ºs, etc. Negativo: 'a' vem antes (melhor); positivo: 'b' antes.
function compararColocacoes(a, b) {
  const max = Math.max(0, ...a, ...b);
  for (let pos = 1; pos <= max; pos++) {
    const ca = a.filter(c => c === pos).length;
    const cb = b.filter(c => c === pos).length;
    if (ca !== cb) return cb - ca;
  }
  return 0;
}

// Ordena os 2 atletas de uma dupla do melhor histórico para o pior.
function ordenarAtletas(atletas, colocs) {
  return atletas
    .map(id => ({ id, col: colocs[id] || [] }))
    .sort((a, b) => compararColocacoes(a.col, b.col));
}

/**
 * Calcula o ranking de entrada da etapa.
 * @param {Array} duplas - [{ id, codigo, atleta1_id, atleta2_id, ... }]
 * @param {Object} opts - { pontosPorAtleta, colocacoesPorAtleta }
 * @returns {Array} duplas ordenadas, com { ...dupla, pos, score, sorteada }.
 */
function calcularRankingEntrada(duplas, opts = {}) {
  const pontos = opts.pontosPorAtleta || {};
  const colocs = opts.colocacoesPorAtleta || {};

  const lista = duplas.map(d => {
    const p1 = pontos[d.atleta1_id] || 0;
    const p2 = pontos[d.atleta2_id] || 0;
    return {
      ...d,
      pontos1: p1,
      pontos2: p2,
      score: p1 + p2,
      atletasOrd: ordenarAtletas([d.atleta1_id, d.atleta2_id], colocs),
    };
  });

  lista.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const c1 = compararColocacoes(a.atletasOrd[0].col, b.atletasOrd[0].col);
    if (c1 !== 0) return c1;
    const c2 = compararColocacoes(a.atletasOrd[1].col, b.atletasOrd[1].col);
    if (c2 !== 0) return c2;
    return 0; // empate total — sorteio manual
  });

  // Marca como `sorteada` cada bloco contíguo de duplas totalmente empatadas.
  // O motor NÃO escolhe a ordem — quem resolve o empate é o usuário, no app.
  const empatadas = (a, b) => a.score === b.score
    && compararColocacoes(a.atletasOrd[0].col, b.atletasOrd[0].col) === 0
    && compararColocacoes(a.atletasOrd[1].col, b.atletasOrd[1].col) === 0;
  let i = 0;
  while (i < lista.length) {
    let j = i + 1;
    while (j < lista.length && empatadas(lista[i], lista[j])) j++;
    if (j - i > 1) {
      for (let k = i; k < j; k++) lista[k].sorteada = true;
    }
    i = j;
  }

  lista.forEach((d, idx) => {
    d.pos = idx + 1;
    delete d.atletasOrd; // detalhe interno do desempate
  });
  return lista;
}

module.exports = { calcularRankingEntrada, compararColocacoes };
