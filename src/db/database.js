// =============================================================================
// Camada de conexão com o banco SQLite.
// Abre a conexão, configura os pragmas e aplica as migrações pendentes.
// Usado no processo main do Electron e também pelos testes (node tests/...).
// =============================================================================

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DIR_MIGRACOES = path.join(__dirname, 'migrations');

let db = null;
let caminhoAtual = null;

// Aplica as migrações de migrations/ ainda não rodadas.
// O controle de versão usa o PRAGMA user_version do próprio SQLite:
// cada arquivo é nomeado NNNN_descricao.sql, e os 4 primeiros dígitos
// são o número da versão. Roda só os arquivos com número > user_version.
function aplicarMigracoes() {
  const arquivos = fs.readdirSync(DIR_MIGRACOES)
    .filter(f => /^\d{4}_.*\.sql$/.test(f))
    .sort();

  const versaoAtual = db.pragma('user_version', { simple: true });

  for (const arquivo of arquivos) {
    const versao = Number(arquivo.slice(0, 4));
    if (versao <= versaoAtual) continue;
    const sql = fs.readFileSync(path.join(DIR_MIGRACOES, arquivo), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${versao}`);
    })();
  }
}

// Abre (ou cria) o banco no caminho informado e aplica as migrações.
// Passe ':memory:' para um banco em memória (usado nos testes).
//
// foreign_keys fica DESLIGADO durante as migrações (precisa estar fora de
// transação, e algumas migrações recriam tabelas que têm filhas via FK —
// o caso clássico do "12-step ALTER TABLE" do SQLite). Após aplicar tudo,
// religamos e rodamos foreign_key_check para alertar caso algo tenha
// quebrado a integridade.
function abrir(caminhoBanco) {
  db = new Database(caminhoBanco);
  caminhoAtual = caminhoBanco;
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = OFF');
  aplicarMigracoes();
  const violacoes = db.pragma('foreign_key_check');
  if (Array.isArray(violacoes) && violacoes.length) {
    console.warn('Violações de FK após migrações:', violacoes);
  }
  db.pragma('foreign_keys = ON');
  return db;
}

// Retorna a conexão já aberta. Lança erro se abrir() ainda não foi chamado.
function getDb() {
  if (!db) throw new Error('Banco não inicializado: chame abrir() antes.');
  return db;
}

// Caminho do arquivo do banco em uso (usado pelo módulo de backup).
function caminhoArquivo() {
  return caminhoAtual;
}

function fechar() {
  if (db) { db.close(); db = null; }
}

module.exports = { abrir, getDb, fechar, caminhoArquivo };
