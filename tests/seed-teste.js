// Popula o banco do app com dados de teste: 1 temporada, 1 etapa, 1 categoria
// (Sub 18) com 4 grupos, 32 atletas e 16 duplas (4 por grupo).
// Escreve no MESMO banco que o app usa, então os dados aparecem ao abrir o app.
// Rodar com:  npm run seed
//
// Pode ser rodado mais de uma vez — cada execução cria uma nova temporada/etapa
// marcada como "(teste)".

const os = require('os');
const path = require('path');
const fs = require('fs');

const { abrir, fechar } = require('../src/db/database');
const temporadaRepo = require('../src/db/repositorios/temporada');
const etapaRepo = require('../src/db/repositorios/etapa');
const ecRepo = require('../src/db/repositorios/etapa-categoria');
const categoriaRepo = require('../src/db/repositorios/categoria');
const atletaRepo = require('../src/db/repositorios/atleta');
const duplaRepo = require('../src/db/repositorios/dupla');

// Caminho do banco usado pelo app: app.getPath('userData') no macOS.
const userData = path.join(
  os.homedir(), 'Library', 'Application Support', 'nct-classificacao');
fs.mkdirSync(userData, { recursive: true });
const caminhoBanco = path.join(userData, 'nct.db');

const NOMES = ['João','Pedro','Lucas','Gabriel','Mateus','Rafael','Bruno','Felipe',
  'Gustavo','Thiago','Diego','Caio','Vitor','Leonardo','André','Marcelo','Rodrigo',
  'Fernando','Daniel','Eduardo','Henrique','Igor','Murilo','Otávio','Renato','Samuel',
  'Tomás','Vinícius','Wesley','Yuri','Arthur','Bernardo'];
const SOBRENOMES = ['Silva','Souza','Oliveira','Santos','Pereira','Lima','Costa',
  'Ferreira','Almeida','Rodrigues','Gomes','Martins','Araújo','Barbosa','Ribeiro',
  'Carvalho','Nascimento','Moraes','Dias','Teixeira','Cardoso','Rocha','Mendes',
  'Freitas','Pinto','Cavalcanti','Monteiro','Vieira','Correia','Nunes','Ramos','Azevedo'];

function embaralhar(arr) {
  const c = arr.slice();
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

abrir(caminhoBanco);

const temporada = temporadaRepo.criar({ nome: 'Circuito NCT 2025 (teste)', ano: 2025 });
const etapa = etapaRepo.criar({
  temporadaId: temporada.id, nome: '4ª Etapa (teste)',
  dataInicio: '2025-08-01', local: 'Arena 61',
});
const cat = categoriaRepo.listar().find(c => c.slug === 'sub18');
const ec = ecRepo.criar({
  etapaId: etapa.id, categoriaId: cat.id, tipo: 'masculino', numGrupos: 4 });

// 32 atletas com nomes únicos (primeiro nome embaralhado + sobrenome embaralhado).
const nomes = embaralhar(NOMES);
const sobrenomes = embaralhar(SOBRENOMES);
const atletas = [];
for (let i = 0; i < 32; i++) {
  atletas.push(atletaRepo.criar({ nome: `${nomes[i]} ${sobrenomes[i]}` }));
}

// 16 duplas: grupos A-D, 4 duplas por grupo, dois atletas cada.
const grupos = ['A', 'B', 'C', 'D'];
let idxAtleta = 0;
let totalDuplas = 0;
for (const g of grupos) {
  for (let n = 1; n <= 4; n++) {
    duplaRepo.criar({
      etapaCategoriaId: ec.id,
      codigo: `${g}${n}`,
      grupo: g,
      atleta1Id: atletas[idxAtleta++].id,
      atleta2Id: atletas[idxAtleta++].id,
    });
    totalDuplas++;
  }
}

fechar();

console.log('Dados de teste criados:');
console.log(`  Temporada: ${temporada.nome} (id ${temporada.id})`);
console.log(`  Etapa:     ${etapa.nome} (id ${etapa.id})`);
console.log(`  Categoria: ${cat.nome} masculino, 4 grupos (etapa_categoria id ${ec.id})`);
console.log(`  Atletas:   ${atletas.length}`);
console.log(`  Duplas:    ${totalDuplas}`);
console.log(`Banco: ${caminhoBanco}`);
