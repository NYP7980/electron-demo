// Feature: multi-game-room, Property 3: Room ID validation rejects blank inputs
// Validates: Requirements 4.3
import * as fc from 'fast-check';
import { validateRoomId } from '../game/RoomEntry';

// Arbitrary: whitespace-only string (including empty string)
const whitespaceOnlyStr = fc
    .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 30 })
    .map(arr => arr.join(''));

// Arbitrary: string with at least one non-whitespace character
const nonBlankStr = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0);

describe('Property 3: Room ID validation rejects blank inputs', () => {
    it('rejects empty string', () => {
        expect(validateRoomId('')).toBe(false);
    });

    it('rejects any whitespace-only string', () => {
        fc.assert(
            fc.property(whitespaceOnlyStr, (s) => {
                expect(validateRoomId(s)).toBe(false);
            }),
            { numRuns: 200 }
        );
    });

    it('accepts any string with at least one non-whitespace character', () => {
        fc.assert(
            fc.property(nonBlankStr, (s) => {
                expect(validateRoomId(s)).toBe(true);
            }),
            { numRuns: 200 }
        );
    });
});
