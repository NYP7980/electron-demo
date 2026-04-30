// Feature: multi-game-room, Property 14: Malformed messages are rejected by the server
import * as fc from 'fast-check';
import { validateMessage } from '../MessageValidator';

describe('MessageValidator — Property 14: Malformed messages are rejected', () => {
  /**
   * Property 14: Malformed messages are rejected by the server
   * For any WebSocket message that is missing required fields or contains fields
   * of the wrong type, the server's message validator should return an error
   * and not process the message.
   * Validates: Requirements 14.3
   */
  test('non-object values are always rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.float(),
          fc.string(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.array(fc.anything()),
        ),
        (value) => {
          const result = validateMessage(value);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('objects with missing or wrong-typed "type" field are rejected', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        }),
        (msg) => {
          const result = validateMessage(msg);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('objects with unknown type strings are rejected', () => {
    const knownTypes = new Set(['join_room', 'leave_room', 'select_game', 'start_game', 'make_move', 'confirm_setup', 'ping']);
    fc.assert(
      fc.property(
        fc.string().filter(s => !knownTypes.has(s)),
        (unknownType) => {
          const result = validateMessage({ type: unknownType });
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('join_room with missing or wrong-typed roomId is rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        (badRoomId) => {
          const result = validateMessage({ type: 'join_room', roomId: badRoomId, nickname: null });
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('join_room with wrong-typed nickname is rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer(), fc.boolean(), fc.array(fc.string())),
        (badNickname) => {
          const result = validateMessage({ type: 'join_room', roomId: 'room1', nickname: badNickname });
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('make_move with missing seq or non-object move is rejected', () => {
    fc.assert(
      fc.property(
        fc.record({
          move: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
          seq: fc.oneof(fc.string(), fc.boolean(), fc.constant(null)),
        }),
        ({ move, seq }) => {
          // At least one of move/seq is wrong
          const result = validateMessage({ type: 'make_move', move, seq });
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('select_game with invalid gameType is rejected', () => {
    const validTypes = ['gomoku', 'army-chess', 'jungle-chess'];
    fc.assert(
      fc.property(
        fc.string().filter(s => !validTypes.includes(s)),
        (badType) => {
          const result = validateMessage({ type: 'select_game', gameType: badType });
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('valid messages are accepted', () => {
    const validMessages = [
      { type: 'ping' },
      { type: 'leave_room' },
      { type: 'start_game' },
      { type: 'join_room', roomId: 'room1', nickname: 'Alice' },
      { type: 'join_room', roomId: 'room1', nickname: null },
      { type: 'select_game', gameType: 'gomoku' },
      { type: 'select_game', gameType: 'army-chess' },
      { type: 'select_game', gameType: 'jungle-chess' },
      { type: 'make_move', move: { row: 0, col: 0 }, seq: 1 },
      { type: 'confirm_setup', arrangement: [{ id: 'red-0', row: 6, col: 0 }] },
    ];
    for (const msg of validMessages) {
      const result = validateMessage(msg);
      expect(result.ok).toBe(true);
    }
  });
});
