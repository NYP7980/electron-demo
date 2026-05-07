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

export interface RuntimeConfig {
  wsUrl: string | null;
}

export interface ElectronAPI {
  getRuntimeConfig: () => RuntimeConfig;
  getAppVersion: () => Promise<string>;
  getSystemInfo: () => Promise<SystemInfo>;
  openFile: () => Promise<OpenFileResult | null>;
  saveFile: (content: string) => Promise<boolean>;
  showNotification: (title: string, body: string) => Promise<void>;
  onMenuNew: (callback: () => void) => () => void;
  onMenuAbout: (callback: () => void) => () => void;
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
