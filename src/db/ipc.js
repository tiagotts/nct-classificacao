// =============================================================================
// Registro dos handlers IPC do banco. O renderer chama estes canais via
// preload.js; cada canal apenas delega ao repositório correspondente.
// =============================================================================

const temporada = require('./repositorios/temporada');
const etapa = require('./repositorios/etapa');
const etapaCategoria = require('./repositorios/etapa-categoria');
const categoria = require('./repositorios/categoria');
const atleta = require('./repositorios/atleta');
const dupla = require('./repositorios/dupla');
const jogo = require('./repositorios/jogo');
const classificacao = require('./repositorios/classificacao');
const rankingTemporada = require('./repositorios/ranking-temporada');
const rankingInicial = require('./repositorios/ranking-inicial');
const rankingEntrada = require('./repositorios/ranking-entrada');
const pontuacao = require('./repositorios/pontuacao');
const { gerarPaginaCategoria, gerarPaginaEtapa } = require('../publicacao/gerar-pagina');
const github = require('../publicacao/github');
const backup = require('./backup');
const QRCode = require('qrcode');

// Registra os canais CRUD padrão (listar/obter/criar/atualizar/remover) que
// o repositório implementar. listar repassa argumentos extras (ex: filtro
// por id pai).
function registrarCrud(ipcMain, prefixo, repo) {
  if (repo.listar)
    ipcMain.handle(`${prefixo}:listar`, (e, ...args) => repo.listar(...args));
  if (repo.obter)
    ipcMain.handle(`${prefixo}:obter`, (e, id) => repo.obter(id));
  if (repo.criar)
    ipcMain.handle(`${prefixo}:criar`, (e, dados) => repo.criar(dados));
  if (repo.atualizar)
    ipcMain.handle(`${prefixo}:atualizar`, (e, id, dados) => repo.atualizar(id, dados));
  if (repo.remover)
    ipcMain.handle(`${prefixo}:remover`, (e, id) => repo.remover(id));
}

