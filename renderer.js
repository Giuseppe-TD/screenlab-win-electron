'use strict';
// window.api è esposto da preload.js tramite contextBridge

let settings  = {};
let scale     = 0.5;
let spacing   = 24;
let liveTimer = null;
let sidebarOpen = true;

// Map<name, { dev, id }> — id = stringa univoca per la view
const activeCards = new Map();
let cardCounter = 0;

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  settings = await window.api.getSettings();
  scale    = (settings.scale || 50) / 100;
  spacing  = settings.spacing || 24;

  document.getElementById('url-input').value      = settings.url || 'https://www.google.com';
  document.getElementById('zoom-sl').value        = settings.scale || 50;
  document.getElementById('zoom-label').textContent = `${settings.scale || 50}%`;
  document.getElementById('spacing-sl').value     = spacing;
  document.getElementById('cards-wrap').style.gap = `${spacing}px`;
  document.getElementById('live-sel').value       = settings.liveInterval || 3;

  updateBtns();
  buildSidebar();
  await buildCards();
  if (settings.liveReload) startLive();
  bindEvents();
  bindResize();
}

// ── Sidebar ────────────────────────────────────────────────────────────────

function buildSidebar() {
  const list   = document.getElementById('device-list');
  const allDev = [...DEVICES, ...(settings.customDevices || [])];
  list.innerHTML = '';
  const cats = [...new Set(allDev.map(d => d.cat))];

  cats.forEach(cat => {
    const lbl = document.createElement('div');
    lbl.className = 'cat-label';
    lbl.textContent = cat.toUpperCase();
    list.appendChild(lbl);

    allDev.filter(d => d.cat === cat).forEach(dev => {
      const row = document.createElement('div');
      row.className = 'device-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = (settings.activeNames || []).includes(dev.name);
      cb.addEventListener('change', () => toggleDevice(dev.name, cb.checked));
      const info = document.createElement('div');
      info.className = 'device-info';
      info.innerHTML = `<div class="name">${dev.name}</div><div class="size">${dev.w}×${dev.h}</div>`;
      row.appendChild(cb);
      row.appendChild(info);
      list.appendChild(row);
    });
  });

  updateCount();
}

function updateCount() {
  document.getElementById('active-count').textContent =
    `${(settings.activeNames || []).length} attivi`;
}

async function toggleDevice(name, active) {
  const names = settings.activeNames || [];
  if (active) { if (!names.includes(name)) names.push(name); }
  else { const i = names.indexOf(name); if (i >= 0) names.splice(i, 1); }
  settings.activeNames = names;
  await window.api.saveSettings({ activeNames: names });
  await buildCards();
  updateCount();
}

// ── Cards ──────────────────────────────────────────────────────────────────

async function buildCards() {
  // Distruggi tutte le view esistenti
  await window.api.destroyAll();
  activeCards.clear();

  const wrap   = document.getElementById('cards-wrap');
  wrap.innerHTML = '';

  const allDev = [...DEVICES, ...(settings.customDevices || [])];
  const active = allDev.filter(d => (settings.activeNames || []).includes(d.name));

  for (const dev of active) {
    const id  = `card-${++cardCounter}`;
    const sw  = Math.round(dev.w * scale);
    const sh  = Math.round(dev.h * scale);
    const cr  = dev.cat === 'iPad' ? 14 : dev.cat === 'Android' ? 20 : 22;
    const scaledCr = Math.round(cr * scale);

    // Crea la WebContentsView nel main process
    await window.api.createView({ id, ua: dev.ua, url: settings.url });

    // Placeholder slot
    const slot = document.createElement('div');
    slot.className = 'card-slot';
    slot.dataset.id = id;

    // Header
    const header = document.createElement('div');
    header.className = 'card-header';
    header.style.width = `${sw}px`;
    header.innerHTML = `
      <div class="card-title">
        <div class="name">${dev.name}</div>
        <div class="size">${dev.w}×${dev.h}</div>
      </div>
      <button class="ss-btn" data-id="${id}">📷</button>`;
    header.querySelector('.ss-btn').onclick = () => takeScreenshot(id, dev);
    slot.appendChild(header);

    // Placeholder view (trasparente)
    const viewPlaceholder = document.createElement('div');
    viewPlaceholder.className = 'card-view';
    viewPlaceholder.dataset.id = id;
    viewPlaceholder.style.cssText = `width:${sw}px;height:${sh}px;border-radius:${scaledCr}px;`;
    slot.appendChild(viewPlaceholder);

    wrap.appendChild(slot);
    activeCards.set(id, { dev, id });
  }

  // Aggiorna le posizioni dopo che il DOM si è aggiornato
  requestAnimationFrame(() => requestAnimationFrame(syncViewPositions));
}

