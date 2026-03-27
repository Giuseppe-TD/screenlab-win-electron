'use strict';
const {
  app, ipcMain, dialog, BrowserWindow,
  WebContentsView, BaseWindow, session
} = require('electron');
const path  = require('path');
const fs    = require('fs');

// ── Settings ──────────────────────────────────────────────────────────────

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const DEFAULT = {
  url: 'https://www.google.com',
  activeNames: [],
  viewMode: 'multi',
  syncScroll: true,
  liveReload: false,
  liveInterval: 3,
  scale: 50,
  spacing: 24,
  windowWidth: 1440,
  windowHeight: 900,
  customDevices: []
};

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath))
      return { ...DEFAULT, ...JSON.parse(fs.readFileSync(settingsPath, 'utf8')) };
  } catch {}
  return { ...DEFAULT };
}

function saveSettings(s) {
  try { fs.writeFileSync(settingsPath, JSON.stringify(s, null, 2)); } catch {}
}

// ── State ─────────────────────────────────────────────────────────────────

let settings  = loadSettings();
let mainWin   = null;
let uiView    = null;    // WebContentsView del renderer UI
const views   = new Map(); // id → WebContentsView

// ── App ───────────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Sessione condivisa per tutte le device views
  const devSess = session.fromPartition('persist:screenlab');

  mainWin = new BaseWindow({
    width:  settings.windowWidth,
    height: settings.windowHeight,
    minWidth:  900,
    minHeight: 600,
    title: 'Screenlab',
    backgroundColor: '#1a1a1a',
  });

  // UI View — occupa tutta la finestra, sta in basso nello z-order
  uiView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });
  mainWin.contentView.addChildView(uiView);
  uiView.setBounds({ x: 0, y: 0, ...mainWin.getContentSize().reduce((o, v, i) => ({ ...o, [i === 0 ? 'width' : 'height']: v }), {}) });
  uiView.webContents.loadFile(path.join(__dirname, 'index.html'));

  // Resize handler
  mainWin.on('resize', () => {
    const [w, h] = mainWin.getContentSize();
    uiView.setBounds({ x: 0, y: 0, width: w, height: h });
    if (mainWin.isNormal()) {
      settings.windowWidth  = mainWin.getBounds().width;
      settings.windowHeight = mainWin.getBounds().height;
      saveSettings(settings);
    }
  });

  mainWin.on('closed', () => { mainWin = null; });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Helpers ───────────────────────────────────────────────────────────────

function getContentSize() {
  if (!mainWin) return { width: 1440, height: 900 };
  const [w, h] = mainWin.getContentSize();
  return { width: w, height: h };
}

const SCROLL_JS =
  `(function(){var t=false;` +
  `document.addEventListener('scroll',function(){if(t)return;t=true;` +
  `requestAnimationFrame(function(){t=false;` +
  `var e=document.documentElement;` +
  `var mx=Math.max(1,e.scrollWidth-window.innerWidth);` +
  `var my=Math.max(1,e.scrollHeight-window.innerHeight);` +
  `try{require('electron').ipcRenderer.send('scroll:from-view',` +
  `{id:window.__SL_ID,x:window.scrollX/mx,y:window.scrollY/my});` +
  `}catch(ex){}});},{passive:true,capture:true});})();`;

function applyScrollSync(wc, id) {
  wc.executeJavaScript(`window.__SL_ID=${JSON.stringify(id)};`);
  wc.executeJavaScript(SCROLL_JS).catch(() => {});
}

// ── IPC: Settings ─────────────────────────────────────────────────────────

ipcMain.handle('settings:get',       ()    => settings);
ipcMain.handle('settings:save', (_, data) => {
  settings = { ...settings, ...data };
  saveSettings(settings);
});

// ── IPC: Views ────────────────────────────────────────────────────────────

ipcMain.handle('views:create', (_, { id, ua, url }) => {
  if (views.has(id)) return;

  const devSess = session.fromPartition('persist:screenlab');
  const v = new WebContentsView({
    webPreferences: {
      session: devSess,
      contextIsolation: false,
      nodeIntegration: false,
      webSecurity: false, // bypass X-Frame-Options
    }
  });

  v.webContents.setUserAgent(ua);
  v.webContents.loadURL(url || settings.url);

  // Scroll sync preload
  v.webContents.on('dom-ready', () => {
    applyScrollSync(v.webContents, id);
  });

  mainWin.contentView.addChildView(v);
  // Nascosto finché il renderer non manda la posizione
  v.setBounds({ x: -9999, y: -9999, width: 1, height: 1 });

  views.set(id, v);
});

ipcMain.handle('views:destroy', (_, id) => {
  const v = views.get(id);
  if (!v) return;
  mainWin.contentView.removeChildView(v);
  views.delete(id);
});

ipcMain.handle('views:destroyAll', () => {
  for (const [id, v] of views) {
    mainWin.contentView.removeChildView(v);
  }
  views.clear();
});

// Posiziona le views — il renderer manda i bounding rect dei placeholder
ipcMain.handle('views:position', (_, rects) => {
  // rects: [{ id, x, y, width, height }]
  for (const r of rects) {
    const v = views.get(r.id);
    if (!v) continue;
    v.setBounds({
      x:      Math.round(r.x),
      y:      Math.round(r.y),
      width:  Math.round(r.width),
      height: Math.round(r.height),
    });
    // Porta le device views SOPRA la UI view
    mainWin.contentView.removeChildView(v);
    mainWin.contentView.addChildView(v);
  }
  // UI view sempre in cima per toolbar/sidebar
  mainWin.contentView.removeChildView(uiView);
  mainWin.contentView.addChildView(uiView);
});

ipcMain.handle('views:navigate', (_, url) => {
  settings.url = url;
  saveSettings(settings);
  for (const v of views.values()) v.webContents.loadURL(url);
});

ipcMain.handle('views:reload', () => {
  for (const v of views.values()) v.webContents.reload();
});

ipcMain.handle('views:back', () => {
  for (const v of views.values()) {
    if (v.webContents.canGoBack()) v.webContents.goBack();
  }
});

ipcMain.handle('views:forward', () => {
  for (const v of views.values()) {
    if (v.webContents.canGoForward()) v.webContents.goForward();
  }
});

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
  const result = {};
  for (const [id, v] of views) {
    const img = await v.webContents.capturePage();
    result[id] = img.toPNG().toString('base64');
  }
  return result;
});

ipcMain.handle('dialog:folder', async () => {
  const r = await dialog.showOpenDialog(mainWin, {
    properties: ['openDirectory'],
    title: 'Scegli cartella screenshot'
  });
  return r.canceled ? null : r.filePaths[0];
});

// ── Scroll sync: view → main → altri views ────────────────────────────────

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
    if (vid !== id) v.webContents.executeJavaScript(js).catch(() => {});
  }

  setTimeout(() => { syncingScroll = false; }, 100);
});
