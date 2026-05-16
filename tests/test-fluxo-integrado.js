// Teste de integração: simula o fluxo completo do app
// (grupos classificados → seeds → chave dupla) usando o motor.
// Rodar com:  node tests/test-fluxo-integrado.js

const { gerarChaveDupla, mapearSeedsGrupoChave } = require('../src/motor-chave-dupla');

let ok = 0, fail = 0;
function t(nome, fn) {
  try { fn(); console.log(`  ✅ ${nome}`); ok++; }
  catch (err) { console.log(`  ❌ ${nome}\n     ${err.message}`); fail++; }
}
function eq(a, b, msg = '') {
  if (a !== b) throw new Error(`${msg} esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)}`);
}

// Simula a saída do motor de fase de grupos com 4 grupos de 4 (= 16 duplas)
function montaCenarioCompleto(){
  const groups = {};
  let dupId = 1;
  for (const letra of ['A','B','C','D']) {
    groups[letra] = [];
    for (let pos = 0; pos < 4; pos++) {
      groups[letra].push({
        cod: `${letra}${pos+1}`,
        nome: `Dupla ${letra}${pos+1}`,
        grupo: letra,
        V: 3 - pos,
        AVG: 2.5 - pos * 0.4,
        PP: 80 - pos * 5,
      });
    }
  }
  return groups;
}

console.log('\n=== TESTES — Fluxo integrado: grupos → seeds → chave dupla ===\n');

t('4 grupos de 4 → em-blocos → chave dupla de 16 (30 partidas)', () => {
  const groups = montaCenarioCompleto();
  const seeds = mapearSeedsGrupoChave(groups, { regra: 'em-blocos', N: 16 });
  eq(seeds.length, 16);
  // Seeds 1-4: todos 1ºs
  for (let i = 0; i < 4; i++) {
    if (!seeds[i].origem.startsWith('1º')) throw new Error(`Seed ${i+1} não é 1º`);
  }
  // Gera chave
  const { partidas, totalPartidas } = gerarChaveDupla(
    seeds.map(s => ({ seed: s.seed, dupla: s.dupla }))
  );
  eq(totalPartidas, 30);

  // W1 deve ter seed 1 vs seed 16
  const w1 = partidas.find(p => p.id === 'W1');
  eq(w1.slot1.seed, 1);
  eq(w1.slot2.seed, 16);
  // Seed 1 (1º de algum grupo) e seed 16 (4º de algum grupo)
  if (!seeds[0].origem.startsWith('1º')) throw new Error('seed 1 deveria ser 1º');
  if (!seeds[15].origem.startsWith('4º')) throw new Error('seed 16 deveria ser 4º');
});

t('Apenas 12 classificadas (3 grupos de 4) com chave dupla de 16 → erro detectado', () => {
  const groups = {
    A: Array.from({length:4}, (_,i) => ({cod:`A${i+1}`, V:3-i, AVG:2-i*0.3, PP:60-i*5})),
    B: Array.from({length:4}, (_,i) => ({cod:`B${i+1}`, V:3-i, AVG:2-i*0.3, PP:60-i*5})),
    C: Array.from({length:4}, (_,i) => ({cod:`C${i+1}`, V:3-i, AVG:2-i*0.3, PP:60-i*5})),
  };
  const seeds = mapearSeedsGrupoChave(groups, { regra: 'em-blocos', N: 16 });
  eq(seeds.length, 12, 'só consegue mapear 12 seeds');
  // Tentar gerar chave de 16 deve falhar
  let throwed = false;
  try {
    gerarChaveDupla(seeds.slice(0, 16).map(s => ({seed:s.seed, dupla:s.dupla})));
  } catch { throwed = true; }
  if (!throwed) throw new Error('Deveria ter lançado erro por seeds insuficientes');
});

t('3 grupos de 4 com chave dupla de 8 → funciona (3 de cada grupo + os 2 melhores 3ºs vão para chave?)', () => {
  // Aqui não usamos repescagem; em-blocos pega 2 de cada grupo (= 6) + 2 dos 3ºs (= 8 total)
  const groups = {
    A: Array.from({length:4}, (_,i) => ({cod:`A${i+1}`, V:3-i, AVG:2.5-i*0.3, PP:60-i*5})),
    B: Array.from({length:4}, (_,i) => ({cod:`B${i+1}`, V:3-i, AVG:2.4-i*0.3, PP:58-i*5})),
    C: Array.from({length:4}, (_,i) => ({cod:`C${i+1}`, V:3-i, AVG:2.3-i*0.3, PP:55-i*5})),
  };
  const seeds = mapearSeedsGrupoChave(groups, { regra: 'em-blocos', N: 8 });
  eq(seeds.length, 8);
  const { totalPartidas } = gerarChaveDupla(seeds.map(s => ({seed:s.seed, dupla:s.dupla})));
  eq(totalPartidas, 14);
});

t('Regra "global" prioriza pontuação sobre posição-no-grupo', () => {
  const groups = {
    // Grupo A muito forte: 2º do A tem mais V que 1º do B
    A: [
      { cod:'A1', V:3, AVG:2.5, PP:70 },
      { cod:'A2', V:2, AVG:1.8, PP:60 },  // 2º do A
      { cod:'A3', V:1, AVG:1.0, PP:50 },
      { cod:'A4', V:0, AVG:0.6, PP:40 },
    ],
    B: [
      { cod:'B1', V:1, AVG:1.3, PP:55 },  // 1º do B mas com V baixo
      { cod:'B2', V:0, AVG:0.5, PP:35 },
      { cod:'B3', V:0, AVG:0.4, PP:30 },
      { cod:'B4', V:0, AVG:0.3, PP:25 },
    ],
  };
  const emBlocos = mapearSeedsGrupoChave(groups, { regra: 'em-blocos', N: 4 });
  const global = mapearSeedsGrupoChave(groups, { regra: 'global', N: 4 });

  // Em blocos: seeds 1-2 = 1ºs (A1, B1); seeds 3-4 = 2ºs (A2, B2)
  eq(emBlocos[0].dupla.cod, 'A1');
  eq(emBlocos[1].dupla.cod, 'B1');
  eq(emBlocos[2].dupla.cod, 'A2');

  // Global: A2 (2V) passa na frente de B1 (1V)
  eq(global[0].dupla.cod, 'A1');
  eq(global[1].dupla.cod, 'A2', 'A2 deveria vir antes de B1 no global');
  eq(global[2].dupla.cod, 'B1');
});

console.log(`\n=== ${ok} passou(aram), ${fail} falhou(aram) ===\n`);
process.exit(fail > 0 ? 1 : 0);
