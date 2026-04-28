// src/App.tsx
// 根组件：组合各功能模块，处理全局菜单事件（新建/关于）
import { useEffect, useState } from 'react';
import './App.css';
import IpcPanel from './components/IpcPanel';
import FilePanel from './components/FilePanel';
import WindowPanel from './components/WindowPanel';

const api = window.electronAPI;

function App() {
  const [version, setVersion] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  // 用 key 触发 FilePanel 重置（菜单"新建"时重新挂载组件以清空内容）
  const [fileKey, setFileKey] = useState(0);

  useEffect(() => {
    if (!api) return;

    api.getAppVersion().then(setVersion);

    // 监听主进程菜单事件，返回清理函数在组件卸载时移除监听
    const cleanNew = api.onMenuNew(() => setFileKey((k) => k + 1));
    const cleanAbout = api.onMenuAbout(() => setShowAbout(true));

    return () => {
      cleanNew();
      cleanAbout();
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Electron + React 模板</h1>
        <span className="version">v{version}</span>
      </header>

      <main className="app-main">
        {/* IPC 通信：获取系统信息、发送通知 */}
        <IpcPanel />

        {/* 文件操作：打开/编辑/保存文件，key 变化时重置组件状态 */}
        <FilePanel key={fileKey} />

        {/* 窗口控制：最小化、最大化/还原、关闭 */}
        <WindowPanel />
      </main>

      {/* 关于弹窗（由菜单事件触发） */}
      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>关于</h2>
            <p>Electron + React + TypeScript 模板</p>
            <p>版本：{version}</p>
            <button onClick={() => setShowAbout(false)}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
