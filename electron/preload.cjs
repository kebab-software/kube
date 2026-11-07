const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kubeDesktop', { request: url => ipcRenderer.invoke('kube:request', url) });