// Calcola le posizioni dei placeholder e le manda al main process
async function syncViewPositions() {
  const rects = [];
  for (const [id] of activeCards) {
    const el = document.querySelector(`.card-view[data-id="${id}"]`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    rects.push({
      id,
      x:      Math.round(r.left),
      y:      Math.round(r.top),
      width:  Math.round(r.width),
      height: Math.round(r.height),
    });
  }
  if (rects.length > 0) await window.api.positionViews(rects);
}

// ── Screenshot ─────────────────────────────────────────────────────────────

async function takeScreenshot(id, dev) {
  const folder = await window.api.pickFolder();
  if (!folder) return;
  const b64 = await window.api.screenshot(id);
  if (!b64) return;
  const safe = dev.name.replace(/ /g,'_').replace(/"/g,'in').replace(/\//g,'-');
  await window.api.saveFile(`${folder}\\${safe}_${dev.w}x${dev.h}.png`, b64);
}

async function screenshotAll() {
  const folder = await window.api.pickFolder();
  if (!folder) return;
  const all = await window.api.screenshotAll();
  for (const [id, b64] of Object.entries(all)) {
    const entry = activeCards.get(id);
    if (!entry) continue;
    const { dev } = entry;
    const safe = dev.name.replace(/ /g,'_').replace(/"/g,'in').replace(/\//g,'-');
    await window.api.saveFile(`${folder}\\${safe}_${dev.w}x${dev.h}.png`, b64);
  }
}

// ── Navigazione ────────────────────────────────────────────────────────────

async function navigate(url) {
  if (!url.startsWith('http')) url = 'https://' + url;
  document.getElementById('url-input').value = url;
  settings.url = url;
  await window.api.saveSettings({ url });
  await window.api.navigateAll(url);
}

// ── Live reload ────────────────────────────────────────────────────────────

function startLive() {
  const sec = parseInt(document.getElementById('live-sel').value) || 3;
  liveTimer = setInterval(() => window.api.reloadAll(), sec * 1000);
}
function stopLive() { clearInterval(liveTimer); liveTimer = null; }

// ── Zoom ───────────────────────────────────────────────────────────────────

async function applyZoom(val) {
  val  = Math.max(15, Math.min(100, val));
  scale = val / 100;
  document.getElementById('zoom-sl').value        = val;
  document.getElementById('zoom-label').textContent = `${val}%`;
  await window.api.saveSettings({ scale: val });
  settings.scale = val;
  await buildCards(); // ricostruisce con nuove dimensioni
}

// ── Update buttons ─────────────────────────────────────────────────────────

function updateBtns() {
  document.getElementById('btn-live').classList.toggle('active', settings.liveReload);
  document.getElementById('btn-sync').classList.toggle('active', settings.syncScroll !== false);
  document.getElementById('live-sel').style.display = settings.liveReload ? 'inline-block' : 'none';
}

// ── Resize observer ────────────────────────────────────────────────────────

function bindResize() {
  new ResizeObserver(() => {
    requestAnimationFrame(() => requestAnimationFrame(syncViewPositions));
  }).observe(document.getElementById('canvas'));
}

// ── Events ─────────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById('btn-sidebar').onclick = () => {
    sidebarOpen = !sidebarOpen;
    document.getElementById('sidebar').classList.toggle('collapsed', !sidebarOpen);
    requestAnimationFrame(() => requestAnimationFrame(syncViewPositions));
  };

  document.getElementById('btn-back').onclick   = () => window.api.goBack();
  document.getElementById('btn-fwd').onclick    = () => window.api.goForward();
  document.getElementById('btn-reload').onclick = () => window.api.reloadAll();

  const urlInput = document.getElementById('url-input');
  document.getElementById('go-btn').onclick = () => navigate(urlInput.value.trim());
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') navigate(urlInput.value.trim());
  });

  document.getElementById('btn-devtools').onclick = () => window.api.openDevtools(null);

  document.getElementById('btn-live').onclick = async () => {
    settings.liveReload = !settings.liveReload;
    await window.api.saveSettings({ liveReload: settings.liveReload });
    if (settings.liveReload) startLive(); else stopLive();
    updateBtns();
  };
  document.getElementById('live-sel').onchange = async e => {
    settings.liveInterval = parseInt(e.target.value);
    await window.api.saveSettings({ liveInterval: settings.liveInterval });
    if (settings.liveReload) { stopLive(); startLive(); }
  };

  document.getElementById('btn-sync').onclick = async () => {
    settings.syncScroll = !(settings.syncScroll !== false);
    await window.api.saveSettings({ syncScroll: settings.syncScroll });
    updateBtns();
  };

  const zoomSl = document.getElementById('zoom-sl');
  zoomSl.oninput = e => applyZoom(parseInt(e.target.value));
  document.getElementById('btn-zoom-m').onclick = () => applyZoom(parseInt(zoomSl.value) - 5);
  document.getElementById('btn-zoom-p').onclick = () => applyZoom(parseInt(zoomSl.value) + 5);

  document.getElementById('spacing-sl').oninput = async e => {
    spacing = parseInt(e.target.value);
    await window.api.saveSettings({ spacing });
    document.getElementById('cards-wrap').style.gap = `${spacing}px`;
    requestAnimationFrame(() => requestAnimationFrame(syncViewPositions));
  };

  document.getElementById('btn-screenshot-all').onclick = screenshotAll;

  document.getElementById('add-btn').onclick = () => {
    document.getElementById('modal').style.display = 'flex';
  };
  document.getElementById('m-cancel').onclick = () => {
    document.getElementById('modal').style.display = 'none';
  };
  document.getElementById('m-ok').onclick = async () => {
    const name = document.getElementById('m-name').value.trim();
    const w    = parseInt(document.getElementById('m-w').value);
    const h    = parseInt(document.getElementById('m-h').value);
    const ua   = document.getElementById('m-ua').value.trim();
    if (!name || !w || !h) return;
    const dev = { name, w, h, ua, cat: 'Custom' };
    settings.customDevices = settings.customDevices || [];
    settings.customDevices.push(dev);
    settings.activeNames = settings.activeNames || [];
    settings.activeNames.push(name);
    await window.api.saveSettings({ customDevices: settings.customDevices, activeNames: settings.activeNames });
    buildSidebar();
    await buildCards();
    document.getElementById('modal').style.display = 'none';
  };

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'r') { e.preventDefault(); window.api.reloadAll(); }
  });
}

init();
