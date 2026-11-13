const { app, BrowserWindow, WebContentsView, ipcMain, session } = require('electron');
const path = require('node:path');

let win;
let youtubeView;
const partitions = new Map();

function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 950, minWidth: 980, minHeight: 680,
    backgroundColor: '#0a1020',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, '../dist/index.html'));
  win.on('resize', layoutYouTube);
}
function layoutYouTube() {
  if (!win || !youtubeView) return;
  const bounds = win.getContentBounds();
  const sidebarWidth = 350;
  const topHeight = 150;
  youtubeView.setBounds({ x: 24, y: topHeight, width: Math.max(500, bounds.width - sidebarWidth - 62), height: Math.max(350, bounds.height - topHeight - 48) });
}
function openYouTube(accountId) {
  if (!win || typeof accountId !== 'string' || !/^[0-9a-f-]{8,64}$/i.test(accountId)) return;
  const partitionName = 'persist:yt-account-' + accountId;
  const ses = session.fromPartition(partitionName);
  partitions.set(accountId, ses);
  if (youtubeView) { win.contentView.removeChildView(youtubeView); youtubeView.webContents.close(); }
  youtubeView = new WebContentsView({ webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.contentView.addChildView(youtubeView);
  layoutYouTube();
  youtubeView.webContents.loadURL('https://www.youtube.com');
}
app.whenReady().then(() => {
  ipcMain.handle('yt:open', (_event, accountId) => openYouTube(accountId));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
