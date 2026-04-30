// src/contexts/RoomContext.tsx
// Room state context: manages all server-driven room and game state via useReducer
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { ServerMessage, RoomPlayer, GameType } from '../types/shared';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------
export interface RoomState {
    roomId: string | null;
    players: RoomPlayer[];
    spectators: number;
    gameType: GameType | null;
    gameStatus: 'lobby' | 'setup' | 'playing' | 'ended';
    gameState: unknown | null;
    myRole: 'player' | 'spectator';
    myTurn: boolean;
    lastError: string | null;
    connected: boolean;
    reconnecting: boolean;
    sessionId: string | null;
}

const initialState: RoomState = {
    roomId: null,
    players: [],
    spectators: 0,
    gameType: null,
    gameStatus: 'lobby',
    gameState: null,
    myRole: 'spectator',
    myTurn: false,
    lastError: null,
    connected: false,
    reconnecting: false,
    sessionId: null,
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
export type RoomAction =
    | { type: 'CONNECTED' }
    | { type: 'DISCONNECTED' }
    | { type: 'RECONNECTING' }
    | { type: 'SERVER_MESSAGE'; message: ServerMessage }
    | { type: 'SET_MY_ROLE'; role: 'player' | 'spectator' }
    | { type: 'SET_MY_TURN'; myTurn: boolean }
    | { type: 'CLEAR_ERROR' }
    | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
function roomReducer(state: RoomState, action: RoomAction): RoomState {
    switch (action.type) {
        case 'CONNECTED':
            return { ...state, connected: true, reconnecting: false, lastError: null };

        case 'DISCONNECTED':
            return { ...state, connected: false, reconnecting: false };

        case 'RECONNECTING':
            return { ...state, reconnecting: true };

        case 'CLEAR_ERROR':
            return { ...state, lastError: null };

        case 'RESET':
            return { ...initialState };

        case 'SET_MY_ROLE':
            return { ...state, myRole: action.role };

        case 'SET_MY_TURN':
            return { ...state, myTurn: action.myTurn };

        case 'SERVER_MESSAGE':
            return applyServerMessage(state, action.message);

        default:
            return state;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine if it is the local player's turn based on game state and their assigned side. */
function computeMyTurn(state: RoomState, gameState: unknown): boolean {
    if (!state.sessionId || state.myRole !== 'player') return false;
    const myEntry = state.players.find(p => p.sessionId === state.sessionId);
    if (!myEntry?.side) return false;

    const gs = gameState as Record<string, unknown> | null;
    if (!gs) return false;

    const currentTurn = gs['currentTurn'];
    return currentTurn === myEntry.side;
}

function applyServerMessage(state: RoomState, msg: ServerMessage): RoomState {
    switch (msg.type) {
        case 'session_init':
            return { ...state, sessionId: msg.sessionId };

        case 'room_joined': {
            // Determine role: if sessionId is in the players list → player, else spectator
            const myEntry = state.sessionId
                ? msg.players.find(p => p.sessionId === state.sessionId)
                : undefined;
            return {
                ...state,
                roomId: msg.roomId,
                players: msg.players,
                spectators: msg.spectators,
                gameType: msg.gameType,
                gameStatus: msg.gameStatus as RoomState['gameStatus'],
                myRole: myEntry ? 'player' : 'spectator',
                lastError: null,
            };
        }

        case 'room_updated': {
            const myEntry = state.sessionId
                ? msg.players.find(p => p.sessionId === state.sessionId)
                : undefined;
            return {
                ...state,
                players: msg.players,
                spectators: msg.spectators,
                myRole: myEntry ? 'player' : 'spectator',
            };
        }

        case 'game_selected':
            return { ...state, gameType: msg.gameType };

        case 'game_started': {
            // Army Chess starts in 'setup' phase; other games go straight to 'playing'
            const gs = msg.gameState as Record<string, unknown> | null;
            const phase = gs?.['phase'];
            const status: RoomState['gameStatus'] = phase === 'setup' ? 'setup' : 'playing';
            const myTurn = status === 'playing' ? computeMyTurn(state, msg.gameState) : false;
            return { ...state, gameStatus: status, gameState: msg.gameState, myTurn, lastError: null };
        }

        case 'move_applied': {
            const myTurn = computeMyTurn(state, msg.gameState);
            // If game state transitions from setup to playing, update status
            const gs = msg.gameState as Record<string, unknown> | null;
            const phase = gs?.['phase'];
            const newStatus: RoomState['gameStatus'] =
                state.gameStatus === 'setup' && phase === 'playing' ? 'playing' : state.gameStatus;
            return { ...state, gameState: msg.gameState, gameStatus: newStatus, myTurn, lastError: null };
        }

        case 'move_rejected':
            return { ...state, lastError: msg.reason };

        case 'game_ended':
            return { ...state, gameStatus: 'ended' };

        case 'player_disconnected':
            return {
                ...state,
                players: state.players.map(p =>
                    p.nickname === msg.nickname ? { ...p, connected: false } : p
                ),
            };

        case 'player_reconnected':
            return {
                ...state,
                players: state.players.map(p =>
                    p.nickname === msg.nickname ? { ...p, connected: true } : p
                ),
            };

        case 'error':
            return { ...state, lastError: msg.message };

        case 'pong':
            return state;

        default:
            return state;
    }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
interface RoomContextValue {
    roomState: RoomState;
    dispatch: React.Dispatch<RoomAction>;
    /** Convenience: send a message via the socket (injected by useGameSocket) */
    sendMessage: (msg: { type: string;[key: string]: unknown }) => void;
    setSendMessage: (fn: (msg: { type: string;[key: string]: unknown }) => void) => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ children }: { children: React.ReactNode }) {
    const [roomState, dispatch] = useReducer(roomReducer, initialState);

    // sendMessage is injected by useGameSocket after the socket connects.
    // We store it in a ref-like pattern via state so the context value stays stable.
    const [sendFn, setSendFn] = React.useState<(msg: { type: string;[key: string]: unknown }) => void>(
        () => () => { console.warn('Socket not connected yet'); }
    );

    const setSendMessage = useCallback(
        (fn: (msg: { type: string;[key: string]: unknown }) => void) => {
            setSendFn(() => fn);
        },
        []
    );

    return (
        <RoomContext.Provider value={{ roomState, dispatch, sendMessage: sendFn, setSendMessage }}>
            {children}
        </RoomContext.Provider>
    );
}

export function useRoom(): RoomContextValue {
    const ctx = useContext(RoomContext);
    if (!ctx) throw new Error('useRoom must be used within RoomProvider');
    return ctx;
}
