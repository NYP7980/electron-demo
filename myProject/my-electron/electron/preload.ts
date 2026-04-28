import { contextBridge, ipcRenderer } from 'electron';

// 通过 contextBridge 安全地暴露 API 给渲染进程
// 渲染进程通过 window.electronAPI 访问
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取应用版本
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 获取系统信息
  getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),

  // 打开文件对话框
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  // 保存文件
  saveFile: (content: string) => ipcRenderer.invoke('dialog:saveFile', content),

  // 发送通知
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('notification:show', { title, body }),

  // 监听主进程推送的菜单事件
  onMenuNew: (callback: () => void) => {
    ipcRenderer.on('menu:new', callback);
    return () => ipcRenderer.removeListener('menu:new', callback); // 返回清理函数
  },

  onMenuAbout: (callback: () => void) => {
    ipcRenderer.on('menu:about', callback);
    return () => ipcRenderer.removeListener('menu:about', callback);
  },

  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
});
