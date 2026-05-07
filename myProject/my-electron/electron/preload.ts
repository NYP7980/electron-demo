import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getRuntimeConfig: () => ({
    wsUrl: process.env.GAME_SERVER_URL ?? process.env.REACT_APP_WS_URL ?? null,
  }),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content: string) => ipcRenderer.invoke('dialog:saveFile', content),
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('notification:show', { title, body }),
  onMenuNew: (callback: () => void) => {
    ipcRenderer.on('menu:new', callback);
    return () => ipcRenderer.removeListener('menu:new', callback);
  },
  onMenuAbout: (callback: () => void) => {
    ipcRenderer.on('menu:about', callback);
    return () => ipcRenderer.removeListener('menu:about', callback);
  },
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
});
