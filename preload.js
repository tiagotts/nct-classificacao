// =============================================================================
// Preload — bridge segura entre o main process (Node) e a página HTML.
// Expõe APIs específicas via contextBridge sem dar acesso direto ao Node.
// =============================================================================

const { contextBridge, ipcRenderer } = require('electron');

// Monta um conjunto CRUD padrão de chamadas para um prefixo de canal IPC.
function crud(prefixo) {
  return {
    listar: (...args) => ipcRenderer.invoke(`${prefixo}:listar`, ...args),
    obter: (id) => ipcRenderer.invoke(`${prefixo}:obter`, id),
    criar: (dados) => ipcRenderer.invoke(`${prefixo}:criar`, dados),
    atualizar: (id, dados) => ipcRenderer.invoke(`${prefixo}:atualizar`, id, dados),
    remover: (id) => ipcRenderer.invoke(`${prefixo}:remover`, id),
  };
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Persistência de configuração no disco.
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),

  // Recebe o ArrayBuffer do arquivo quando o usuário escolhe via menu nativo.
  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (event, payload) => callback(payload));
  },

  // Acesso ao banco SQLite (processo main).
  db: {
    temporada: crud('temporada'),
    etapa: crud('etapa'),
    etapaCategoria: crud('etapaCategoria'),
    categoria: {
      listar: () => ipcRenderer.invoke('categoria:listar'),
      obter: (id) => ipcRenderer.invoke('categoria:obter', id),
    },
    atleta: {
      ...crud('atleta'),
      buscar: (termo) => ipcRenderer.invoke('atleta:buscar', termo),
    },
    dupla: crud('dupla'),
    jogo: {
      ...crud('jogo'),
      registrarPlacar: (id, dados) =>
        ipcRenderer.invoke('jogo:registrarPlacar', id, dados),
      gerarFaseGrupos: (etapaCategoriaId, opts) =>
        ipcRenderer.invoke('jogo:gerarFaseGrupos', etapaCategoriaId, opts),
      gerarMataMata: (etapaCategoriaId, opts) =>
        ipcRenderer.invoke('jogo:gerarMataMata', etapaCategoriaId, opts),
      reordenarGrupo: (etapaCategoriaId, idsNaOrdem) =>
        ipcRenderer.invoke('jogo:reordenarGrupo', etapaCategoriaId, idsNaOrdem),
    },
    classificacao: {
      calcular: (etapaCategoriaId) =>
        ipcRenderer.invoke('classificacao:calcular', etapaCategoriaId),
    },
    rankingTemporada: {
      calcular: (temporadaId, categoriaId, tipo) =>
        ipcRenderer.invoke('rankingTemporada:calcular', temporadaId, categoriaId, tipo),
    },
    pontuacao: {
      faixas: (etapaCategoriaId) =>
        ipcRenderer.invoke('pontuacao:faixas', etapaCategoriaId),
      salvar: (etapaCategoriaId, faixas) =>
        ipcRenderer.invoke('pontuacao:salvar', etapaCategoriaId, faixas),
    },
    rankingInicial: {
      listar: (temporadaId, categoriaId, tipo) =>
        ipcRenderer.invoke('rankingInicial:listar', temporadaId, categoriaId, tipo),
      salvar: (temporadaId, categoriaId, tipo, entradas) =>
        ipcRenderer.invoke('rankingInicial:salvar',
          temporadaId, categoriaId, tipo, entradas),
    },
    rankingEntrada: {
      calcular: (etapaCategoriaId) =>
        ipcRenderer.invoke('rankingEntrada:calcular', etapaCategoriaId),
    },
  },

  // Lista os arquivos disponíveis em imagens/logos/ (combo de logo da temporada).
  logos: {
    listar: () => ipcRenderer.invoke('logos:listar'),
  },

  // Publicação no GitHub Pages: página por categoria e página geral da etapa.
  publicacao: {
    publicarCategoria: (etapaCategoriaId, cfg) =>
      ipcRenderer.invoke('publicacao:publicarCategoria', etapaCategoriaId, cfg),
    publicarEtapa: (etapaId, cfg) =>
      ipcRenderer.invoke('publicacao:publicarEtapa', etapaId, cfg),
    statusBuild: (cfg, sha) =>
      ipcRenderer.invoke('publicacao:statusBuild', cfg, sha),
  },

  // Backup do banco no GitHub (repo separado).
  backup: {
    fazer: (cfg) => ipcRenderer.invoke('backup:fazer', cfg),
    listar: (cfg) => ipcRenderer.invoke('backup:listar', cfg),
    restaurar: (cfg, sha) => ipcRenderer.invoke('backup:restaurar', cfg, sha),
  },

  // Para o renderer poder se identificar como rodando em Electron.
  isElectron: true,
  platform: process.platform,
});
