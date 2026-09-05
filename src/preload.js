const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  setAlwaysOnTop: (value) => ipcRenderer.invoke('window:set-top', value),
  setOpacity: (value) => ipcRenderer.invoke('window:set-opacity', value),
  setCompact: (value) => ipcRenderer.invoke('window:set-compact', value),
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  onVideoSelected: (callback) => {
    ipcRenderer.on('youtube:video-selected', (_event, url) => callback(url));
  }
});
