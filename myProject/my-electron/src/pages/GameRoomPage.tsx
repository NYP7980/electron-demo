// src/pages/GameRoomPage.tsx
// Game room page: orchestrates RoomEntry → GameLobby → game boards via WebSocket
import { useEffect, useCallback } from 'react';
import RoomEntry from '../components/game/RoomEntry';
import GameLobby, { GameType as LobbyGameType } from '../components/game/GameLobby';
import GomokuBoard from '../components/game/GomokuBoard';
import ArmyChessBoard from '../components/game/ArmyChessBoard';
import JungleChessBoard from '../components/game/JungleChessBoard';
import { useRoom } from '../contexts/RoomContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useGameSocket } from '../hooks/useGameSocket';
import type { GomokuMove } from '../games/gomoku';
import type { ArmyChessMove, ArmyChessPiece } from '../games/armyChess';
import type { JungleMove } from '../games/jungleChess';
import type { GomokuState } from '../games/gomoku';
import type { ArmyChessState } from '../games/armyChess';
import type { JungleChessState } from '../games/jungleChess';

export default function GameRoomPage() {
    const { roomState, sendMessage, dispatch } = useRoom();
    const { state: playerState } = usePlayer();
    // Initialise the WebSocket connection for this page
    const { connected, reconnecting } = useGameSocket();

    const {
        roomId,
        players,
        spectators,
        gameType,
        gameStatus,
        gameState,
        myRole,
        myTurn,
        lastError,
        sessionId,
    } = roomState;

    // Determine current view from room state
    const inRoom = roomId !== null;
    const inGame = gameStatus === 'playing' || gameStatus === 'setup' || gameStatus === 'ended';

    // ---- 11.1: Room entry → join_room ----
    const handleJoin = useCallback((id: string) => {
        sendMessage({
            type: 'join_room',
            roomId: id,
            nickname: playerState.nickname,
        });
    }, [sendMessage, playerState.nickname]);

    // ---- 11.2: Lobby → select_game / start_game ----
    const handleSelectGame = useCallback((game: LobbyGameType) => {
        sendMessage({ type: 'select_game', gameType: game });
    }, [sendMessage]);

    const handleStartGame = useCallback(() => {
        sendMessage({ type: 'start_game' });
    }, [sendMessage]);

    // ---- Leave room ----
    const handleLeaveRoom = useCallback(() => {
        sendMessage({ type: 'leave_room' });
        dispatch({ type: 'RESET' });
    }, [sendMessage, dispatch]);

    // ---- 11.3: Move flow helpers ----
    const handleGomokuMove = useCallback((move: GomokuMove) => {
        dispatch({ type: 'CLEAR_ERROR' });
        const seq = (gameState as GomokuState | null)?.seq ?? 0;
        sendMessage({ type: 'make_move', move, seq: seq + 1 });
    }, [sendMessage, gameState, dispatch]);

    const handleArmyMove = useCallback((move: ArmyChessMove) => {
        dispatch({ type: 'CLEAR_ERROR' });
        const seq = (gameState as ArmyChessState | null)?.seq ?? 0;
        sendMessage({ type: 'make_move', move, seq: seq + 1 });
    }, [sendMessage, gameState, dispatch]);

    const handleJungleMove = useCallback((move: JungleMove) => {
        dispatch({ type: 'CLEAR_ERROR' });
        const seq = (gameState as JungleChessState | null)?.seq ?? 0;
        sendMessage({ type: 'make_move', move, seq: seq + 1 });
    }, [sendMessage, gameState, dispatch]);

    // ---- 11.4: Army Chess setup confirmation ----
    const handleArmyConfirmSetup = useCallback((pieces: ArmyChessPiece[]) => {
        const arrangement = pieces.map(p => ({ id: p.id, row: p.row, col: p.col }));
        sendMessage({ type: 'confirm_setup', arrangement });
    }, [sendMessage]);

    // Determine if the local player is the room creator (first player in list)
    const isCreator = players.length > 0 && players[0].sessionId === sessionId;

    // Determine my side from the player list
    const myPlayerEntry = players.find(p => p.sessionId === sessionId);
    const mySide = myPlayerEntry?.side ?? null;

    // Derive last move for Gomoku highlight
    const gomokuState = gameType === 'gomoku' ? (gameState as GomokuState | null) : null;
    const armyState = gameType === 'army-chess' ? (gameState as ArmyChessState | null) : null;
    const jungleState = gameType === 'jungle-chess' ? (gameState as JungleChessState | null) : null;

    // Connection status banner
    const showReconnecting = reconnecting && !connected;

    // ---- Render ----

    // Entry screen (not yet in a room)
    if (!inRoom) {
        return (
            <main className="app-main" style={{ display: 'block' }}>
                {showReconnecting && (
                    <div className="ws-reconnecting-banner" role="status" aria-live="polite">
                        正在重新连接服务器…
                    </div>
                )}
                {!connected && !reconnecting && (
                    <div className="ws-disconnected-banner" role="status" aria-live="polite">
                        未连接到服务器，请稍候…
                    </div>
                )}
                <RoomEntry
                    onJoin={handleJoin}
                    loading={!connected}
                    error={lastError}
                />
            </main>
        );
    }

    // Lobby screen
    if (!inGame) {
        return (
            <main className="app-main" style={{ display: 'block' }}>
                <GameLobby
                    roomId={roomId!}
                    players={players}
                    spectatorCount={spectators}
                    selectedGame={gameType as LobbyGameType | null}
                    gameStatus={gameStatus}
                    isCreator={isCreator}
                    mySessionId={sessionId ?? ''}
                    onSelectGame={handleSelectGame}
                    onStartGame={handleStartGame}
                    onLeaveRoom={handleLeaveRoom}
                />
            </main>
        );
    }

    // Game screen
    return (
        <main className="app-main" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 24px 0' }}>
                {/* 11.3: move_rejected error display */}
                {lastError && (
                    <span className="game-move-error" role="alert" style={{ color: '#f87171', fontSize: 14 }}>
                        {lastError}
                    </span>
                )}
                <button
                    style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #5a3a3a', color: '#f87171', borderRadius: 6, padding: '4px 14px', cursor: 'pointer' }}
                    onClick={handleLeaveRoom}
                >
                    离开房间
                </button>
            </div>

            {/* 11.3: game_ended overlay */}
            {gameStatus === 'ended' && (
                <GameEndedOverlay
                    gameState={gameState}
                    gameType={gameType}
                    mySide={mySide}
                    onLeave={handleLeaveRoom}
                />
            )}

            {gameType === 'gomoku' && gomokuState && (
                <GomokuBoard
                    state={gomokuState}
                    myTurn={myTurn}
                    mySide={mySide as 1 | 2 | null}
                    lastMove={null}
                    onMove={handleGomokuMove}
                />
            )}

            {gameType === 'army-chess' && armyState && (
                <ArmyChessBoard
                    state={armyState}
                    mySide={mySide as 'red' | 'blue' | null}
                    myTurn={myTurn}
                    onMove={handleArmyMove}
                    onConfirmSetup={handleArmyConfirmSetup}
                />
            )}

            {gameType === 'jungle-chess' && jungleState && (
                <JungleChessBoard
                    state={jungleState}
                    mySide={mySide as 'red' | 'blue' | null}
                    myTurn={myTurn}
                    onMove={handleJungleMove}
                />
            )}
        </main>
    );
}

