const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setDisplayMode: (mode) => ipcRenderer.invoke('set-display-mode', mode),
  quitApp: () => ipcRenderer.invoke('quit-app'),
});
