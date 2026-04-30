// Feature: multi-game-room, Property 5: Gomoku win detection covers all directions
// Feature: multi-game-room, Property 6: Gomoku move validation rejects illegal placements
import * as fc from 'fast-check';
import {
  checkWinner,
  createInitialState,
  applyMove,
  getValidMoves,
  Cell,
  Side,
} from '../gomoku';

const BOARD_SIZE = 15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyBoard(): Cell[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0) as Cell[]);
}

/** Place `count` pieces of `side` starting at (r,c) in direction (dr,dc). */
function placeLine(
  board: Cell[][],
  r: number,
  c: number,
  dr: number,
  dc: number,
  count: number,
  side: Cell
): void {
  for (let i = 0; i < count; i++) {
    board[r + dr * i][c + dc * i] = side;
  }
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A random starting position that leaves room for 5 pieces in the given direction. */
function startPosArb(dr: number, dc: number) {
  const maxR = dr > 0 ? BOARD_SIZE - 5 : dr < 0 ? 4 : BOARD_SIZE - 1;
  const maxC = dc > 0 ? BOARD_SIZE - 5 : dc < 0 ? 4 : BOARD_SIZE - 1;
  const minR = dr < 0 ? 4 : 0;
  const minC = dc < 0 ? 4 : 0;
  return fc.record({
    r: fc.integer({ min: minR, max: maxR }),
    c: fc.integer({ min: minC, max: maxC }),
  });
}

const sideArb = fc.constantFrom<Cell>(1, 2);

// ---------------------------------------------------------------------------
// Property 5: Gomoku win detection covers all directions
// Validates: Requirements 6.4
// ---------------------------------------------------------------------------

describe('Property 5: Gomoku win detection covers all directions', () => {
  const directions: [number, number, string][] = [
    [0, 1, 'horizontal'],
    [1, 0, 'vertical'],
    [1, 1, 'diagonal ↘'],
    [1, -1, 'diagonal ↙'],
  ];

  for (const [dr, dc, label] of directions) {
    it(`detects a winner for 5-in-a-row (${label})`, () => {
      fc.assert(
        fc.property(startPosArb(dr, dc), sideArb, ({ r, c }, side) => {
          const board = emptyBoard();
          placeLine(board, r, c, dr, dc, 5, side);
          expect(checkWinner(board)).toBe(side);
        }),
        { numRuns: 200 }
      );
    });
  }

  it('returns null when no 5-in-a-row exists on an empty board', () => {
    expect(checkWinner(emptyBoard())).toBeNull();
  });

  it('returns null when the longest run is exactly 4', () => {
    fc.assert(
      fc.property(
        startPosArb(0, 1), // horizontal only — keep it simple
        sideArb,
        ({ r, c }, side) => {
          // Ensure we have room for exactly 4 without extending to 5
          if (c + 4 >= BOARD_SIZE) return; // skip edge cases
          const board = emptyBoard();
          placeLine(board, r, c, 0, 1, 4, side);
          // Block both ends so it can't accidentally form 5
          if (c > 0) board[r][c - 1] = (side === 1 ? 2 : 1) as Cell;
          if (c + 4 < BOARD_SIZE) board[r][c + 4] = (side === 1 ? 2 : 1) as Cell;
          expect(checkWinner(board)).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Gomoku move validation rejects illegal placements
// Validates: Requirements 6.6
// ---------------------------------------------------------------------------

describe('Property 6: Gomoku move validation rejects illegal placements', () => {
  it('rejects placing on an already-occupied intersection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 14 }),
        fc.integer({ min: 0, max: 14 }),
        (row, col) => {
          // Place a piece at (row, col) first
          const state = createInitialState();
          const first = applyMove(state, { row, col }, 1);
          if (!first.ok) return; // shouldn't happen on empty board

          // Now try to place again at the same cell (it's side 2's turn)
          const second = applyMove(first.state, { row, col }, 2);
          expect(second.ok).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects a move when it is not the player\'s turn', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 14 }),
        fc.integer({ min: 0, max: 14 }),
        fc.integer({ min: 0, max: 14 }),
        fc.integer({ min: 0, max: 14 }),
        (r1, c1, r2, c2) => {
          const state = createInitialState(); // currentTurn = 1
          // Side 2 tries to move when it's side 1's turn
          const wrongTurn = applyMove(state, { row: r1, col: c1 }, 2 as Side);
          expect(wrongTurn.ok).toBe(false);

          // Side 1 moves correctly, then side 1 tries again
          const after1 = applyMove(state, { row: r1, col: c1 }, 1);
          if (!after1.ok) return;
          // Now it's side 2's turn; side 1 tries to move
          if (r2 === r1 && c2 === c1) return; // skip same cell
          const wrongTurn2 = applyMove(after1.state, { row: r2, col: c2 }, 1 as Side);
          expect(wrongTurn2.ok).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('getValidMoves returns only empty cells', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            row: fc.integer({ min: 0, max: 14 }),
            col: fc.integer({ min: 0, max: 14 }),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (moves) => {
          let state = createInitialState();
          for (const move of moves) {
            const result = applyMove(state, move, state.currentTurn);
            if (result.ok) state = result.state;
            if (state.winner !== null) break;
          }
          const valid = getValidMoves(state);
          for (const { row, col } of valid) {
            expect(state.board[row][col]).toBe(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