// ---- Game ended overlay (11.3: game_ended) ----
interface GameEndedOverlayProps {
    gameState: unknown;
    gameType: string | null;
    mySide: string | null;
    onLeave: () => void;
}

function GameEndedOverlay({ gameState, gameType, mySide, onLeave }: GameEndedOverlayProps) {
    const winner = (gameState as { winner?: string | number | null } | null)?.winner ?? null;

    let resultText = '游戏结束';
    if (winner === null || winner === 0) {
        resultText = '平局！';
    } else if (mySide !== null && String(winner) === String(mySide)) {
        resultText = '🎉 你赢了！';
    } else {
        const label = gameType === 'gomoku'
            ? (winner === 1 ? '黑棋' : '白棋')
            : (winner === 'red' ? '红方' : '蓝方');
        resultText = `${label}获胜`;
    }

    return (
        <div
            className="game-ended-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="游戏结束"
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
            }}
        >
            <div style={{
                background: '#1e1e2e', borderRadius: 12, padding: '40px 56px',
                textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
                <h2 style={{ fontSize: 28, marginBottom: 24, color: '#e2e8f0' }}>{resultText}</h2>
                <button
                    onClick={onLeave}
                    style={{
                        background: '#7c3aed', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '10px 28px', fontSize: 16, cursor: 'pointer',
                    }}
                >
                    离开房间
                </button>
            </div>
        </div>
    );
}
