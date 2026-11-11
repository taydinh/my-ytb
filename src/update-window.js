const path = require('node:path');

function createUpdateWindow({ BrowserWindow, ipcMain, parent, currentVersion, update }) {
  const window = new BrowserWindow({
    parent, modal: true, width: 520, height: 440, useContentSize: true, resizable: false,
    minimizable: false, maximizable: false, autoHideMenuBar: true,
    show: false, title: 'Cập nhật Yêu Từ Pé', backgroundColor: '#10141e',
    alwaysOnTop: parent.isAlwaysOnTop(),
    webPreferences: { preload: path.join(__dirname, 'update-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  let busy = false;
  let pending;
  let state = {
    phase: 'available', percent: 0,
    title: `Có phiên bản mới ${update.version}`,
    status: `Phiên bản hiện tại: ${currentVersion}${update.isMandatory ? ' · Bắt buộc cập nhật' : ''}`,
    notes: Array.isArray(update.releaseNotes) ? update.releaseNotes.map(String).join('\n') : '',
    primary: 'Cập nhật ngay', secondary: update.isMandatory ? 'Thoát ứng dụng' : 'Để sau'
  };
  const channel = `update:action:${window.webContents.id}`;
  const listener = (event, action) => {
    if (event.sender !== window.webContents || busy || !pending || !['install', 'dismiss'].includes(action)) return;
    const resolve = pending;
    pending = null;
    resolve(action);
  };
  ipcMain.on(channel, listener);
  window.webContents.on('did-finish-load', () => window.webContents.send('update:state', { ...state, channel }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.once('ready-to-show', () => {
    parent.setEnabled(false);
    window.show();
    window.focus();
  });
  window.on('close', event => {
    event.preventDefault();
    if (!busy) listener({ sender: window.webContents }, 'dismiss');
  });
  window.on('closed', () => {
    ipcMain.removeListener(channel, listener);
    if (!parent.isDestroyed()) parent.setEnabled(true);
    pending?.('dismiss');
  });
  window.loadFile(path.join(__dirname, 'update.html'));
  return {
    window,
    waitForAction: () => new Promise(resolve => { pending = resolve; }),
    setState(next) {
      busy = !next.primary;
      state = { ...state, ...next };
      if (!window.isDestroyed()) {
        window.webContents.send('update:state', { ...state, channel });
        window.setProgressBar(next.phase === 'error' ? -1 : next.percent / 100);
      }
    },
    focus() { if (!window.isDestroyed()) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } },
    destroy() { if (!window.isDestroyed()) window.destroy(); }
  };
}
module.exports = { createUpdateWindow };
