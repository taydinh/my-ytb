const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-top', value),
  setOpacity: (value) => ipcRenderer.invoke('window:set-opacity', value),
  setCompact: (value) => ipcRenderer.invoke('window:set-compact', value),
  setYoutubePanel: (value) => ipcRenderer.invoke('window:set-youtube-panel', value),
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  getPointer: () => ipcRenderer.invoke('window:get-pointer'),
  getAdblockState: () => ipcRenderer.invoke('adblock:get-state'),
  setAdblockEnabled: (value) => ipcRenderer.invoke('adblock:set-enabled', value),
  getYouTubeMetadata: (videoId) => ipcRenderer.invoke('youtube:get-metadata', videoId),
  registerPlayerShortcuts: (webContentsId) => ipcRenderer.invoke('player:register-shortcuts', webContentsId),
  onPlayerShortcut: (callback) => {
    ipcRenderer.on('player:shortcut', (_event, shortcut) => callback(shortcut));
  },
  onVideoSelected: (callback) => {
    ipcRenderer.on('youtube:video-selected', (_event, selection) => callback(selection));
  }
});
