import { ipcMain, app, dialog, Notification, BrowserWindow } from 'electron';
import * as os from 'os';
import * as fs from 'fs';

export function registerIpcHandlers() {
  // 获取应用版本
  ipcMain.handle('app:getVersion', () => app.getVersion());

  // 获取系统信息
  ipcMain.handle('app:getSystemInfo', () => ({
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
    freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
    cpus: os.cpus().length,
    hostname: os.hostname(),
  }));

  // 打开文件对话框
  ipcMain.handle('dialog:openFile', async () => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: '文本文件', extensions: ['txt', 'md', 'json'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    });
    if (canceled || filePaths.length === 0) return null;
    const content = fs.readFileSync(filePaths[0], 'utf-8');
    return { path: filePaths[0], content };
  });

  // 保存文件对话框
  ipcMain.handle('dialog:saveFile', async (_event, content: string) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return false;
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    });
    if (canceled || !filePath) return false;
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  });

  // 系统通知
  ipcMain.handle('notification:show', (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  // 窗口控制
  ipcMain.handle('window:minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow();
    win?.isMaximized() ? win.unmaximize() : win?.maximize();
  });
  ipcMain.handle('window:close', () => BrowserWindow.getFocusedWindow()?.close());
}
