// src/types/electron-api.d.ts
// window.electronAPI 的完整 TS 类型声明，供渲染层 React 组件使用

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  electronVersion: string;
  chromeVersion: string;
  totalMemory: string;
  freeMemory: string;
  cpus: number;
  hostname: string;
}

export interface OpenFileResult {
  path: string;
  content: string;
}

export interface ElectronAPI {
  // IPC 通信
  getAppVersion: () => Promise<string>;
  getSystemInfo: () => Promise<SystemInfo>;
  // 文件操作
  openFile: () => Promise<OpenFileResult | null>;
  saveFile: (content: string) => Promise<boolean>;
  // 系统通知
  showNotification: (title: string, body: string) => Promise<void>;
  // 菜单事件监听，返回清理函数
  onMenuNew: (callback: () => void) => () => void;
  onMenuAbout: (callback: () => void) => () => void;
  // 窗口控制
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
