// =============================================================================
// Motor de geração dos jogos da fase de grupos.
// Cada grupo joga todos-contra-todos: n duplas geram n*(n-1)/2 confrontos.
// Função pura — não toca no banco; quem persiste é o repositório de jogo.
// =============================================================================

/**
 * Gera os confrontos de todos-contra-todos de cada grupo.
 * @param {Array} duplas - lista de { id, grupo, ... }. Duplas sem grupo
 *   (grupo nulo/vazio) são ignoradas.
 * @returns {Array} confrontos na ordem de jogo: [{ grupo, dupla1Id, dupla2Id }]
 *   agrupados por grupo (A, B, C...).
 */
function gerarConfrontos(duplas) {
  const porGrupo = {};
  for (const d of duplas) {
    if (!d.grupo) continue;
    (porGrupo[d.grupo] = porGrupo[d.grupo] || []).push(d);
  }

  const confrontos = [];
  for (const grupo of Object.keys(porGrupo).sort()) {
    const lista = porGrupo[grupo];
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        confrontos.push({ grupo, dupla1Id: lista[i].id, dupla2Id: lista[j].id });
      }
    }
  }
  return confrontos;
}

module.exports = { gerarConfrontos };
