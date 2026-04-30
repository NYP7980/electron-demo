// Feature: multi-game-room, Property 1: Nickname validation is consistent
// Validates: Requirements 3.2
import * as fc from 'fast-check';
import { validateNickname } from '../NicknameModal';

// Arbitrary: non-whitespace string of length 1–16
const nonWhitespaceStr = fc
  .string({ minLength: 1, maxLength: 16 })
  .filter(s => s.trim().length >= 1 && s.trim().length <= 16 && s.trim() === s);

// Arbitrary: whitespace-only string of length 1–30
const whitespaceOnlyStr = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 30 })
  .map(arr => arr.join(''));

// Arbitrary: string whose trimmed length > 16
const tooLongStr = fc
  .string({ minLength: 17, maxLength: 50 })
  .filter(s => s.trim().length > 16);

describe('Property 1: Nickname validation is consistent', () => {
  it('accepts strings with 1–16 non-whitespace characters (trimmed)', () => {
    fc.assert(
      fc.property(nonWhitespaceStr, (s) => {
        expect(validateNickname(s)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects empty string', () => {
    expect(validateNickname('')).toBe(false);
  });

  it('rejects whitespace-only strings', () => {
    fc.assert(
      fc.property(whitespaceOnlyStr, (s) => {
        expect(validateNickname(s)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects strings whose trimmed length exceeds 16', () => {
    fc.assert(
      fc.property(tooLongStr, (s) => {
        expect(validateNickname(s)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('accepts strings with leading/trailing whitespace if trimmed length is 1–16', () => {
    const coreStr = fc.string({ minLength: 1, maxLength: 16 }).filter(s => s.trim().length >= 1 && s.trim().length <= 16 && s.trim() === s);
    const padding = fc.array(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 5 }).map(a => a.join(''));
    fc.assert(
      fc.property(coreStr, padding, padding, (core, leading, trailing) => {
        expect(validateNickname(leading + core + trailing)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});
