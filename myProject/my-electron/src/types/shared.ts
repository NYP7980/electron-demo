// src/types/shared.ts
// Client-side copy of shared WebSocket protocol types (mirrors server/src/types.ts)

export type GameType = 'gomoku' | 'army-chess' | 'jungle-chess';

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------
export type ClientMessage =
  | { type: 'join_room';      roomId: string; nickname: string | null }
  | { type: 'leave_room' }
  | { type: 'select_game';    gameType: GameType }
  | { type: 'start_game' }
  | { type: 'make_move';      move: GameMove; seq: number }
  | { type: 'confirm_setup';  arrangement: ArmyChessPieceArrangement[] }
  | { type: 'ping' };

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------
export type ServerMessage =
  | { type: 'session_init';        sessionId: string }
  | { type: 'room_joined';         roomId: string; players: RoomPlayer[]; spectators: number; gameType: GameType | null; gameStatus: string }
  | { type: 'room_updated';        players: RoomPlayer[]; spectators: number }
  | { type: 'game_selected';       gameType: GameType }
  | { type: 'game_started';        gameState: unknown }
  | { type: 'move_applied';        move: GameMove; gameState: unknown; seq: number }
  | { type: 'move_rejected';       reason: string; seq: number }
  | { type: 'game_ended';          winner: string | null; reason: string }
  | { type: 'player_disconnected'; nickname: string; reconnectTimeout: number }
  | { type: 'player_reconnected';  nickname: string }
  | { type: 'error';               code: string; message: string }
  | { type: 'pong' };

// ---------------------------------------------------------------------------
// Game move types
// ---------------------------------------------------------------------------
export interface GomokuMove {
  row: number;
  col: number;
}

export interface ArmyChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export interface JungleChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export type GameMove = GomokuMove | ArmyChessMove | JungleChessMove;

export interface ArmyChessPieceArrangement {
  id: string;
  row: number;
  col: number;
}

// ---------------------------------------------------------------------------
// Room / player models
// ---------------------------------------------------------------------------
export interface RoomPlayer {
  sessionId: string;
  nickname: string;
  connected: boolean;
  side: 'red' | 'blue' | null;
}