function registrar(ipcMain) {
  registrarCrud(ipcMain, 'temporada', temporada);
  registrarCrud(ipcMain, 'etapa', etapa);
  registrarCrud(ipcMain, 'etapaCategoria', etapaCategoria);
  registrarCrud(ipcMain, 'categoria', categoria);
  registrarCrud(ipcMain, 'atleta', atleta);
  registrarCrud(ipcMain, 'dupla', dupla);
  registrarCrud(ipcMain, 'jogo', jogo);

  // Canais específicos fora do CRUD padrão.
  ipcMain.handle('atleta:buscar', (e, termo) => atleta.buscar(termo));
  ipcMain.handle('jogo:registrarPlacar', (e, id, dados) =>
    jogo.registrarPlacar(id, dados));
  ipcMain.handle('jogo:gerarFaseGrupos', (e, etapaCategoriaId, opts) =>
    jogo.gerarFaseGrupos(etapaCategoriaId, opts));
  ipcMain.handle('jogo:gerarMataMata', (e, etapaCategoriaId, opts) =>
    jogo.gerarMataMata(etapaCategoriaId, opts));
  ipcMain.handle('jogo:reordenarGrupo', (e, etapaCategoriaId, idsNaOrdem) =>
    jogo.reordenarGrupo(etapaCategoriaId, idsNaOrdem));
  ipcMain.handle('classificacao:calcular', (e, etapaCategoriaId) =>
    classificacao.calcular(etapaCategoriaId));
  ipcMain.handle('rankingTemporada:calcular', (e, temporadaId, categoriaId, tipo) =>
    rankingTemporada.calcular(temporadaId, categoriaId, tipo));
  ipcMain.handle('pontuacao:faixas', (e, etapaCategoriaId) =>
    pontuacao.faixas(etapaCategoriaId));
  ipcMain.handle('pontuacao:salvar', (e, etapaCategoriaId, faixas) =>
    pontuacao.salvar(etapaCategoriaId, faixas));
  ipcMain.handle('rankingInicial:listar', (e, temporadaId, categoriaId, tipo) =>
    rankingInicial.listar(temporadaId, categoriaId, tipo));
  ipcMain.handle('rankingInicial:salvar', (e, temporadaId, categoriaId, tipo, entradas) =>
    rankingInicial.salvar(temporadaId, categoriaId, tipo, entradas));
  ipcMain.handle('rankingEntrada:calcular', (e, etapaCategoriaId) =>
    rankingEntrada.calcular(etapaCategoriaId));

  // Publica a página GERAL da etapa (lista de categorias, pódios, ranking).
  ipcMain.handle('publicacao:publicarEtapa', async (e, etapaId, cfg) => {
    const html = gerarPaginaEtapa(etapaId);
    const et = etapa.obter(etapaId);
    const temp = et ? temporada.obter(et.temporada_id) : null;
    const ano = (temp && temp.ano) || new Date().getFullYear();
    const caminho = `etapa-${ano}-${etapaId}.html`;
    const resultado = await github.publicar({
      token: cfg.token, owner: cfg.owner, repo: cfg.repo,
      branch: cfg.branch || 'main',
      caminho, conteudo: html,
      mensagem: `Página geral da etapa ${etapaId} (${ano})`,
    });
    const url = `https://${cfg.owner}.github.io/${cfg.repo}/${caminho}`;
    const qrcode = await QRCode.toString(url, { type: 'svg', margin: 1 });
    const sha = resultado && resultado.commit ? resultado.commit.sha : null;
    return { url, qrcode, sha };
  });

  // Publica a página de UMA categoria da etapa no GitHub Pages.
  ipcMain.handle('publicacao:publicarCategoria', async (e, etapaCategoriaId, cfg) => {
    const html = gerarPaginaCategoria(etapaCategoriaId);
    const ec = etapaCategoria.obter(etapaCategoriaId);
    const et = ec ? etapa.obter(ec.etapa_id) : null;
    const temp = et ? temporada.obter(et.temporada_id) : null;
    const ano = (temp && temp.ano) || new Date().getFullYear();
    // O nome do arquivo inclui categoria e tipo para que cada categoria
    // tenha a sua página própria e não sobrescreva as outras.
    const slug = (ec && ec.categoria_slug) || `cat${ec ? ec.categoria_id : 0}`;
    const caminho = `etapa-${ano}-${ec ? ec.etapa_id : 0}-${slug}-${ec ? ec.tipo : ''}.html`;
    const resultado = await github.publicar({
      token: cfg.token, owner: cfg.owner, repo: cfg.repo,
      branch: cfg.branch || 'main',
      caminho, conteudo: html,
      mensagem: `Resultados ${slug} ${ec ? ec.tipo : ''} `
        + `(etapa ${ec ? ec.etapa_id : 0}, ${ano})`,
    });
    const url = `https://${cfg.owner}.github.io/${cfg.repo}/${caminho}`;
    // QR code do link, para os jogadores escanearem.
    const qrcode = await QRCode.toString(url, { type: 'svg', margin: 1 });
    const sha = resultado && resultado.commit ? resultado.commit.sha : null;
    return { url, qrcode, sha };
  });

  // Consulta se o GitHub Pages já terminou de gerar a página do commit.
  // Retorna 'pronto' | 'erro' | 'aguardando'.
  ipcMain.handle('publicacao:statusBuild', async (e, cfg, sha) => {
    const info = await github.statusUltimoBuild({
      token: cfg.token, owner: cfg.owner, repo: cfg.repo,
    });
    if (!info) return 'aguardando';
    if (info.status === 'errored') return 'erro';
    if (info.status === 'built' && info.commit === sha) return 'pronto';
    return 'aguardando';
  });

  // Backup do banco no GitHub: faz, lista e restaura.
  ipcMain.handle('backup:fazer', (e, cfg) => backup.fazerBackup(cfg));
  ipcMain.handle('backup:listar', (e, cfg) => backup.listarBackups(cfg));
  ipcMain.handle('backup:restaurar', (e, cfg, sha) =>
    backup.restaurarBackup(cfg, sha));
}

module.exports = { registrar };
