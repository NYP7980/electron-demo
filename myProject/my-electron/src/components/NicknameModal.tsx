// src/components/NicknameModal.tsx
// Modal for setting/changing player nickname. Shows on first launch if no nickname stored.
import React, { useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import './NicknameModal.css';

interface NicknameModalProps {
    onClose: () => void;
}

/** Validates a nickname: 1–16 non-whitespace characters (after trimming). */
export function validateNickname(value: string): boolean {
    const trimmed = value.trim();
    return trimmed.length >= 1 && trimmed.length <= 16;
}

export default function NicknameModal({ onClose }: NicknameModalProps) {
    const { setNickname, clearNickname } = usePlayer();
    const [input, setInput] = useState('');
    const [error, setError] = useState('');

    const handleConfirm = () => {
        if (!validateNickname(input)) {
            setError('昵称须为 1–16 个非空白字符');
            return;
        }
        setNickname(input.trim());
        onClose();
    };

    const handleSkip = () => {
        clearNickname();
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleConfirm();
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="nickname-modal-title">
            <div className="modal-box">
                <h2 id="nickname-modal-title" className="modal-title">设置昵称</h2>
                <p className="modal-desc">请输入一个昵称以参与游戏（1–16 个字符）</p>
                <input
                    className="modal-input"
                    type="text"
                    placeholder="输入昵称…"
                    value={input}
                    onChange={e => { setInput(e.target.value); setError(''); }}
                    onKeyDown={handleKeyDown}
                    maxLength={32}
                    autoFocus
                    aria-label="昵称输入框"
                />
                {error && <p className="modal-error" role="alert">{error}</p>}
                <div className="modal-actions">
                    <button className="modal-btn modal-btn--skip" onClick={handleSkip}>
                        跳过
                    </button>
                    <button className="modal-btn modal-btn--confirm" onClick={handleConfirm}>
                        确认
                    </button>
                </div>
            </div>
        </div>
    );
}
