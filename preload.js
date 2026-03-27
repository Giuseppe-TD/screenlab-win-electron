'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Settings
  getSettings:    ()      => ipcRenderer.invoke('settings:get'),
  saveSettings:   (data)  => ipcRenderer.invoke('settings:save', data),

  // Views — gestite dal main process come WebContentsView
  createView:     (info)  => ipcRenderer.invoke('views:create', info),
  destroyView:    (id)    => ipcRenderer.invoke('views:destroy', id),
  destroyAll:     ()      => ipcRenderer.invoke('views:destroyAll'),
  positionViews:  (rects) => ipcRenderer.invoke('views:position', rects),
  navigateAll:    (url)   => ipcRenderer.invoke('views:navigate', url),
  reloadAll:      ()      => ipcRenderer.invoke('views:reload'),
  goBack:         ()      => ipcRenderer.invoke('views:back'),
  goForward:      ()      => ipcRenderer.invoke('views:forward'),
  openDevtools:   (id)    => ipcRenderer.invoke('views:devtools', id),
  screenshot:     (id)    => ipcRenderer.invoke('views:screenshot', id),
  screenshotAll:  ()      => ipcRenderer.invoke('views:screenshotAll'),
  pickFolder:     ()      => ipcRenderer.invoke('dialog:folder'),

  // Events dal main → renderer
  on: (ch, fn) => {
    const valid = ['nav:url', 'scroll:sync'];
    if (valid.includes(ch)) ipcRenderer.on(ch, (_, ...args) => fn(...args));
  },
  off: (ch, fn) => ipcRenderer.removeListener(ch, fn),

  // Scroll sync (renderer → main → altri views)
  scrollSync: (id, x, y) => ipcRenderer.send('scroll:emit', { id, x, y }),
});
