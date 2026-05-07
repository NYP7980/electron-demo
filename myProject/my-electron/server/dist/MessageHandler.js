"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageHandler = void 0;
// Game engines (copied from client src — server has its own copy via symlink or duplication)
// We import from the shared location. For now we re-export the same logic inline.
// The server copies of the game engines live in server/src/games/
const Gomoku = __importStar(require("./games/gomoku"));
const ArmyChess = __importStar(require("./games/armyChess"));
const JungleChess = __importStar(require("./games/jungleChess"));
class MessageHandler {
    constructor(sessions, rooms) {
        this.sessions = sessions;
        this.rooms = rooms;
    }
    handle(sessionId, msg) {
        switch (msg.type) {
            case 'ping':
                this.sessions.send(sessionId, { type: 'pong' });
                break;
            case 'join_room':
                this.handleJoinRoom(sessionId, msg.roomId, msg.nickname);
                break;
            case 'leave_room':
                this.handleLeaveRoom(sessionId);
                break;
            case 'select_game':
                this.handleSelectGame(sessionId, msg.gameType);
                break;
            case 'start_game':
                this.handleStartGame(sessionId);
                break;
            case 'make_move':
                this.handleMakeMove(sessionId, msg.move, msg.seq);
                break;
            case 'confirm_setup':
                this.handleConfirmSetup(sessionId, msg.arrangement);
                break;
        }
    }
    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------
    handleJoinRoom(sessionId, roomId, nickname) {
        const error = this.rooms.joinRoom(sessionId, roomId, nickname);
        if (error) {
            this.sessions.send(sessionId, { type: 'error', code: 'JOIN_FAILED', message: error });
        }
    }
    handleLeaveRoom(sessionId) {
        this.rooms.leaveRoom(sessionId);
    }
    handleSelectGame(sessionId, gameType) {
        const room = this.rooms.getRoomForSession(sessionId);
        if (!room) {
            this.sessions.send(sessionId, { type: 'error', code: 'NOT_IN_ROOM', message: 'You are not in a room' });
            return;
        }
        if (room.creatorId !== sessionId) {
            this.sessions.send(sessionId, { type: 'error', code: 'NOT_CREATOR', message: 'Only the room creator can select the game type' });
            return;
        }
        if (room.gameStatus !== 'lobby') {
            this.sessions.send(sessionId, { type: 'error', code: 'GAME_IN_PROGRESS', message: 'Cannot change game type while a game is in progress' });
            return;
        }
        room.gameType = gameType;
        this.rooms.broadcast(room, { type: 'game_selected', gameType });
    }
    handleStartGame(sessionId) {
        const room = this.rooms.getRoomForSession(sessionId);
        if (!room) {
            this.sessions.send(sessionId, { type: 'error', code: 'NOT_IN_ROOM', message: 'You are not in a room' });
            return;
        }
        if (room.creatorId !== sessionId) {
            this.sessions.send(sessionId, { type: 'error', code: 'NOT_CREATOR', message: 'Only the room creator can start the game' });
            return;
        }
        if (!room.gameType) {
            this.sessions.send(sessionId, { type: 'error', code: 'NO_GAME_TYPE', message: 'Select a game type first' });
            return;
        }
        if (room.players.size < 2) {
            this.sessions.send(sessionId, { type: 'error', code: 'NOT_ENOUGH_PLAYERS', message: 'Need at least 2 players to start' });
            return;
        }
        let initialState;
        if (room.gameType === 'gomoku') {
            initialState = Gomoku.createInitialState();
            room.gameStatus = 'playing';
        }
        else if (room.gameType === 'army-chess') {
            initialState = ArmyChess.createInitialState();
            room.gameStatus = 'setup';
        }
        else {
            initialState = JungleChess.createInitialState();
            room.gameStatus = 'playing';
        }
        room.gameState = initialState;
        room.seq = 0;
        this.rooms.broadcast(room, { type: 'game_started', gameState: initialState });
    }
    handleMakeMove(sessionId, move, seq) {
        const room = this.rooms.getRoomForSession(sessionId);
        if (!room) {
            this.sessions.send(sessionId, { type: 'error', code: 'NOT_IN_ROOM', message: 'You are not in a room' });
            return;
        }
        if (room.gameStatus !== 'playing') {
            this.sessions.send(sessionId, { type: 'move_rejected', reason: 'Game is not in playing state', seq });
            return;
        }
        const seqError = this.rooms.validateAndAdvanceSeq(room, seq);
        if (seqError) {
            this.sessions.send(sessionId, { type: 'move_rejected', reason: seqError, seq });
            return;
        }
        const player = room.players.get(sessionId);
        if (!player) {
            this.sessions.send(sessionId, { type: 'move_rejected', reason: 'You are not a player in this room', seq });
            return;
        }
        let result;
        if (room.gameType === 'gomoku') {
            const state = room.gameState;
            const side = player.side === 'red' ? 1 : 2;
            const gomokuMove = move;
            result = Gomoku.applyMove(state, gomokuMove, side);
        }
        else if (room.gameType === 'army-chess') {
            const state = room.gameState;
            const side = player.side;
            const acMove = move;
            // Find piece at fromRow/fromCol
            const piece = ArmyChess.getPieceAt(state, acMove.fromRow, acMove.fromCol);
            if (!piece) {
                result = { ok: false, error: 'No piece at source position' };
            }
            else {
                const validMoves = ArmyChess.getValidMoves(state, piece.id);
                const isValid = validMoves.some(m => m.toRow === acMove.toRow && m.toCol === acMove.toCol);
                if (!isValid) {
                    result = { ok: false, error: 'Invalid move' };
                }
                else {
                    // applyMove will be added when Army Chess engine is complete
                    result = { ok: false, error: 'Army Chess move application not yet implemented' };
                }
            }
        }
        else {
            const state = room.gameState;
            const side = player.side;
            const jMove = move;
            result = JungleChess.applyMove(state, jMove, side);
        }
        if (!result.ok) {
            // Revert seq since move was rejected
            room.seq--;
            this.sessions.send(sessionId, { type: 'move_rejected', reason: result.error ?? 'Invalid move', seq });
            return;
        }
        room.gameState = result.state;
        const newState = result.state;
        this.rooms.broadcast(room, {
            type: 'move_applied',
            move,
            gameState: result.state,
            seq: room.seq,
        });
        // Check for game end
        if (newState.winner !== undefined && newState.winner !== null) {
            room.gameStatus = 'ended';
            const winner = newState.winner;
            let winnerNickname = null;
            if (winner === 1 || winner === 'red') {
                for (const [, p] of room.players) {
                    if (p.side === 'red') {
                        winnerNickname = p.nickname;
                        break;
                    }
                }
            }
            else if (winner === 2 || winner === 'blue') {
                for (const [, p] of room.players) {
                    if (p.side === 'blue') {
                        winnerNickname = p.nickname;
                        break;
                    }
                }
            }
            this.rooms.broadcast(room, {
                type: 'game_ended',
                winner: winnerNickname,
                reason: 'win',
            });
        }
        else if (newState.winner === 0) {
            room.gameStatus = 'ended';
            this.rooms.broadcast(room, { type: 'game_ended', winner: null, reason: 'draw' });
        }
    }
    handleConfirmSetup(sessionId, arrangement) {
        const room = this.rooms.getRoomForSession(sessionId);
        if (!room || room.gameType !== 'army-chess') {
            this.sessions.send(sessionId, { type: 'error', code: 'INVALID_STATE', message: 'Not in an Army Chess setup phase' });
            return;
        }
        const state = room.gameState;
        const player = room.players.get(sessionId);
        if (!player || !player.side)
            return;
        const side = player.side;
        // Apply arrangement to state
        const newPieces = state.pieces.map(p => {
            if (p.side !== side)
                return p;
            const override = arrangement.find(a => a.id === p.id);
            if (override)
                return { ...p, row: override.row, col: override.col };
            return p;
        });
        const newSetupConfirmed = { ...state.setupConfirmed, [side]: true };
        const newState = {
            ...state,
            pieces: newPieces,
            setupConfirmed: newSetupConfirmed,
        };
        room.gameState = newState;
        if (newSetupConfirmed.red && newSetupConfirmed.blue) {
            room.gameStatus = 'playing';
            const playingState = { ...newState, phase: 'playing' };
            room.gameState = playingState;
            this.rooms.broadcast(room, { type: 'game_started', gameState: playingState });
        }
    }
}
exports.MessageHandler = MessageHandler;
