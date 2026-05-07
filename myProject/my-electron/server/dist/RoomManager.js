"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomManager = void 0;
const ROOM_CLEANUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const RECONNECT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
/** Maximum players per game type (2 for all current games). */
const MAX_PLAYERS = {
    'gomoku': 2,
    'army-chess': 2,
    'jungle-chess': 2,
};
class RoomManager {
    constructor(sessions) {
        this.sessions = sessions;
        this.rooms = new Map();
        /** sessionId → roomId for quick reverse lookup */
        this.sessionRoom = new Map();
    }
    // ---------------------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------------------
    /**
     * Join or create a room.
     * Returns an error string on failure, or null on success.
     */
    joinRoom(sessionId, roomId, nickname) {
        if (!roomId || roomId.trim() === '')
            return 'Room ID cannot be blank';
        // Leave any existing room first
        if (this.sessionRoom.has(sessionId)) {
            this.leaveRoom(sessionId);
        }
        let room = this.rooms.get(roomId);
        if (!room) {
            // Create new room
            room = this.createRoom(roomId, sessionId);
        }
        // Cancel cleanup timer if room was pending deletion
        if (room.cleanupTimer !== null) {
            clearTimeout(room.cleanupTimer);
            room.cleanupTimer = null;
        }
        const isAnonymous = nickname === null || nickname.trim() === '';
        const playerCount = room.players.size;
        const maxPlayers = room.gameType ? MAX_PLAYERS[room.gameType] : 2;
        // Determine if this session is reconnecting
        const existingPlayer = room.players.get(sessionId);
        if (existingPlayer) {
            // Reconnect: cancel reconnect timer, mark connected
            const timer = room.reconnectTimers.get(sessionId);
            if (timer) {
                clearTimeout(timer);
                room.reconnectTimers.delete(sessionId);
            }
            existingPlayer.connected = true;
            this.sessionRoom.set(sessionId, roomId);
            // Notify room of reconnect
            this.broadcast(room, {
                type: 'player_reconnected',
                nickname: existingPlayer.nickname,
            }, sessionId);
            // Send current state to reconnected player
            this.sessions.send(sessionId, {
                type: 'room_joined',
                roomId,
                players: this.getPublicPlayers(room),
                spectators: room.spectators.size,
                gameType: room.gameType,
                gameStatus: room.gameStatus,
            });
            if (room.gameState) {
                this.sessions.send(sessionId, {
                    type: 'game_started',
                    gameState: room.gameState,
                });
            }
            return null;
        }
        // New joiner: decide player vs spectator
        if (isAnonymous || playerCount >= maxPlayers || room.gameStatus !== 'lobby') {
            // Join as spectator
            room.spectators.add(sessionId);
            this.sessionRoom.set(sessionId, roomId);
            this.sessions.send(sessionId, {
                type: 'room_joined',
                roomId,
                players: this.getPublicPlayers(room),
                spectators: room.spectators.size,
                gameType: room.gameType,
                gameStatus: room.gameStatus,
            });
            this.broadcastRoomUpdate(room);
            return null;
        }
        // Join as player
        const side = this.assignSide(room);
        const player = {
            sessionId,
            nickname: nickname,
            connected: true,
            side,
        };
        room.players.set(sessionId, player);
        this.sessionRoom.set(sessionId, roomId);
        this.sessions.send(sessionId, {
            type: 'room_joined',
            roomId,
            players: this.getPublicPlayers(room),
            spectators: room.spectators.size,
            gameType: room.gameType,
            gameStatus: room.gameStatus,
        });
        this.broadcastRoomUpdate(room);
        return null;
    }
    /**
     * Remove a player/spectator from their current room.
     * Broadcasts updates to remaining participants.
     */
    leaveRoom(sessionId) {
        const roomId = this.sessionRoom.get(sessionId);
        if (!roomId)
            return;
        const room = this.rooms.get(roomId);
        if (!room) {
            this.sessionRoom.delete(sessionId);
            return;
        }
        this.sessionRoom.delete(sessionId);
        if (room.spectators.has(sessionId)) {
            room.spectators.delete(sessionId);
            this.broadcastRoomUpdate(room);
        }
        else if (room.players.has(sessionId)) {
            room.players.delete(sessionId);
            this.broadcastRoomUpdate(room);
        }
        this.scheduleCleanupIfEmpty(room);
    }
    /**
     * Handle a client disconnect (not an explicit leave).
     * If in a game, hold the seat for RECONNECT_TIMEOUT_MS.
     */
    handleDisconnect(sessionId) {
        const roomId = this.sessionRoom.get(sessionId);
        if (!roomId)
            return;
        const room = this.rooms.get(roomId);
        if (!room) {
            this.sessionRoom.delete(sessionId);
            return;
        }
        const player = room.players.get(sessionId);
        if (player && (room.gameStatus === 'playing' || room.gameStatus === 'setup')) {
            // Hold seat during active game
            player.connected = false;
            this.broadcast(room, {
                type: 'player_disconnected',
                nickname: player.nickname,
                reconnectTimeout: RECONNECT_TIMEOUT_MS / 1000,
            });
            const timer = setTimeout(() => {
                room.reconnectTimers.delete(sessionId);
                room.players.delete(sessionId);
                this.sessionRoom.delete(sessionId);
                this.broadcastRoomUpdate(room);
                this.scheduleCleanupIfEmpty(room);
            }, RECONNECT_TIMEOUT_MS);
            room.reconnectTimers.set(sessionId, timer);
        }
        else {
            // Lobby or spectator: just remove
            this.leaveRoom(sessionId);
        }
    }
    getRoomForSession(sessionId) {
        const roomId = this.sessionRoom.get(sessionId);
        return roomId ? this.rooms.get(roomId) : undefined;
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    /**
     * Validate and apply a move sequence number.
     * Returns null if accepted (and increments seq), or an error string if rejected.
     */
    validateAndAdvanceSeq(room, incomingSeq) {
        if (incomingSeq <= room.seq) {
            return `Stale sequence number: received ${incomingSeq}, current is ${room.seq}`;
        }
        if (incomingSeq !== room.seq + 1) {
            return `Out-of-order sequence number: received ${incomingSeq}, expected ${room.seq + 1}`;
        }
        room.seq = incomingSeq;
        return null;
    }
    // ---------------------------------------------------------------------------
    // Broadcast helpers
    // ---------------------------------------------------------------------------
    /** Send a message to all players and spectators in a room, optionally excluding one session. */
    broadcast(room, msg, excludeSessionId) {
        for (const [sid] of room.players) {
            if (sid !== excludeSessionId)
                this.sessions.send(sid, msg);
        }
        for (const sid of room.spectators) {
            if (sid !== excludeSessionId)
                this.sessions.send(sid, msg);
        }
    }
    broadcastRoomUpdate(room) {
        this.broadcast(room, {
            type: 'room_updated',
            players: this.getPublicPlayers(room),
            spectators: room.spectators.size,
        });
    }
    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------
    createRoom(roomId, creatorId) {
        const room = {
            id: roomId,
            players: new Map(),
            spectators: new Set(),
            creatorId,
            gameType: null,
            gameStatus: 'lobby',
            gameEngine: null,
            gameState: null,
            seq: 0,
            cleanupTimer: null,
            reconnectTimers: new Map(),
        };
        this.rooms.set(roomId, room);
        return room;
    }
    assignSide(room) {
        const sides = new Set();
        for (const [, p] of room.players) {
            if (p.side)
                sides.add(p.side);
        }
        if (!sides.has('red'))
            return 'red';
        if (!sides.has('blue'))
            return 'blue';
        return null;
    }
    getPublicPlayers(room) {
        return Array.from(room.players.values());
    }
    scheduleCleanupIfEmpty(room) {
        if (room.players.size === 0 && room.spectators.size === 0) {
            if (room.cleanupTimer !== null)
                return; // already scheduled
            room.cleanupTimer = setTimeout(() => {
                this.rooms.delete(room.id);
            }, ROOM_CLEANUP_DELAY_MS);
        }
    }
}
exports.RoomManager = RoomManager;
