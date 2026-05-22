// =============================================================================
// Distribuição das duplas pelos grupos em serpentina, dirigida pelo ranking.
// Função pura — recebe a quantidade de duplas e de grupos e devolve, na ordem
// do ranking (1º ao Nº), o código e o grupo de cada dupla.
//
// Regra do regulamento NCT:
//   - Serpentina: 1º vai ao grupo A, 2º ao B, ... ao chegar no último grupo a
//     distribuição "volta na linha de baixo" (sentido invertido), e assim por
//     diante (modelo serpente / boustrophedon).
//   - Com nº PAR de grupos a serpentina corre pura até o fim — a última linha
//     já cai naturalmente invertida e o último do ranking fica no grupo do 1º.
//   - Com nº ÍMPAR de grupos a última linha precisa ser forçada no sentido
//     invertido (senão o último cairia no grupo errado).
//
// Usado pela tela de duplas (window.distribuirEmGrupos) e pelos testes Node.
// =============================================================================

/**
 * @param {number} numDuplas  quantidade de duplas (na ordem do ranking)
 * @param {number} numGrupos  quantidade de grupos
 * @returns {Array<{codigo:string, grupo:string}>} um item por dupla, do 1º ao Nº
 */
function distribuirEmGrupos(numDuplas, numGrupos) {
  const ng = numGrupos;
  const resultado = [];
  if (!ng || ng < 1) return resultado;

  const contador = {};
  const ultimaRodada = Math.floor((numDuplas - 1) / ng);
  const gruposImpares = ng % 2 === 1;

  for (let i = 0; i < numDuplas; i++) {
    const rodada = Math.floor(i / ng);
    const pos = i % ng;
    const inverter = rodada % 2 === 1
      || (gruposImpares && rodada === ultimaRodada);
    const indiceGrupo = inverter ? ng - 1 - pos : pos;
    const letra = String.fromCharCode(65 + indiceGrupo);
    contador[letra] = (contador[letra] || 0) + 1;
    resultado.push({ codigo: `${letra}${contador[letra]}`, grupo: letra });
  }
  return resultado;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { distribuirEmGrupos };
}
if (typeof window !== 'undefined') {
  window.distribuirEmGrupos = distribuirEmGrupos;
}
