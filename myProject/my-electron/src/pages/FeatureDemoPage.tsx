// src/pages/FeatureDemoPage.tsx
// 功能演示页：展示 Electron IPC、文件操作、窗口控制等能力
import { useEffect, useState } from 'react';
import IpcPanel from '../components/IpcPanel';
import FilePanel from '../components/FilePanel';
import WindowPanel from '../components/WindowPanel';

const api = window.electronAPI;

export default function FeatureDemoPage() {
    const [fileKey, setFileKey] = useState(0);
    const [showAbout, setShowAbout] = useState(false);
    const [version, setVersion] = useState('');

    useEffect(() => {
        if (!api) return;

        api.getAppVersion().then(setVersion);

        const cleanNew = api.onMenuNew(() => setFileKey((k) => k + 1));
        const cleanAbout = api.onMenuAbout(() => setShowAbout(true));

        return () => {
            cleanNew();
            cleanAbout();
        };
    }, []);

    return (
        <>
            <main className="app-main">
                <IpcPanel />
                <FilePanel key={fileKey} />
                <WindowPanel />
            </main>

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
        </>
    );
}
