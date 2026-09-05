const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { extractBrowsableVideoId } = require('./url-parser');

let mainWindow;
let saveTimer;

function statePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath(), 'utf8'));
  } catch {
    return { width: 980, height: 650, alwaysOnTop: false, opacity: 1 };
  }
}

function saveState(extra = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const maximized = mainWindow.isMaximized();
    const bounds = maximized ? (loadState().bounds || mainWindow.getNormalBounds()) : mainWindow.getBounds();
    const state = {
      bounds,
      maximized,
      alwaysOnTop: mainWindow.isAlwaysOnTop(),
      opacity: mainWindow.getOpacity(),
      ...extra
    };
    fs.writeFileSync(statePath(), JSON.stringify(state, null, 2));
  }, 200);
}

function createWindow() {
  const saved = loadState();
  const bounds = saved.bounds || { width: 980, height: 650 };

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 360,
    minHeight: 240,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    backgroundColor: '#0b0d12',
    title: 'YouTube Hacking Player - a ụt',
    frame: false,
    show: false,
    alwaysOnTop: Boolean(saved.alwaysOnTop),
    opacity: Number(saved.opacity) || 1,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    }
  });

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    const source = params.src || 'about:blank';
    if (source !== 'about:blank' && !/^https:\/\/(www\.)?youtube(-nocookie)?\.com\//i.test(source)) {
      event.preventDefault();
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  if (saved.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('resize', () => saveState());
  mainWindow.on('move', () => saveState());
  mainWindow.on('close', () => saveState());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.local.youtubefloatingplayer');

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return;

    contents.on('will-navigate', (navigationEvent, url) => {
      if (!extractBrowsableVideoId(url)) return;
      navigationEvent.preventDefault();
      mainWindow?.webContents.send('youtube:video-selected', url);
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (extractBrowsableVideoId(url)) {
        mainWindow?.webContents.send('youtube:video-selected', url);
      } else if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  });

  const playerSession = session.fromPartition('persist:youtube-player');
  playerSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (/^https:\/\/(www\.)?youtube(-nocookie)?\.com\//i.test(details.url)) {
      headers.Referer = 'https://www.youtube.com/';
    }
    callback({ requestHeaders: headers });
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return false;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:set-top', (_event, value) => {
  mainWindow?.setAlwaysOnTop(Boolean(value), 'floating');
  saveState();
  return mainWindow?.isAlwaysOnTop();
});
ipcMain.handle('window:get-state', () => ({
  alwaysOnTop: mainWindow?.isAlwaysOnTop() || false,
  maximized: mainWindow?.isMaximized() || false,
  opacity: mainWindow?.getOpacity() || 1
}));
ipcMain.handle('window:set-opacity', (_event, value) => {
  const opacity = Math.max(0.45, Math.min(1, Number(value)));
  mainWindow?.setOpacity(opacity);
  saveState();
  return opacity;
});
ipcMain.handle('window:set-compact', (_event, compact) => {
  if (!mainWindow) return;
  if (compact) {
    const { width } = mainWindow.getBounds();
    const compactWidth = Math.max(360, Math.min(width, 720));
    mainWindow.setMinimumSize(320, 180);
    mainWindow.setAspectRatio(16 / 9);
    mainWindow.setSize(compactWidth, Math.round(compactWidth * 9 / 16), true);
  } else {
    mainWindow.setAspectRatio(0);
    mainWindow.setMinimumSize(360, 240);
    const { width, height } = mainWindow.getBounds();
    mainWindow.setSize(Math.max(width, 720), Math.max(height, 500), true);
  }
  saveState({ compact: Boolean(compact) });
});
