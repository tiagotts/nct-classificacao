// =============================================================================
// Publicação no GitHub via API de conteúdo (Contents API).
// Cria ou atualiza um arquivo no repositório; o GitHub Pages republica sozinho.
// =============================================================================

const API = 'https://api.github.com';

function cabecalhos(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'nct-classificacao',
  };
}

/**
 * Cria ou atualiza um arquivo no repositório.
 * @param {Object} opts - { token, owner, repo, branch, caminho, conteudo, mensagem }
 * @returns {Promise<Object>} resposta da API do GitHub
 */
async function publicar({ token, owner, repo, branch, caminho, conteudo, mensagem }) {
  if (!token || !owner || !repo) {
    throw new Error('Informe usuário, repositório e token do GitHub.');
  }
  const url = `${API}/repos/${owner}/${repo}/contents/${caminho}`;
  const headers = cabecalhos(token);

  // Para atualizar um arquivo já existente é preciso enviar o seu sha atual.
  let sha;
  const consulta = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  if (consulta.status === 200) {
    sha = (await consulta.json()).sha;
  } else if (consulta.status === 401) {
    throw new Error('Token inválido ou sem permissão.');
  } else if (consulta.status !== 404) {
    throw new Error(`GitHub respondeu ${consulta.status} ao consultar o arquivo.`);
  }

  // Aceita conteúdo como string (texto, UTF-8) ou Buffer (binário, ex.: .db).
  const conteudoBase64 = Buffer.isBuffer(conteudo)
    ? conteudo.toString('base64')
    : Buffer.from(conteudo, 'utf8').toString('base64');
  const corpo = {
    message: mensagem,
    content: conteudoBase64,
    branch,
  };
  if (sha) corpo.sha = sha;

  const resposta = await fetch(url, {
    method: 'PUT', headers, body: JSON.stringify(corpo),
  });
  if (resposta.status !== 200 && resposta.status !== 201) {
    let detalhe = '';
    try { detalhe = (await resposta.json()).message || ''; } catch { /* ignore */ }
    throw new Error(`GitHub respondeu ${resposta.status}. ${detalhe}`.trim());
  }
  return resposta.json();
}

/**
 * Consulta o status da última geração (build) do GitHub Pages.
 * @param {Object} opts - { token, owner, repo }
 * @returns {Promise<Object|null>} { status, commit } — status é
 *   'built' | 'building' | 'errored'; null se ainda não há builds.
 */
async function statusUltimoBuild({ token, owner, repo }) {
  const resposta = await fetch(`${API}/repos/${owner}/${repo}/pages/builds/latest`,
    { headers: cabecalhos(token) });
  if (resposta.status === 404) return null; // sem builds / Pages não ativado
  if (resposta.status !== 200) {
    throw new Error(`GitHub respondeu ${resposta.status} ao consultar o build.`);
  }
  const j = await resposta.json();
  return { status: j.status, commit: j.commit };
}

/**
 * Baixa o conteúdo de um arquivo do repositório.
 * @param {Object} opts - { token, owner, repo, caminho, ref }
 *   ref: sha de commit, nome de branch ou tag (opcional — default branch).
 * @returns {Promise<{conteudo: Buffer, sha: string}>}
 */
async function baixar({ token, owner, repo, caminho, ref }) {
  const url = `${API}/repos/${owner}/${repo}/contents/${caminho}`
    + (ref ? `?ref=${encodeURIComponent(ref)}` : '');
  const resposta = await fetch(url, { headers: cabecalhos(token) });
  if (resposta.status === 401) {
    throw new Error('Token inválido ou sem permissão.');
  }
  if (resposta.status === 404) {
    throw new Error('Arquivo não encontrado no repositório.');
  }
  if (resposta.status !== 200) {
    throw new Error(`GitHub respondeu ${resposta.status} ao baixar o arquivo.`);
  }
  const j = await resposta.json();
  return {
    conteudo: Buffer.from(j.content || '', 'base64'),
    sha: j.sha,
  };
}

/**
 * Lista os commits que tocaram um arquivo do repositório (do mais recente
 * para o mais antigo). Útil para mostrar o histórico de backups.
 * @param {Object} opts - { token, owner, repo, caminho, branch, qtd }
 * @returns {Promise<Array<{sha, mensagem, data, autor}>>}
 */
async function listarCommits({ token, owner, repo, caminho, branch, qtd = 30 }) {
  const params = [
    `path=${encodeURIComponent(caminho)}`,
    `per_page=${qtd}`,
  ];
  if (branch) params.push(`sha=${encodeURIComponent(branch)}`);
  const url = `${API}/repos/${owner}/${repo}/commits?${params.join('&')}`;
  const resposta = await fetch(url, { headers: cabecalhos(token) });
  if (resposta.status === 401) {
    throw new Error('Token inválido ou sem permissão.');
  }
  if (resposta.status === 404) {
    return [];
  }
  if (resposta.status !== 200) {
    throw new Error(`GitHub respondeu ${resposta.status} ao listar commits.`);
  }
  const lista = await resposta.json();
  return lista.map(c => ({
    sha: c.sha,
    mensagem: c.commit && c.commit.message,
    data: c.commit && c.commit.author && c.commit.author.date,
    autor: c.commit && c.commit.author && c.commit.author.name,
  }));
}

module.exports = { publicar, baixar, listarCommits, statusUltimoBuild };
