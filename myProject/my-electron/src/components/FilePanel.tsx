// src/components/FilePanel.tsx
// 文件操作模块：打开文件、编辑内容、保存文件

import { useState } from 'react';

const api = window.electronAPI;

// 接收父组件传入的初始内容（菜单"新建"时清空）
interface FilePanelProps {
    initialContent?: string;
}

export default function FilePanel({ initialContent = '' }: FilePanelProps) {
    const [fileContent, setFileContent] = useState(initialContent);
    const [openLoading, setOpenLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);

    const handleOpenFile = async () => {
        if (!api) return alert('请在 Electron 中运行');
        setOpenLoading(true);
        try {
            const result = await api.openFile();
            if (result) setFileContent(result.content);
        } catch (e) {
            console.error('打开文件失败', e);
        } finally {
            setOpenLoading(false);
        }
    };

    const handleSaveFile = async () => {
        if (!api) return alert('请在 Electron 中运行');
        setSaveLoading(true);
        try {
            const ok = await api.saveFile(fileContent);
            if (ok) await api.showNotification('保存成功', '文件已保存到本地');
        } catch (e) {
            console.error('保存文件失败', e);
        } finally {
            setSaveLoading(false);
        }
    };

    return (
        <section className="card">
            <h2>文件操作</h2>
            <div className="btn-group">
                <button onClick={handleOpenFile} disabled={openLoading}>
                    {openLoading ? '打开中...' : '打开文件'}
                </button>
                <button onClick={handleSaveFile} disabled={!fileContent || saveLoading}>
                    {saveLoading ? '保存中...' : '保存文件'}
                </button>
            </div>
            <textarea
                className="file-editor"
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="打开文件或直接输入内容..."
                rows={8}
            />
        </section>
    );
}
