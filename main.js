'use strict';
const {
  app, ipcMain, dialog,
  BrowserWindow, WebContentsView, session
} = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Settings ───────────────────────────────────────────────────────────────
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT = {
  url: 'https://www.google.com', activeNames: [],
  syncScroll: true, liveReload: false, liveInterval: 3,
  scale: 50, spacing: 24,
  windowWidth: 1440, windowHeight: 900, customDevices: []
};
function loadSettings() {
  try { if (fs.existsSync(settingsPath)) return { ...DEFAULT, ...JSON.parse(fs.readFileSync(settingsPath,'utf8')) }; } catch {}
  return { ...DEFAULT };
}
function saveSettings(s) { try { fs.writeFileSync(settingsPath, JSON.stringify(s,null,2)); } catch {} }

// ── State ──────────────────────────────────────────────────────────────────
let settings = loadSettings();
let mainWin  = null;
let uiWC     = null;   // webContents del renderer UI
const views  = new Map(); // id → WebContentsView

// ── App ────────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  mainWin = new BrowserWindow({
    width:  settings.windowWidth,
    height: settings.windowHeight,
    minWidth: 900, minHeight: 600,
    title: 'Screenlab',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  uiWC = mainWin.webContents;
  mainWin.loadFile(path.join(__dirname, 'index.html'));

  mainWin.on('resize', () => {
    repositionAllViews();
    if (mainWin.isNormal()) {
      const b = mainWin.getBounds();
      settings.windowWidth  = b.width;
      settings.windowHeight = b.height;
      saveSettings(settings);
    }
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Scroll sync ────────────────────────────────────────────────────────────
const SCROLL_JS = id => `(function(){
  window.__SL_ID=${JSON.stringify(id)};
  if(window.__SL_BOUND) return;
  window.__SL_BOUND=true;
  var t=false;
  document.addEventListener('scroll',function(){
    if(t)return;t=true;
    requestAnimationFrame(function(){
      t=false;
      var e=document.documentElement;
      var mx=Math.max(1,e.scrollWidth-window.innerWidth);
      var my=Math.max(1,e.scrollHeight-window.innerHeight);
      try{require('electron').ipcRenderer.send('scroll:from-view',
        {id:window.__SL_ID,x:window.scrollX/mx,y:window.scrollY/my});
      }catch(ex){}
    });
  },{passive:true,capture:true});
})();`;

let syncingScroll = false;
ipcMain.on('scroll:from-view', (_, { id, x, y }) => {
  if (!settings.syncScroll || syncingScroll) return;
  syncingScroll = true;
  const js = `(function(){
    var mxX=Math.max(0,document.documentElement.scrollWidth-window.innerWidth);
    var mxY=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
    window.scrollTo({left:${x}*mxX,top:${y}*mxY,behavior:'instant'});
  })();`;
  for (const [vid, v] of views) {
    if (vid !== id) v.webContents.executeJavaScript(js).catch(()=>{});
  }
  setTimeout(() => { syncingScroll = false; }, 100);
});

// ── IPC: Settings ──────────────────────────────────────────────────────────
ipcMain.handle('settings:get',   ()      => settings);
ipcMain.handle('settings:save',  (_, d)  => { settings = { ...settings, ...d }; saveSettings(settings); });

// ── IPC: Views ─────────────────────────────────────────────────────────────
ipcMain.handle('views:create', (_, { id, ua, url }) => {
  if (views.has(id)) return;
  const sess = session.fromPartition('persist:screenlab');
  const v = new WebContentsView({
    webPreferences: { session: sess, contextIsolation: false, nodeIntegration: false, webSecurity: false }
  });
  v.setBackgroundColor('#ffffff');
  v.webContents.setUserAgent(ua);
  v.webContents.loadURL(url || settings.url || 'https://www.google.com');
  v.webContents.on('did-finish-load', () => {
    v.webContents.executeJavaScript(SCROLL_JS(id)).catch(()=>{});
  });
  mainWin.contentView.addChildView(v);
  v.setBounds({ x: -9999, y: -9999, width: 1, height: 1 });
  views.set(id, v);
});

ipcMain.handle('views:destroy', (_, id) => {
  const v = views.get(id);
  if (!v) return;
  try { mainWin.contentView.removeChildView(v); } catch {}
  views.delete(id);
});

ipcMain.handle('views:destroyAll', () => {
  for (const v of views.values()) {
    try { mainWin.contentView.removeChildView(v); } catch {}
  }
  views.clear();
});

// Posiziona le views in base ai rect mandati dal renderer
let lastRects = [];
ipcMain.handle('views:position', (_, rects) => {
  lastRects = rects;
  applyRects(rects);
});

function applyRects(rects) {
  for (const r of rects) {
    const v = views.get(r.id);
    if (!v) continue;
    v.setBounds({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) });
  }
  // UI sempre in cima
  try { mainWin.contentView.removeChildView(mainWin.webContentsView || {}); } catch {}
}

function repositionAllViews() {
  if (lastRects.length > 0) applyRects(lastRects);
}

ipcMain.handle('views:navigate', (_, url) => {
  settings.url = url; saveSettings(settings);
  for (const v of views.values()) v.webContents.loadURL(url);
});

ipcMain.handle('views:reload',   ()    => { for (const v of views.values()) v.webContents.reload(); });
ipcMain.handle('views:back',     ()    => { for (const v of views.values()) { if (v.webContents.canGoBack()) v.webContents.goBack(); } });
ipcMain.handle('views:forward',  ()    => { for (const v of views.values()) { if (v.webContents.canGoForward()) v.webContents.goForward(); } });
ipcMain.handle('views:devtools', (_, id) => {
  const v = id ? views.get(id) : views.values().next().value;
  if (v) v.webContents.openDevTools({ mode: 'detach' });
});

ipcMain.handle('views:screenshot', async (_, id) => {
  const v = views.get(id);
  if (!v) return null;
  const img = await v.webContents.capturePage();
  return img.toPNG().toString('base64');
});

ipcMain.handle('views:screenshotAll', async () => {
  const r = {};
  for (const [id, v] of views) {
    const img = await v.webContents.capturePage();
    r[id] = img.toPNG().toString('base64');
  }
  return r;
});

ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(mainWin, { properties: ['openDirectory'], title: 'Scegli cartella' });
  return r.canceled ? null : r.filePaths[0];
});

// Screenshot save dal renderer (no fs access nel renderer)
ipcMain.handle('file:save', (_, { filePath, base64 }) => {
  try { fs.writeFileSync(filePath, Buffer.from(base64, 'base64')); return true; } catch { return false; }
});
