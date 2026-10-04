const { app, BrowserWindow, ipcMain, session, shell, screen, Tray, Menu, net } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { extractBrowsableVideoId } = require('./url-parser');
const { PlayerBlocker: ElectronBlocker } = require('./electron-blocker');
const { createAdblock } = require('./adblock');
const { registerWindowsAppIdentity } = require('./windows-app-identity');
const { getAction } = require('./player-shortcuts');

const APP_ID = 'com.local.youtubefloatingplayer';
const APP_NAME = 'Yêu Từ Pé';

// Chromium's Windows media session publishes this AppUserModelID. Portable and
// unpacked builds do not have a Start Menu shortcut for Windows to resolve, so
// also register its friendly name for the current user.
app.setName(APP_NAME);
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
  registerWindowsAppIdentity({ appId: APP_ID, appName: APP_NAME });
}

let mainWindow;
let tray;
let isQuitting = false;
let saveTimer;
let adblock;
let youtubePanelOriginalBounds = null;
let playerWebContentsId = null;

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
    const bounds = youtubePanelOriginalBounds || (maximized ? (loadState().bounds || mainWindow.getNormalBounds()) : mainWindow.getBounds());
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

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (process.platform !== 'win32' || tray) return;

  tray = new Tray(path.join(__dirname, '..', 'assets', 'icon.ico'));
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở ứng dụng', click: showMainWindow },
    { type: 'separator' },
    {
      label: 'Thoát',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
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
    title: APP_NAME,
    frame: false,
    show: false,
    alwaysOnTop: Boolean(saved.alwaysOnTop),
    opacity: Number(saved.opacity) || 1,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false,
      backgroundThrottling: false
    }
  });

  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    const source = params.src || 'about:blank';
    if (/^https:\/\/(www\.)?youtube\.com\/?(?:[?#].*)?$/i.test(source)) {
      webPreferences.preload = path.join(__dirname, 'youtube-browser-preload.js');
    } else {
      delete webPreferences.preload;
    }
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    if (source !== 'about:blank' && !/^https:\/\/(www\.)?youtube(-nocookie)?\.com\//i.test(source)) {
      event.preventDefault();
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  if (saved.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('resize', () => saveState());
  mainWindow.on('move', () => saveState());
  mainWindow.on('close', (event) => {
    saveState();
    if (process.platform === 'win32' && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      mainWindow.setSkipTaskbar(true);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return;

    contents.on('before-input-event', (inputEvent, input) => {
      if (contents.id !== playerWebContentsId) return;
      const action = getAction(input);
      if (!action) return;
      inputEvent.preventDefault();
      mainWindow?.webContents.send('player:shortcut', { action, sourceId: contents.id });
    });

    contents.on('will-navigate', (navigationEvent, url) => {
      if (!extractBrowsableVideoId(url)) return;
      navigationEvent.preventDefault();
      mainWindow?.webContents.send('youtube:video-selected', { url, sourceId: contents.id });
    });

    contents.setWindowOpenHandler(({ url }) => {
      if (extractBrowsableVideoId(url)) {
        mainWindow?.webContents.send('youtube:video-selected', { url, sourceId: contents.id });
      } else if (/^https?:\/\//i.test(url)) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media';
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });

  const playerSession = session.fromPartition('persist:youtube-player');
  adblock = createAdblock({
    ElectronBlocker,
    session: playerSession,
    userData: app.getPath('userData'),
    bundledPath: path.join(__dirname, '..', 'assets', 'adblock-engine.bin')
  });
  adblock.initialize();
  playerSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (/^https:\/\/(www\.)?youtube(-nocookie)?\.com\//i.test(details.url)) {
      headers.Referer = 'https://www.youtube.com/';
    }
    callback({ requestHeaders: headers });
  });

  createWindow();
  createTray();
  adblock.refresh().catch(() => { /* Keep bundled/cached filters when offline. */ });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('player:register-shortcuts', (event, webContentsId) => {
  if (event.sender !== mainWindow?.webContents) return false;
  playerWebContentsId = Number(webContentsId) || null;
  return Boolean(playerWebContentsId);
});
ipcMain.handle('window:get-pointer', (event) => {
  if (!mainWindow || event.sender !== mainWindow.webContents || mainWindow.isMinimized()) return null;
  const point = screen.getCursorScreenPoint();
  const bounds = mainWindow.getContentBounds();
  const zoom = mainWindow.webContents.getZoomFactor();
  return { x: (point.x - bounds.x) / zoom, y: (point.y - bounds.y) / zoom };
});
ipcMain.handle('adblock:get-state', (event) => {
  if (event.sender !== mainWindow?.webContents) throw new Error('Unauthorized sender');
  return adblock.getState();
});
ipcMain.handle('adblock:set-enabled', (event, enabled) => {
  if (event.sender !== mainWindow?.webContents) throw new Error('Unauthorized sender');
  return adblock.setEnabled(enabled);
});
ipcMain.handle('youtube:get-metadata', async (event, videoId) => {
  if (event.sender !== mainWindow?.webContents) throw new Error('Unauthorized sender');
  const id = String(videoId || '').trim();
  if (!/^[\w-]{6,20}$/.test(id)) return null;
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`;
    const response = await net.fetch(endpoint);
    if (!response.ok) return null;
    const data = await response.json();
    return {
      title: String(data.title || ''),
      channelName: String(data.author_name || ''),
      channelUrl: String(data.author_url || '')
    };
  } catch {
    return null;
  }
});
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

ipcMain.handle('window:set-youtube-panel', (event, open) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return false;
  const shouldOpen = Boolean(open);
  if (shouldOpen && !youtubePanelOriginalBounds) {
    mainWindow.setMinimumSize(880, 240);
    if (mainWindow.isMaximized()) return true;
    const current = mainWindow.getBounds();
    const workArea = screen.getDisplayMatching(current).workArea;
    const addedWidth = Math.min(720, Math.max(520, Math.round(current.width * 0.72)));
    const targetWidth = Math.min(workArea.width, current.width + addedWidth);
    const targetX = Math.max(workArea.x, Math.min(current.x, workArea.x + workArea.width - targetWidth));
    youtubePanelOriginalBounds = current;
    mainWindow.setBounds({ x: targetX, y: current.y, width: targetWidth, height: current.height }, true);
  } else if (!shouldOpen && youtubePanelOriginalBounds) {
    const original = youtubePanelOriginalBounds;
    youtubePanelOriginalBounds = null;
    mainWindow.setMinimumSize(360, 240);
    mainWindow.setBounds(original, true);
    saveState();
  } else if (!shouldOpen) {
    mainWindow.setMinimumSize(360, 240);
  }
  return shouldOpen;
});
