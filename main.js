// =============================================================================
// BeachPlay — Main process
// Responsável por criar a janela do app e expor APIs do sistema operacional
// (abrir diálogo de arquivo, persistir configuração no disco) para a UI.
// =============================================================================

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// --- DIAGNOSTICO TEMPORARIO -------------------------------------------------
const os = require('os');
const DIAG = path.join(os.homedir(), 'nct-diag.log');
function diag(msg) {
  try { fs.appendFileSync(DIAG, new Date().toISOString() + ' ' + msg + '\n'); }
  catch (e) { /* ignora */ }
}
try { fs.writeFileSync(DIAG, ''); } catch (e) { /* ignora */ }
diag('main.js: requires de electron/path/fs ok | DIAG=' + DIAG);
process.on('uncaughtException', (e) => diag('UNCAUGHT: ' + (e && e.stack || e)));
process.on('unhandledRejection', (e) => diag('REJECTION: ' + (e && e.stack || e)));
// ---------------------------------------------------------------------------

diag('antes require ./src/db/database');
const database = require('./src/db/database');
diag('depois require ./src/db/database');
const dbIpc = require('./src/db/ipc');
diag('depois require ./src/db/ipc');

// Caminho do arquivo onde guardamos a última configuração usada.
// Fica em ~/Library/Application Support/BeachPlay/ (Mac)
// ou em %APPDATA%\BeachPlay\ (Windows).
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

// Copia banco e config do diretório userData antigo ("NCT Classificação")
// para o novo ("BeachPlay") quando o app é aberto pela primeira vez após
// o rename. Só age se o novo diretório ainda não tem banco — não pisa em
// dados já existentes do usuário aqui.
function migrarUserDataAntigo(novoDbPath) {
  if (fs.existsSync(novoDbPath)) return;
  const antigoUserData = path.join(app.getPath('appData'), 'NCT Classificação');
  const antigoDb = path.join(antigoUserData, 'nct.db');
  if (!fs.existsSync(antigoDb)) return;
  try {
    fs.mkdirSync(path.dirname(novoDbPath), { recursive: true });
    fs.copyFileSync(antigoDb, novoDbPath);
    // WAL/SHM podem estar pendentes; copia se existirem para evitar perda.
    for (const sfx of ['-wal', '-shm']) {
      const src = antigoDb + sfx;
      if (fs.existsSync(src)) fs.copyFileSync(src, novoDbPath + sfx);
    }
    const antigaCfg = path.join(antigoUserData, 'config.json');
    const novaCfg = path.join(path.dirname(novoDbPath), 'config.json');
    if (fs.existsSync(antigaCfg) && !fs.existsSync(novaCfg)) {
      fs.copyFileSync(antigaCfg, novaCfg);
    }
    diag('migrou userData de "NCT Classificação" para "BeachPlay"');
  } catch (e) {
    diag('falha ao migrar userData antigo: ' + (e && e.message || e));
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
    title: 'BeachPlay',
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
          label: 'Sobre o BeachPlay',
          click: () => {
            if (!mainWindow) return;
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'BeachPlay',
              message: 'BeachPlay',
              detail:
                'Versão ' + app.getVersion() + '\n\n' +
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
  diag('whenReady: inicio');
  try {
    // Abre o banco SQLite e aplica as migrações pendentes.
    // Em desenvolvimento (npm start) o banco fica em data/nct.db dentro do
    // projeto, para facilitar inspeção e reset. No app empacotado, fica no
    // diretório userData do sistema.
    const dbPath = app.isPackaged
      ? path.join(app.getPath('userData'), 'nct.db')
      : path.join(__dirname, 'data', 'nct.db');
    if (!app.isPackaged) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    } else {
      // Renome do app de "NCT Classificação" para "BeachPlay" mudou o
      // userData. Na primeira vez, se ainda não há banco no novo diretório
      // e o antigo existe, copia banco + config para o local novo.
      migrarUserDataAntigo(dbPath);
    }
    diag('antes database.abrir | dbPath=' + dbPath);
    database.abrir(dbPath);
    diag('depois database.abrir');

    // Handlers IPC expostos ao renderer via preload.js
    ipcMain.handle('config:load', () => readConfig());
    ipcMain.handle('config:save', (event, cfg) => writeConfig(cfg));
    // Versão do app — vem do package.json via app.getVersion(). Usada pela
    // barra lateral para o usuário conferir qual versão está rodando.
    ipcMain.handle('app:versao', () => app.getVersion());
    // Caminho do banco de dados — exibido na barra lateral e útil para
    // localizar o arquivo (backup, cópia). O canal :abrirPasta abre o
    // diretório do banco no explorador de arquivos do SO.
    ipcMain.handle('app:dbPath', () => dbPath);
    ipcMain.handle('app:abrirPastaDb', () => {
      shell.showItemInFolder(dbPath);
    });

    // Lista os arquivos de logo disponíveis em imagens/logos/ para o combo
    // da tela de temporadas. Só imagens (.png/.jpg/.jpeg/.svg/.webp).
    ipcMain.handle('logos:listar', () => {
      const dir = path.join(__dirname, 'imagens', 'logos');
      try {
        return fs.readdirSync(dir)
          .filter(n => /\.(png|jpe?g|svg|webp|gif)$/i.test(n))
          .sort();
      } catch { return []; }
    });

    // Handlers do banco (CRUD dos repositórios)
    diag('antes dbIpc.registrar');
    dbIpc.registrar(ipcMain);
    diag('depois dbIpc.registrar');

    diag('antes buildMenu');
    buildMenu();
    diag('antes createWindow');
    createWindow();
    diag('depois createWindow');

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (e) {
    diag('ERRO no whenReady: ' + (e && e.stack || e));
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  database.fechar();
});
