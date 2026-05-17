// =============================================================================
// NCT Classificação — Main process
// Responsável por criar a janela do app e expor APIs do sistema operacional
// (abrir diálogo de arquivo, persistir configuração no disco) para a UI.
// =============================================================================

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const database = require('./src/db/database');
const dbIpc = require('./src/db/ipc');

// Caminho do arquivo onde guardamos a última configuração usada.
// Fica em ~/Library/Application Support/NCT Classificação/ (Mac)
// ou em %APPDATA%\NCT Classificação\ (Windows).
const CONFIG_PATH = () => path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH(), 'utf8'));
  } catch (err) {
    return null;
  }
}

function writeConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH(), JSON.stringify(cfg, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Erro ao salvar config:', err);
    return false;
  }
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#f6efe1',
    title: 'NCT Classificação',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile('renderer/index.html');

  // Abre links externos no navegador padrão, não dentro do app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Em desenvolvimento, abre o DevTools com Cmd+Alt+I / Ctrl+Shift+I
  // mainWindow.webContents.openDevTools();
}

// =============================================================================
// Menu nativo
// =============================================================================
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    // App menu (só Mac)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Abrir planilha…',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!mainWindow) return;
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Abrir planilha da etapa',
              filters: [
                { name: 'Planilhas Excel', extensions: ['xlsx', 'xls', 'xlsm'] }
              ],
              properties: ['openFile']
            });
            if (canceled || !filePaths[0]) return;
            try {
              const data = fs.readFileSync(filePaths[0]);
              // Envia ArrayBuffer para o renderer.
              mainWindow.webContents.send('file-opened', {
                name: path.basename(filePaths[0]),
                size: data.byteLength,
                data: data.buffer.slice(
                  data.byteOffset,
                  data.byteOffset + data.byteLength
                )
              });
            } catch (err) {
              dialog.showErrorBox('Erro ao abrir arquivo', err.message);
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Visualizar',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Janela',
      submenu: [
        { role: 'minimize' },
        ...(isMac ? [{ role: 'zoom' }, { type: 'separator' }, { role: 'front' }] : [{ role: 'close' }])
      ]
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Sobre o NCT Classificação',
          click: () => {
            if (!mainWindow) return;
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'NCT Classificação',
              message: 'NCT Classificação',
              detail:
                'Versão 0.1 (PoC)\n\n' +
                'Sistema de classificação para etapas do Circuito NCT de Vôlei de Praia.\n\n' +
                'Carrega a planilha da etapa, aplica os critérios de desempate ' +
                'e monta a chave do mata-mata.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// =============================================================================
// Ciclo de vida
// =============================================================================
app.whenReady().then(() => {
  // Abre o banco SQLite e aplica as migrações pendentes.
  database.abrir(path.join(app.getPath('userData'), 'nct.db'));

  // Handlers IPC expostos ao renderer via preload.js
  ipcMain.handle('config:load', () => readConfig());
  ipcMain.handle('config:save', (event, cfg) => writeConfig(cfg));

  // Handlers do banco (CRUD dos repositórios)
  dbIpc.registrar(ipcMain);

  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  database.fechar();
});
