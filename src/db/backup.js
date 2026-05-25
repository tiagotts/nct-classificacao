// =============================================================================
// Backup do banco de dados no GitHub.
//
// O backup é sempre gravado no mesmo caminho do repositório (NCT_DB_PATH);
// cada `fazerBackup` vira um commit novo — o histórico do git funciona como
// histórico de versões. A restauração baixa o arquivo de um commit
// específico (ou do HEAD) e o grava por cima do banco atual.
//
// Antes de copiar o .db, fazemos `wal_checkpoint(TRUNCATE)` para garantir um
// snapshot consistente (better-sqlite3 usa WAL, então os dados podem estar
// pendentes no arquivo -wal).
// =============================================================================

const fs = require('fs');
const path = require('path');
const { getDb, fechar, abrir, caminhoArquivo } = require('./database');
const github = require('../publicacao/github');

const NCT_DB_PATH = 'nct.db'; // caminho do arquivo dentro do repo de backup

function validarCfg(cfg) {
  if (!cfg || !cfg.token || !cfg.owner || !cfg.repo) {
    throw new Error('Configure usuário, repositório e token do backup primeiro.');
  }
  return { ...cfg, branch: cfg.branch || 'main' };
}

// Faz um backup do banco atual no repositório configurado.
// Devolve { sha, url } do commit criado.
async function fazerBackup(cfgRaw) {
  const cfg = validarCfg(cfgRaw);
  const caminhoBanco = caminhoArquivo();
  if (!caminhoBanco) throw new Error('Banco não está aberto.');

  // Garante que tudo do WAL esteja no arquivo principal antes de copiar.
  try { getDb().pragma('wal_checkpoint(TRUNCATE)'); } catch { /* ignora */ }

  const conteudo = fs.readFileSync(caminhoBanco);
  const ts = new Date().toISOString();
  const resposta = await github.publicar({
    token: cfg.token, owner: cfg.owner, repo: cfg.repo, branch: cfg.branch,
    caminho: NCT_DB_PATH, conteudo,
    mensagem: cfgRaw.mensagem || `Backup do banco em ${ts}`,
  });
  return {
    sha: resposta && resposta.commit && resposta.commit.sha,
    url: resposta && resposta.commit && resposta.commit.html_url,
    data: ts,
  };
}

// Lista os últimos commits do arquivo de backup no repo (mais novos primeiro).
async function listarBackups(cfgRaw) {
  const cfg = validarCfg(cfgRaw);
  return github.listarCommits({
    token: cfg.token, owner: cfg.owner, repo: cfg.repo,
    branch: cfg.branch, caminho: NCT_DB_PATH, qtd: 30,
  });
}

// Baixa o backup do commit informado (ou do HEAD) e substitui o banco atual.
// Importante: fecha a conexão antes de sobrescrever e apaga os arquivos
// auxiliares (-wal/-shm) — eles seriam inconsistentes com o novo .db.
async function restaurarBackup(cfgRaw, sha) {
  const cfg = validarCfg(cfgRaw);
  const caminhoBanco = caminhoArquivo();
  if (!caminhoBanco) throw new Error('Banco não está aberto.');

  const { conteudo } = await github.baixar({
    token: cfg.token, owner: cfg.owner, repo: cfg.repo,
    caminho: NCT_DB_PATH, ref: sha || cfg.branch,
  });
  if (!conteudo || !conteudo.length) {
    throw new Error('O backup baixado veio vazio.');
  }

  fechar();
  for (const sfx of ['-wal', '-shm']) {
    try { fs.unlinkSync(caminhoBanco + sfx); } catch { /* arquivo pode não existir */ }
  }
  fs.writeFileSync(caminhoBanco, conteudo);
  abrir(caminhoBanco);
  return { ok: true, sha: sha || null };
}

module.exports = { fazerBackup, listarBackups, restaurarBackup };
