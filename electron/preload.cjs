const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kubeDesktop', {
  catalogRequest: (path, body) => ipcRenderer.invoke('kube:catalog', path, body),
  request: url => ipcRenderer.invoke('kube:request', url),
  updateStatus: () => ipcRenderer.invoke('kube:update-status'),
  checkUpdate: () => ipcRenderer.invoke('kube:update-check'),
  installUpdate: () => ipcRenderer.invoke('kube:update-install'),
  openReleases: () => ipcRenderer.invoke('kube:releases'),
  onUpdate: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('kube:update-status', listener); return () => ipcRenderer.removeListener('kube:update-status', listener); },
});
