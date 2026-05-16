// Imprime a estrutura completa da chave dupla em formato legível.
// Rodar com:  node tests/dump-chave.js [N]
// Exemplos:   node tests/dump-chave.js 4
//             node tests/dump-chave.js 16

const { gerarChaveDupla } = require('../src/motor-chave-dupla');

const N = Number(process.argv[2]) || 16;
const seeds = Array.from({length: N}, (_, i) => ({
  seed: i + 1,
  dupla: { codigo: `D${i+1}`, nome: `Dupla #${i+1}` }
}));

const { partidas, totalPartidas } = gerarChaveDupla(seeds);

function origem(slot) {
  if (slot.seed != null) return `seed ${String(slot.seed).padStart(2)}`;
  return `${slot.fromMatch}(${slot.as})`;
}
function destino(p) {
  const v = p.proxV ? `→V:${p.proxV}` : '→ CAMPEÃO';
  const pp = p.proxP ? `→P:${p.proxP}` : '→ eliminado';
  return `${v.padEnd(14)} ${pp}`;
}

const fases = [];
const seen = new Set();
partidas.forEach(p => { if (!seen.has(p.fase)) { fases.push(p.fase); seen.add(p.fase); } });

console.log(`\n┌─────────────────────────────────────────────────────────────────────────┐`);
console.log(`│   ESTRUTURA DA CHAVE DUPLA — ${N} DUPLAS (${totalPartidas} partidas)`.padEnd(73) + '│');
console.log(`└─────────────────────────────────────────────────────────────────────────┘\n`);

fases.forEach(fase => {
  console.log(`▸ ${fase}`);
  partidas.filter(p => p.fase === fase).forEach(p => {
    console.log(`   ${p.id.padEnd(4)}  ${origem(p.slot1).padEnd(11)} × ${origem(p.slot2).padEnd(11)}  ${destino(p)}`);
  });
  console.log('');
});

console.log('Legenda:');
console.log('   seed N    = dupla com seed N entra direto');
console.log('   Wn(V|P)   = vencedor (V) ou perdedor (P) da partida Wn');
console.log('   →V:Xn     = vencedor segue para a partida Xn');
console.log('   →P:Xn     = perdedor segue para a partida Xn');
console.log('   →eliminado= segunda derrota, está fora do torneio\n');
