// =============================================================================
// Motor de geração dos jogos da fase de grupos (formato todos-contra-todos).
// Cada grupo joga todos-contra-todos: n duplas geram n*(n-1)/2 confrontos.
// Função pura — não toca no banco; quem persiste é o repositório de jogo.
// =============================================================================

// Devolve os pares de índices [i, j] (com i < j) na ordem das rodadas do
// método do círculo (round-robin). É a ordem usada no regulamento: num
// grupo de 4, sai 1x4, 2x3 | 1x3, 2x4 | 1x2, 3x4. Para n ímpar entra um
// "bye" (-1) que apenas folga uma dupla por rodada.
function paresRoundRobin(n) {
  // Grupo de 3: o método do círculo geraria 2x3, 1x3, 1x2; o regulamento
  // NCT usa 1x3, 2x3, 1x2 (cada dupla folga uma rodada — folga a 2, a 1, a 3).
  if (n === 3) return [[0, 2], [1, 2], [0, 1]];

  const arr = [];
  for (let i = 0; i < n; i++) arr.push(i);
  if (arr.length % 2 === 1) arr.push(-1);
  const m = arr.length;
  const fixo = arr[0];
  let rot = arr.slice(1);

  const pares = [];
  for (let r = 0; r < m - 1; r++) {
    const fila = [fixo, ...rot];
    for (let i = 0; i < m / 2; i++) {
      let a = fila[i];
      let b = fila[m - 1 - i];
      if (a === -1 || b === -1) continue;          // dupla de folga na rodada
      if (a > b) { const t = a; a = b; b = t; }    // menor índice é a dupla1
      pares.push([a, b]);
    }
    // rotaciona mantendo a primeira posição fixa: o último vai para a frente.
    rot = [rot[rot.length - 1], ...rot.slice(0, -1)];
  }
  return pares;
}

/**
 * Gera os confrontos de todos-contra-todos de cada grupo, na ordem de
 * rodadas do regulamento.
 * @param {Array} duplas - lista de { id, grupo, ... }, já ordenada por código
 *   dentro de cada grupo. Duplas sem grupo (nulo/vazio) são ignoradas.
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
    for (const [i, j] of paresRoundRobin(lista.length)) {
      confrontos.push({ grupo, dupla1Id: lista[i].id, dupla2Id: lista[j].id });
    }
  }
  return confrontos;
}

// =============================================================================
// Formato dupla eliminatória dentro do grupo (grupos de 4 duplas).
// =============================================================================

// Estrutura fixa da dupla eliminatória de um grupo de 4 (5 jogos). As duplas
// entram como seeds 1..4 (ordem das duplas no grupo = ordem dos códigos
// A1..A4). `ordem` é o índice do jogo dentro do grupo. Cada jogo informa ou
// as duas duplas (seeds) ou de quais jogos vêm o vencedor/perdedor (origem).
//   J0: seed1 x seed4        J1: seed2 x seed3        (rodada inicial)
//   J2: vencedor J0 x vencedor J1    (vencedores entre si)
//   J3: perdedor J0 x perdedor J1    (perdedores entre si)
//   J4: perdedor J2 x vencedor J3    (repescagem)
// Sem grande final: o regulamento classifica o 1º do grupo como o invicto
// (vencedor de J2, 2V/0D) e o 2º como o vencedor de J4 (2V/1D).
const TEMPLATE_DUPLA_ELIM_4 = [
  { ordem: 0, seeds: [0, 3] },
  { ordem: 1, seeds: [1, 2] },
  { ordem: 2, origem1: [0, 'vencedor'], origem2: [1, 'vencedor'] },
  { ordem: 3, origem1: [0, 'perdedor'], origem2: [1, 'perdedor'] },
  { ordem: 4, origem1: [2, 'perdedor'], origem2: [3, 'vencedor'] },
];

/**
 * Gera os jogos da dupla eliminatória de cada grupo. Exige grupos de 4.
 * @param {Array} duplas - lista de { id, grupo, ... } ordenada por código
 *   dentro de cada grupo. Duplas sem grupo são ignoradas.
 * @returns {Array} jogos: [{ grupo, ordem, dupla1Id?, dupla2Id?,
 *   origem1?: { ordem, tipo }, origem2?: { ordem, tipo } }]
 * @throws se algum grupo não tiver exatamente 4 duplas.
 */
function gerarDuplaEliminatoria(duplas) {
  const porGrupo = {};
  for (const d of duplas) {
    if (!d.grupo) continue;
    (porGrupo[d.grupo] = porGrupo[d.grupo] || []).push(d);
  }

  const jogos = [];
  for (const grupo of Object.keys(porGrupo).sort()) {
    const lista = porGrupo[grupo];
    if (lista.length !== 4) {
      throw new Error('O formato dupla eliminatória exige grupos de 4 duplas. '
        + `O grupo ${grupo} tem ${lista.length}.`);
    }
    for (const t of TEMPLATE_DUPLA_ELIM_4) {
      const j = { grupo, ordem: t.ordem };
      if (t.seeds) {
        j.dupla1Id = lista[t.seeds[0]].id;
        j.dupla2Id = lista[t.seeds[1]].id;
      } else {
        j.origem1 = { ordem: t.origem1[0], tipo: t.origem1[1] };
        j.origem2 = { ordem: t.origem2[0], tipo: t.origem2[1] };
      }
      jogos.push(j);
    }
  }
  return jogos;
}

module.exports = { gerarConfrontos, paresRoundRobin, gerarDuplaEliminatoria };
