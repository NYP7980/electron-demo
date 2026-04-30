// src/components/game/GameLobby.tsx
// Game lobby: player list, game type selector (creator only), start button, spectator count, leave room
import React, { useState } from 'react';
import './GameLobby.css';

export type GameType = 'gomoku' | 'army-chess' | 'jungle-chess';

export interface LobbyPlayer {
    sessionId: string;
    nickname: string;
    connected: boolean;
}

interface GameLobbyProps {
    roomId: string;
    players: LobbyPlayer[];
    spectatorCount: number;
    selectedGame: GameType | null;
    gameStatus: 'lobby' | 'setup' | 'playing' | 'ended';
    isCreator: boolean;
    mySessionId: string;
    onSelectGame: (game: GameType) => void;
    onStartGame: () => void;
    onLeaveRoom: () => void;
}

const GAME_LABELS: Record<GameType, string> = {
    'gomoku': '五子棋',
    'army-chess': '陆战棋',
    'jungle-chess': '斗兽棋',
};

const GAME_MIN_PLAYERS: Record<GameType, number> = {
    'gomoku': 2,
    'army-chess': 2,
    'jungle-chess': 2,
};

export default function GameLobby({
    roomId,
    players,
    spectatorCount,
    selectedGame,
    gameStatus,
    isCreator,
    mySessionId,
    onSelectGame,
    onStartGame,
    onLeaveRoom,
}: GameLobbyProps) {
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    const inGame = gameStatus === 'playing' || gameStatus === 'setup';
    const canStart =
        isCreator &&
        selectedGame !== null &&
        players.length >= GAME_MIN_PLAYERS[selectedGame] &&
        gameStatus === 'lobby';

    const handleLeaveClick = () => {
        if (inGame) {
            setShowLeaveConfirm(true);
        } else {
            onLeaveRoom();
        }
    };

    const handleConfirmLeave = () => {
        setShowLeaveConfirm(false);
        onLeaveRoom();
    };

    return (
        <div className="game-lobby">
            <div className="game-lobby__header">
                <div className="game-lobby__room-info">
                    <span className="game-lobby__room-label">房间号</span>
                    <span className="game-lobby__room-id">{roomId}</span>
                </div>
                <button
                    className="game-lobby__leave-btn"
                    onClick={handleLeaveClick}
                    aria-label="离开房间"
                >
                    离开房间
                </button>
            </div>

            <div className="game-lobby__body">
                {/* Player list */}
                <section className="game-lobby__section" aria-label="玩家列表">
                    <h3 className="game-lobby__section-title">
                        玩家 ({players.length})
                        {spectatorCount > 0 && (
                            <span className="game-lobby__spectator-count">
                                · 旁观者 {spectatorCount}
                            </span>
                        )}
                    </h3>
                    <ul className="game-lobby__player-list" role="list">
                        {players.map((player) => (
                            <li key={player.sessionId} className="game-lobby__player-item">
                                <span
                                    className={`game-lobby__player-status ${player.connected ? 'game-lobby__player-status--online' : 'game-lobby__player-status--offline'}`}
                                    aria-label={player.connected ? '在线' : '离线'}
                                />
                                <span className="game-lobby__player-name">
                                    {player.nickname}
                                    {player.sessionId === mySessionId && (
                                        <span className="game-lobby__player-you"> (你)</span>
                                    )}
                                </span>
                                {!player.connected && (
                                    <span className="game-lobby__player-reconnecting">重连中…</span>
                                )}
                            </li>
                        ))}
                        {players.length === 0 && (
                            <li className="game-lobby__player-empty">暂无玩家</li>
                        )}
                    </ul>
                </section>

                {/* Game type selector */}
                <section className="game-lobby__section" aria-label="游戏类型">
                    <h3 className="game-lobby__section-title">游戏类型</h3>
                    {gameStatus === 'lobby' ? (
                        <div className="game-lobby__game-options" role="radiogroup" aria-label="选择游戏类型">
                            {(Object.keys(GAME_LABELS) as GameType[]).map((game) => (
                                <button
                                    key={game}
                                    role="radio"
                                    aria-checked={selectedGame === game}
                                    className={`game-lobby__game-option${selectedGame === game ? ' game-lobby__game-option--selected' : ''}`}
                                    onClick={() => isCreator && onSelectGame(game)}
                                    disabled={!isCreator}
                                    title={isCreator ? undefined : '只有房主可以选择游戏类型'}
                                >
                                    {GAME_LABELS[game]}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="game-lobby__game-active">
                            {selectedGame ? GAME_LABELS[selectedGame] : '未选择'}
                            <span className="game-lobby__game-status-badge">
                                {gameStatus === 'setup' ? '准备中' : gameStatus === 'playing' ? '游戏中' : '已结束'}
                            </span>
                        </div>
                    )}
                    {!isCreator && gameStatus === 'lobby' && (
                        <p className="game-lobby__creator-hint">等待房主选择游戏类型…</p>
                    )}
                </section>

                {/* Start game button (creator only) */}
                {isCreator && gameStatus === 'lobby' && (
                    <button
                        className="game-lobby__start-btn"
                        onClick={onStartGame}
                        disabled={!canStart}
                        title={
                            !selectedGame
                                ? '请先选择游戏类型'
                                : players.length < 2
                                    ? '至少需要 2 名玩家'
                                    : undefined
                        }
                    >
                        开始游戏
                    </button>
                )}
            </div>

            {/* Leave confirmation dialog */}
            {showLeaveConfirm && (
                <div className="game-lobby__confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="leave-confirm-title">
                    <div className="game-lobby__confirm-box">
                        <h3 id="leave-confirm-title" className="game-lobby__confirm-title">确认离开？</h3>
                        <p className="game-lobby__confirm-desc">游戏正在进行中，离开将导致对局中断。</p>
                        <div className="game-lobby__confirm-actions">
                            <button
                                className="game-lobby__confirm-btn game-lobby__confirm-btn--cancel"
                                onClick={() => setShowLeaveConfirm(false)}
                            >
                                取消
                            </button>
                            <button
                                className="game-lobby__confirm-btn game-lobby__confirm-btn--confirm"
                                onClick={handleConfirmLeave}
                            >
                                确认离开
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
