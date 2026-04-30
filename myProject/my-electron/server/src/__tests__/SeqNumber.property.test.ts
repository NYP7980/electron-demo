// Feature: multi-game-room, Property 13: Stale sequence numbers are rejected
import * as fc from 'fast-check';
import { RoomManager } from '../RoomManager';
import { SessionManager } from '../SessionManager';
import { WebSocket } from 'ws';

function makeStubWs(): WebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: jest.fn(),
    terminate: jest.fn(),
    ping: jest.fn(),
  } as unknown as WebSocket;
}

function setup() {
  const sessions = new SessionManager();
  const rooms = new RoomManager(sessions);
  return { sessions, rooms };
}

function registerAndJoin(sessions: SessionManager, rooms: RoomManager, roomId: string, nickname: string): string {
  const ws = makeStubWs();
  const sessionId = sessions.createSession(ws);
  rooms.joinRoom(sessionId, roomId, nickname);
  return sessionId;
}

describe('RoomManager — Property 13: Stale sequence numbers are rejected', () => {
  /**
   * Property 13: Stale sequence numbers are rejected
   * For any room with current sequence number N, a move message carrying
   * sequence number ≤ N should be rejected. Only moves with sequence number
   * N+1 should be accepted.
   * Validates: Requirements 9.6
   */
  test('seq ≤ current room seq is always rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),   // current seq N
        fc.integer({ min: 0, max: 100 }),   // incoming seq (will be clamped to ≤ N)
        (currentSeq, offset) => {
          const { sessions, rooms } = setup();
          const roomId = 'test-room-' + Math.random();
          registerAndJoin(sessions, rooms, roomId, 'Alice');

          const room = rooms.getRoom(roomId)!;
          // Manually set the room's seq to currentSeq
          room.seq = currentSeq;

          // Incoming seq is ≤ currentSeq
          const incomingSeq = currentSeq - (offset % (currentSeq + 1));

          const error = rooms.validateAndAdvanceSeq(room, incomingSeq);
          expect(error).not.toBeNull();
          // seq should not have changed
          expect(room.seq).toBe(currentSeq);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('seq = N+1 is always accepted and advances the counter', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }),
        (currentSeq) => {
          const { sessions, rooms } = setup();
          const roomId = 'test-room-' + Math.random();
          registerAndJoin(sessions, rooms, roomId, 'Alice');

          const room = rooms.getRoom(roomId)!;
          room.seq = currentSeq;

          const error = rooms.validateAndAdvanceSeq(room, currentSeq + 1);
          expect(error).toBeNull();
          expect(room.seq).toBe(currentSeq + 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('seq > N+1 (gap) is rejected', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 2, max: 50 }),   // gap of at least 2
        (currentSeq, gap) => {
          const { sessions, rooms } = setup();
          const roomId = 'test-room-' + Math.random();
          registerAndJoin(sessions, rooms, roomId, 'Alice');

          const room = rooms.getRoom(roomId)!;
          room.seq = currentSeq;

          const error = rooms.validateAndAdvanceSeq(room, currentSeq + gap);
          expect(error).not.toBeNull();
          expect(room.seq).toBe(currentSeq);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('seq = 0 is rejected when room seq is 0 (duplicate first move)', () => {
    const { sessions, rooms } = setup();
    const roomId = 'test-room-zero';
    registerAndJoin(sessions, rooms, roomId, 'Alice');

    const room = rooms.getRoom(roomId)!;
    expect(room.seq).toBe(0);

    const error = rooms.validateAndAdvanceSeq(room, 0);
    expect(error).not.toBeNull();
  });
});
