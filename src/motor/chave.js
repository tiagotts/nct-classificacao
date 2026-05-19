// =============================================================================
// Motor da chave do mata-mata — eliminação simples com disputa de 3º lugar.
// É o formato do regulamento NCT (itens 9-12), diferente da dupla eliminação
// do antigo src/motor-chave-dupla.js.
//
// Para N classificados (N ∈ {4, 8, 16}):
//   - Rodada 1 ............ N/2 jogos, a partir dos cruzamentos das seeds
//   - Rodadas seguintes ... vencedores avançam, pareados em sequência
//   - Final (1º lugar) .... último jogo, entre os vencedores das semis
//   - Disputa de 3º lugar . entre os perdedores das semis
// Total: N jogos.
//
// N = 6 é um caso especial (chave com bye): as 2 melhores seeds vão direto
// à semifinal; as seeds 3-6 jogam as quartas. Usado quando dois grupos
// classificam três duplas cada (campeão de grupo com bye).
//
// Cada partida traz slot1/slot2, que indicam a origem da dupla:
//   { seed: n }                       -> a dupla de seed n entra direto
//   { origem: 'R1J2', tipo: 'vencedor' | 'perdedor' } -> vem de outra partida
// =============================================================================

const TAMANHOS_SUPORTADOS = [4, 8, 16];

// Ordem canônica das seeds na chave: N=4 -> [1,4,2,3];
// N=8 -> [1,8,4,5,2,7,3,6]; etc. (1 enfrenta a pior seed, e assim por diante).
function seedPositions(n) {
  if (n === 1) return [1];
  const metade = seedPositions(n / 2);
  const res = [];
  for (const s of metade) {
    res.push(s);
    res.push(n + 1 - s);
  }
  return res;
}

// Rótulo da fase conforme o número de jogos da rodada.
function nomeFase(numJogos) {
  if (numJogos === 1) return 'final';
  if (numJogos === 2) return 'semi';
  if (numJogos === 4) return 'quartas';
  return 'oitavas';
}

// Chave de 6 com bye: as seeds 1 e 2 entram direto na semifinal; as seeds
// 3-6 jogam as quartas. opts.cruzamentos define os pares das quartas.
function gerarChave6(opts) {
  let cruz = opts.cruzamentos;
  if (!Array.isArray(cruz) || cruz.length !== 2) cruz = [[3, 6], [4, 5]];
  return {
    N: 6,
    partidas: [
      { id: 'R1J1', rodada: 1, fase: 'quartas',
        slot1: { seed: cruz[0][0] }, slot2: { seed: cruz[0][1] } },
      { id: 'R1J2', rodada: 1, fase: 'quartas',
        slot1: { seed: cruz[1][0] }, slot2: { seed: cruz[1][1] } },
      { id: 'R2J1', rodada: 2, fase: 'semi',
        slot1: { seed: 1 }, slot2: { origem: 'R1J1', tipo: 'vencedor' } },
      { id: 'R2J2', rodada: 2, fase: 'semi',
        slot1: { seed: 2 }, slot2: { origem: 'R1J2', tipo: 'vencedor' } },
      { id: 'TERCEIRO', rodada: 3, fase: 'terceiro',
        slot1: { origem: 'R2J1', tipo: 'perdedor' },
        slot2: { origem: 'R2J2', tipo: 'perdedor' } },
      { id: 'R3J1', rodada: 3, fase: 'final',
        slot1: { origem: 'R2J1', tipo: 'vencedor' },
        slot2: { origem: 'R2J2', tipo: 'vencedor' } },
    ],
  };
}

/**
 * Gera a chave do mata-mata.
 * @param {number} n - quantidade de classificados (4, 6, 8 ou 16)
 * @param {Object} opts - { cruzamentos?: [[seedA, seedB], ...] } para a rodada 1
 * @returns {Object} { partidas, N }
 */
function gerarChave(n, opts = {}) {
  if (n === 6) return gerarChave6(opts);
  if (!TAMANHOS_SUPORTADOS.includes(n)) {
    throw new Error(`Mata-mata exige 4, 6, 8 ou 16 duplas; recebeu ${n}.`);
  }

  // Cruzamentos da rodada 1: usa os informados ou deriva da ordem canônica.
  let cruzamentos = opts.cruzamentos;
  if (!Array.isArray(cruzamentos) || cruzamentos.length !== n / 2) {
    const pos = seedPositions(n);
    cruzamentos = [];
    for (let i = 0; i < n / 2; i++) cruzamentos.push([pos[2 * i], pos[2 * i + 1]]);
  }

  const k = Math.log2(n);
  const partidas = [];

  // Rodada 1: jogos a partir das seeds.
  let rodadaAnterior = [];
  cruzamentos.forEach((par, i) => {
    const id = `R1J${i + 1}`;
    partidas.push({
      id, rodada: 1, fase: nomeFase(n / 2),
      slot1: { seed: par[0] }, slot2: { seed: par[1] },
    });
    rodadaAnterior.push(id);
  });

  // Rodadas 2..k: vencedores das partidas anteriores, pareados em sequência.
  for (let r = 2; r <= k; r++) {
    const numJogos = n / (2 ** r);
    const atual = [];
    for (let i = 0; i < numJogos; i++) {
      const id = `R${r}J${i + 1}`;
      partidas.push({
        id, rodada: r, fase: nomeFase(numJogos),
        slot1: { origem: rodadaAnterior[2 * i], tipo: 'vencedor' },
        slot2: { origem: rodadaAnterior[2 * i + 1], tipo: 'vencedor' },
      });
      atual.push(id);
    }
    rodadaAnterior = atual;
  }

  // Disputa de 3º lugar: perdedores das duas semifinais (rodada k-1).
  const semis = partidas.filter(p => p.rodada === k - 1);
  if (semis.length === 2) {
    partidas.push({
      id: 'TERCEIRO', rodada: k, fase: 'terceiro',
      slot1: { origem: semis[0].id, tipo: 'perdedor' },
      slot2: { origem: semis[1].id, tipo: 'perdedor' },
    });
  }

  return { partidas, N: n };
}

module.exports = { gerarChave, seedPositions, TAMANHOS_SUPORTADOS };
