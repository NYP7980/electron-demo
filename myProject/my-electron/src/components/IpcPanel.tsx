// src/components/IpcPanel.tsx
// IPC 通信模块：获取系统信息、发送系统通知
import { useState } from 'react';
import { SystemInfo } from '../types/electron-api';

const api = window.electronAPI;

export default function IpcPanel() {
    const [loading, setLoading] = useState(false);
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

    const handleGetSystemInfo = async () => {
        if (!api) return alert('请在 Electron 中运行');
        setLoading(true);
        try {
            const info = await api.getSystemInfo();
            setSystemInfo(info);
        } catch (e) {
            console.error('获取系统信息失败', e);
        } finally {
            setLoading(false);
        }
    };

    const handleNotification = async () => {
        if (!api) return alert('请在 Electron 中运行');
        try {
            await api.showNotification('测试通知', '这是一条来自 Electron 的系统通知');
        } catch (e) {
            console.error('发送通知失败', e);
        }
    };

    return (
        <section className="card">
            <h2>IPC 通信</h2>
            <div className="btn-group">
                <button onClick={handleGetSystemInfo} disabled={loading}>
                    {loading ? '获取中...' : '获取系统信息'}
                </button>
                <button onClick={handleNotification}>发送系统通知</button>
            </div>
            {systemInfo && (
                <table className="info-table">
                    <tbody>
                        {Object.entries(systemInfo).map(([k, v]) => (
                            <tr key={k}>
                                <td>{k}</td>
                                <td>{String(v)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}
