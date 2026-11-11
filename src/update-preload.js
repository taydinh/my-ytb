const { contextBridge, ipcRenderer } = require('electron');
let actionChannel;
contextBridge.exposeInMainWorld('updater', {
  onState(callback) {
    ipcRenderer.on('update:state', (_event, state) => {
      actionChannel = state.channel;
      callback(state);
    });
  },
  act(action) { if (actionChannel) ipcRenderer.send(actionChannel, action); }
});
