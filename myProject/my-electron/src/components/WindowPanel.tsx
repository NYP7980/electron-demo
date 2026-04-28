// src/components/WindowPanel.tsx
// 窗口控制模块：最小化、最大化/还原、关闭窗口

const api = window.electronAPI;

export default function WindowPanel() {
    return (
        <section className="card">
            <h2>窗口控制</h2>
            <div className="btn-group">
                <button onClick={() => api?.minimizeWindow()}>最小化</button>
                <button onClick={() => api?.maximizeWindow()}>最大化/还原</button>
                <button onClick={() => api?.closeWindow()} className="btn-danger">
                    关闭窗口
                </button>
            </div>
        </section>
    );
}
