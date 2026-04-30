// src/components/game/RoomEntry.tsx
// Room entry component: room ID input, connect button, error display, anonymous notice
import React, { useState } from 'react';
import { usePlayer } from '../../contexts/PlayerContext';
import './RoomEntry.css';

interface RoomEntryProps {
    onJoin: (roomId: string) => void;
    loading?: boolean;
    error?: string | null;
}

/** Validates a room ID: must be non-empty after trimming. */
export function validateRoomId(value: string): boolean {
    return value.trim().length > 0;
}

export default function RoomEntry({ onJoin, loading = false, error = null }: RoomEntryProps) {
    const { state } = usePlayer();
    const [roomId, setRoomId] = useState('');
    const [validationError, setValidationError] = useState('');

    const isAnonymous = state.nickname === null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateRoomId(roomId)) {
            setValidationError('房间号不能为空');
            return;
        }
        setValidationError('');
        onJoin(roomId.trim());
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRoomId(e.target.value);
        if (validationError) setValidationError('');
    };

    const displayError = validationError || error;

    return (
        <div className="room-entry">
            <div className="room-entry__card">
                <h2 className="room-entry__title">加入游戏房间</h2>

                {isAnonymous && (
                    <div className="room-entry__anon-notice" role="note">
                        <span className="room-entry__anon-icon" aria-hidden="true">ℹ</span>
                        <span>您当前为匿名用户，进入房间后只能作为旁观者。</span>
                        <span className="room-entry__anon-hint">请在设置中设置昵称以参与游戏。</span>
                    </div>
                )}

                <form className="room-entry__form" onSubmit={handleSubmit} noValidate>
                    <label className="room-entry__label" htmlFor="room-id-input">
                        房间号
                    </label>
                    <input
                        id="room-id-input"
                        className={`room-entry__input${displayError ? ' room-entry__input--error' : ''}`}
                        type="text"
                        placeholder="输入房间号…"
                        value={roomId}
                        onChange={handleChange}
                        disabled={loading}
                        autoFocus
                        aria-describedby={displayError ? 'room-entry-error' : undefined}
                        aria-invalid={!!displayError}
                    />
                    {displayError && (
                        <p id="room-entry-error" className="room-entry__error" role="alert">
                            {displayError}
                        </p>
                    )}
                    <button
                        type="submit"
                        className="room-entry__btn"
                        disabled={loading}
                        aria-busy={loading}
                    >
                        {loading ? (
                            <>
                                <span className="room-entry__spinner" aria-hidden="true" />
                                连接中…
                            </>
                        ) : (
                            '进入房间'
                        )}
                    </button>
                </form>

                <p className="room-entry__hint">
                    输入已有房间号加入，或输入新房间号创建房间。
                </p>
            </div>
        </div>
    );
}
