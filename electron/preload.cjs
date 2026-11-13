const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ytManager', {
  openYouTube: (accountId) => ipcRenderer.invoke('yt:open', accountId)
});
