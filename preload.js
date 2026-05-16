// =============================================================================
// Preload — bridge segura entre o main process (Node) e a página HTML.
// Expõe APIs específicas via contextBridge sem dar acesso direto ao Node.
// =============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Persistência de configuração no disco.
  loadConfig: () => ipcRenderer.invoke('config:load'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),

  // Recebe o ArrayBuffer do arquivo quando o usuário escolhe via menu nativo.
  onFileOpened: (callback) => {
    ipcRenderer.on('file-opened', (event, payload) => callback(payload));
  },

  // Para o renderer poder se identificar como rodando em Electron.
  isElectron: true,
  platform: process.platform
});
