// src/contexts/PlayerContext.tsx
// Player identity context: manages nickname state with localStorage persistence
import React, { createContext, useContext, useReducer, useEffect } from 'react';

const STORAGE_KEY = 'player_nickname';

export interface PlayerState {
    nickname: string | null; // null = Anonymous_User
}

type PlayerAction =
    | { type: 'SET_NICKNAME'; payload: string }
    | { type: 'CLEAR_NICKNAME' };

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
    switch (action.type) {
        case 'SET_NICKNAME':
            return { nickname: action.payload };
        case 'CLEAR_NICKNAME':
            return { nickname: null };
        default:
            return state;
    }
}

interface PlayerContextValue {
    state: PlayerState;
    setNickname: (nickname: string) => void;
    clearNickname: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
    const stored = localStorage.getItem(STORAGE_KEY);
    const [state, dispatch] = useReducer(playerReducer, {
        nickname: stored || null,
    });

    // Persist to localStorage whenever nickname changes
    useEffect(() => {
        if (state.nickname !== null) {
            localStorage.setItem(STORAGE_KEY, state.nickname);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, [state.nickname]);

    const setNickname = (nickname: string) =>
        dispatch({ type: 'SET_NICKNAME', payload: nickname });

    const clearNickname = () => dispatch({ type: 'CLEAR_NICKNAME' });

    return (
        <PlayerContext.Provider value={{ state, setNickname, clearNickname }}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer(): PlayerContextValue {
    const ctx = useContext(PlayerContext);
    if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
    return ctx;
}
