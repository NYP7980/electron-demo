// Feature: multi-game-room, Property 4: Room join is idempotent for existing rooms
import * as fc from 'fast-check';
import { RoomManager } from '../RoomManager';
import { SessionManager } from '../SessionManager';
import { WebSocket } from 'ws';

/** Create a minimal stub WebSocket that records sent messages. */
function makeStubWs(): WebSocket {
  const ws = {
    readyState: WebSocket.OPEN,
    send: jest.fn(),
    terminate: jest.fn(),
    ping: jest.fn(),
  } as unknown as WebSocket;
  return ws;
}

function makeSessionManager(): SessionManager {
  return new SessionManager();
}

function makeRoomManager(sessions: SessionManager): RoomManager {
  return new RoomManager(sessions);
}

/** Register a fake session and return its sessionId. */
function registerSession(sessions: SessionManager, nickname: string | null): string {
  const ws = makeStubWs();
  const sessionId = sessions.createSession(ws);
  return sessionId;
}

describe('RoomManager — Property 4: Room join is idempotent for existing rooms', () => {
  /**
   * Property 4: Room join is idempotent for existing rooms
   * For any room ID, if a room with that ID already exists on the server,
   * joining it should add the player to the existing room without creating a
   * duplicate room. If the room does not exist, joining should create it.
   * In both cases the player ends up in exactly one room with that ID.
   * Validates: Requirements 4.4, 4.5
   */
  test('joining a non-existent room creates it and places the player in it', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 16 }).filter(s => s.trim().length > 0),
        (roomId, nickname) => {
          const sessions = makeSessionManager();
          const rooms = makeRoomManager(sessions);
          const sessionId = registerSession(sessions, nickname);

          const error = rooms.joinRoom(sessionId, roomId, nickname);
          expect(error).toBeNull();

          const room = rooms.getRoom(roomId);
          expect(room).toBeDefined();
          expect(room!.players.has(sessionId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('joining an existing room adds the player without creating a duplicate', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.tuple(
          fc.string({ minLength: 1, maxLength: 16 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 16 }).filter(s => s.trim().length > 0),
        ),
        (roomId, [nick1, nick2]) => {
          const sessions = makeSessionManager();
          const rooms = makeRoomManager(sessions);

          const s1 = registerSession(sessions, nick1);
          const s2 = registerSession(sessions, nick2);

          // First player creates the room
          rooms.joinRoom(s1, roomId, nick1);
          // Second player joins the same room
          rooms.joinRoom(s2, roomId, nick2);

          const room = rooms.getRoom(roomId);
          expect(room).toBeDefined();
          // Both players are in the same room
          expect(room!.players.has(s1) || room!.spectators.has(s1)).toBe(true);
          expect(room!.players.has(s2) || room!.spectators.has(s2)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('a player ends up in exactly one room after joining', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1, maxLength: 16 }).filter(s => s.trim().length > 0),
        (roomId, nickname) => {
          const sessions = makeSessionManager();
          const rooms = makeRoomManager(sessions);
          const sessionId = registerSession(sessions, nickname);

          rooms.joinRoom(sessionId, roomId, nickname);

          const room = rooms.getRoomForSession(sessionId);
          expect(room).toBeDefined();
          expect(room!.id).toBe(roomId);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('blank room IDs are rejected', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => s.trim().length === 0),
        fc.string({ minLength: 1, maxLength: 16 }),
        (blankRoomId, nickname) => {
          const sessions = makeSessionManager();
          const rooms = makeRoomManager(sessions);
          const sessionId = registerSession(sessions, nickname);

          const error = rooms.joinRoom(sessionId, blankRoomId, nickname);
          expect(error).not.toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('anonymous users join as spectators, not players', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
        (roomId) => {
          const sessions = makeSessionManager();
          const rooms = makeRoomManager(sessions);
          const sessionId = registerSession(sessions, null);

          rooms.joinRoom(sessionId, roomId, null);

          const room = rooms.getRoom(roomId);
          expect(room).toBeDefined();
          expect(room!.players.has(sessionId)).toBe(false);
          expect(room!.spectators.has(sessionId)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
