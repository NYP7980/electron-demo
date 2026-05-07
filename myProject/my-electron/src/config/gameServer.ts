import type { RuntimeConfig } from '../types/electron-api';

const DEFAULT_LOCAL_WS_URL = 'ws://localhost:4000';

function getElectronRuntimeConfig(): RuntimeConfig | null {
  try {
    return window.electronAPI?.getRuntimeConfig?.() ?? null;
  } catch {
    return null;
  }
}

export function getGameServerUrl(): string {
  const electronConfig = getElectronRuntimeConfig();
  const runtimeUrl = electronConfig?.wsUrl?.trim();

  if (runtimeUrl) {
    return runtimeUrl;
  }

  const envUrl = process.env.REACT_APP_WS_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  return DEFAULT_LOCAL_WS_URL;
}
