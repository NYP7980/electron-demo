import { GameType, RoomPlayer, ServerMessage } from './types';
import { SessionManager } from './SessionManager';

const ROOM_CLEANUP_DELAY_MS = 5 * 60 * 1000;   // 5 minutes
const RECONNECT_TIMEOUT_MS  = 5 * 60 * 1000;   // 5 minutes

/** Maximum players per game type (2 for all current games). */
const MAX_PLAYERS: Record<GameType, number> = {
  'gomoku':      2,
  'army-chess':  2,
  'jungle-chess': 2,
};

export interface Room {
  id: string;
  players: Map<string, RoomPlayer>;       // sessionId → player
  spectators: Set<string>;                // sessionIds of spectators
  creatorId: string;
  gameType: GameType | null;
  gameStatus: 'lobby' | 'setup' | 'playing' | 'ended';
  gameEngine: unknown | null;             // set by MessageHandler
  gameState: unknown | null;             // current game state
  seq: number;                            // monotonic move counter
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  /** sessionId → roomId for quick reverse lookup */
  private sessionRoom: Map<string, string> = new Map();

  constructor(private sessions: SessionManager) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Join or create a room.
   * Returns an error string on failure, or null on success.
   */
  joinRoom(sessionId: string, roomId: string, nickname: string | null): string | null {
    if (!roomId || roomId.trim() === '') return 'Room ID cannot be blank';

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
    const side: 'red' | 'blue' | null = this.assignSide(room);
    const player: RoomPlayer = {
      sessionId,
      nickname: nickname!,
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
  leaveRoom(sessionId: string): void {
    const roomId = this.sessionRoom.get(sessionId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (!room) {
      this.sessionRoom.delete(sessionId);
      return;
    }

    this.sessionRoom.delete(sessionId);

    if (room.spectators.has(sessionId)) {
      room.spectators.delete(sessionId);
      this.broadcastRoomUpdate(room);
    } else if (room.players.has(sessionId)) {
      room.players.delete(sessionId);
      this.broadcastRoomUpdate(room);
    }

    this.scheduleCleanupIfEmpty(room);
  }

  /**
   * Handle a client disconnect (not an explicit leave).
   * If in a game, hold the seat for RECONNECT_TIMEOUT_MS.
   */
  handleDisconnect(sessionId: string): void {
    const roomId = this.sessionRoom.get(sessionId);
    if (!roomId) return;

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
    } else {
      // Lobby or spectator: just remove
      this.leaveRoom(sessionId);
    }
  }

  getRoomForSession(sessionId: string): Room | undefined {
    const roomId = this.sessionRoom.get(sessionId);
    return roomId ? this.rooms.get(roomId) : undefined;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Validate and apply a move sequence number.
   * Returns null if accepted (and increments seq), or an error string if rejected.
   */
  validateAndAdvanceSeq(room: Room, incomingSeq: number): string | null {
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
  broadcast(room: Room, msg: ServerMessage, excludeSessionId?: string): void {
    for (const [sid] of room.players) {
      if (sid !== excludeSessionId) this.sessions.send(sid, msg);
    }
    for (const sid of room.spectators) {
      if (sid !== excludeSessionId) this.sessions.send(sid, msg);
    }
  }

  broadcastRoomUpdate(room: Room): void {
    this.broadcast(room, {
      type: 'room_updated',
      players: this.getPublicPlayers(room),
      spectators: room.spectators.size,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private createRoom(roomId: string, creatorId: string): Room {
    const room: Room = {
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

  private assignSide(room: Room): 'red' | 'blue' | null {
    const sides = new Set<string>();
    for (const [, p] of room.players) {
      if (p.side) sides.add(p.side);
    }
    if (!sides.has('red')) return 'red';
    if (!sides.has('blue')) return 'blue';
    return null;
  }

  private getPublicPlayers(room: Room): RoomPlayer[] {
    return Array.from(room.players.values());
  }

  private scheduleCleanupIfEmpty(room: Room): void {
    if (room.players.size === 0 && room.spectators.size === 0) {
      if (room.cleanupTimer !== null) return; // already scheduled
      room.cleanupTimer = setTimeout(() => {
        this.rooms.delete(room.id);
      }, ROOM_CLEANUP_DELAY_MS);
    }
  }
}
