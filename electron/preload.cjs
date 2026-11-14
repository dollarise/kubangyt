const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('ytManager', {
  openYouTube: (accountId, email, profile) => ipcRenderer.invoke('yt:open', accountId, email, profile),
  setBrowserBounds: (bounds) => ipcRenderer.send('yt:set-bounds', bounds)
});
