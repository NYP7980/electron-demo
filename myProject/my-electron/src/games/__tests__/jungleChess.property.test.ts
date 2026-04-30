// Feature: multi-game-room, Property 10: Jungle Chess combat follows animal hierarchy
// Feature: multi-game-room, Property 11: Jungle Chess terrain movement rules are enforced
// Feature: multi-game-room, Property 12: Trap reduces effective rank to zero

import * as fc from 'fast-check';
import {
  resolveCombat,
  getValidMoves,
  createInitialState,
  ANIMAL_STRENGTH,
  TERRAIN,
  isOpponentTrap,
  JungleAnimal,
  JungleChessState,
  JunglePiece,
  Side,
} from '../jungleChess';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const allAnimals: JungleAnimal[] = ['elephant', 'lion', 'tiger', 'leopard', 'wolf', 'dog', 'cat', 'rat'];
const animalArb = fc.constantFrom(...allAnimals);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePiece(
  id: string,
  animal: JungleAnimal,
  side: Side,
  row: number,
  col: number
): JunglePiece {
  return { id, animal, side, row, col, alive: true };
}

function stateWith(pieces: JunglePiece[], currentTurn: Side = 'red'): JungleChessState {
  return { pieces, currentTurn, winner: null, seq: 0 };
}

// ---------------------------------------------------------------------------
// Property 10: Jungle Chess combat follows animal hierarchy
// Validates: Requirements 8.4, 8.8
// ---------------------------------------------------------------------------

describe('Property 10: Jungle Chess combat follows animal hierarchy', () => {
  it('higher strength attacker beats lower strength defender on land', () => {
    // Feature: multi-game-room, Property 10: Jungle Chess combat follows animal hierarchy
    fc.assert(
      fc.property(animalArb, animalArb, (attacker, defender) => {
        // Skip the Rat-vs-Elephant special case — tested separately
        if (attacker === 'rat' && defender === 'elephant') return;

        const result = resolveCombat(attacker, defender, false);
        const aStr = ANIMAL_STRENGTH[attacker];
        const dStr = ANIMAL_STRENGTH[defender];

        if (aStr > dStr) {
          expect(result).toBe('attacker_wins');
        } else if (aStr < dStr) {
          expect(result).toBe('defender_wins');
        } else {
          expect(result).toBe('both_eliminated');
        }
      }),
      { numRuns: 200 }
    );
  });

  it('Rat captures Elephant (special rule, no trap)', () => {
    // Feature: multi-game-room, Property 10: Jungle Chess combat follows animal hierarchy
    expect(resolveCombat('rat', 'elephant', false)).toBe('attacker_wins');
  });

  it('any attacker beats a piece with effective rank 0 (in trap)', () => {
    // Feature: multi-game-room, Property 10: Jungle Chess combat follows animal hierarchy
    // When defender is in a trap, effective rank = 0, so any attacker wins
    fc.assert(
      fc.property(animalArb, animalArb, (attacker, defender) => {
        const result = resolveCombat(attacker, defender, true);
        const aStr = ANIMAL_STRENGTH[attacker];
        // effective defender strength is 0
        if (aStr > 0) {
          expect(result).toBe('attacker_wins');
        } else {
          // rat (strength 1) > 0, so this branch is never reached for any animal
          // All animals have strength >= 1
          expect(result).toBe('attacker_wins');
        }
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Jungle Chess terrain movement rules are enforced
// Validates: Requirements 8.7
// ---------------------------------------------------------------------------

describe('Property 11: Jungle Chess terrain movement rules are enforced', () => {
  it('only Rat can enter river cells', () => {
    // Feature: multi-game-room, Property 11: Jungle Chess terrain movement rules are enforced
    // For every non-Rat animal, none of its valid moves should land on a river cell
    const nonRatAnimals = allAnimals.filter(a => a !== 'rat' && a !== 'lion' && a !== 'tiger');

    // Land cells adjacent to river (row 2 or 6, cols 1-5 are good starting points)
    const landCellsNearRiver: [number, number][] = [
      [2, 1], [2, 2], [2, 4], [2, 5],
      [6, 1], [6, 2], [6, 4], [6, 5],
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...nonRatAnimals),
        fc.constantFrom(...landCellsNearRiver),
        (animal, [row, col]) => {
          const piece = makePiece('red-0', animal, 'red', row, col);
          // Add minimal pieces to avoid den-entry win
          const blueDen = makePiece('blue-rat', 'rat', 'blue', 2, 0);
          const state = stateWith([piece, blueDen], 'red');

          const moves = getValidMoves(state, 'red-0');
          for (const m of moves) {
            expect(TERRAIN[m.toRow][m.toCol]).not.toBe('river');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Lion and Tiger can jump over rivers (no Rat blocking)', () => {
    // Feature: multi-game-room, Property 11: Jungle Chess terrain movement rules are enforced
    // Lion at (2,3) can jump to (6,3) vertically (river rows 3-5, col 3 is land — skip)
    // Use col 0: rows 3-5 col 0 is land, not river. Use col 1: rows 3-5 col 1 IS river.
    // Lion at (2,1) should be able to jump to (6,1) with no Rat in river col 1 rows 3-5
    for (const animal of ['lion', 'tiger'] as JungleAnimal[]) {
      const piece = makePiece('red-0', animal, 'red', 2, 1);
      const state = stateWith([piece], 'red');
      const moves = getValidMoves(state, 'red-0');
      const canJump = moves.some(m => m.toRow === 6 && m.toCol === 1);
      expect(canJump).toBe(true);
    }
  });

  it('Lion and Tiger cannot jump over rivers when a Rat is in the river on that line', () => {
    // Feature: multi-game-room, Property 11: Jungle Chess terrain movement rules are enforced
    // Place a Rat (either side) in the river on the jump path
    for (const animal of ['lion', 'tiger'] as JungleAnimal[]) {
      const piece = makePiece('red-0', animal, 'red', 2, 1);
      // Blue rat in river at (4,1) blocks the vertical jump along col 1
      const blockingRat = makePiece('blue-rat', 'rat', 'blue', 4, 1);
      const state = stateWith([piece, blockingRat], 'red');
      const moves = getValidMoves(state, 'red-0');
      const canJump = moves.some(m => m.toRow === 6 && m.toCol === 1);
      expect(canJump).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 12: Trap reduces effective rank to zero
// Validates: Requirements 8.6
// ---------------------------------------------------------------------------

describe('Property 12: Trap reduces effective rank to zero', () => {
  it('any attacker beats any defender in an opponent trap', () => {
    // Feature: multi-game-room, Property 12: Trap reduces effective rank to zero
    // For all animal pairs, if defender is in a trap, attacker always wins
    // (since all animals have strength >= 1 > 0)
    fc.assert(
      fc.property(animalArb, animalArb, (attacker, defender) => {
        const result = resolveCombat(attacker, defender, true);
        expect(result).toBe('attacker_wins');
      }),
      { numRuns: 200 }
    );
  });

  it('getValidMoves allows attacking a piece in an opponent trap regardless of strength', () => {
    // Feature: multi-game-room, Property 12: Trap reduces effective rank to zero
    // Red cat (strength 2) should be able to attack blue elephant (strength 8) in red's trap
    // Red traps: (8,2), (8,4), (7,3)
    const redCat = makePiece('red-cat', 'cat', 'red', 8, 1); // adjacent to trap (8,2)
    const blueElephant = makePiece('blue-elephant', 'elephant', 'blue', 8, 2); // in red trap
    const state = stateWith([redCat, blueElephant], 'red');

    const moves = getValidMoves(state, 'red-cat');
    const canCapture = moves.some(m => m.toRow === 8 && m.toCol === 2);
    expect(canCapture).toBe(true);
  });

  it('without trap, weaker attacker cannot beat stronger defender', () => {
    // Feature: multi-game-room, Property 12: Trap reduces effective rank to zero
    // Red cat (strength 2) cannot attack blue elephant (strength 8) on normal land
    const redCat = makePiece('red-cat', 'cat', 'red', 6, 3);
    const blueElephant = makePiece('blue-elephant', 'elephant', 'blue', 6, 4);
    const state = stateWith([redCat, blueElephant], 'red');

    const moves = getValidMoves(state, 'red-cat');
    const canCapture = moves.some(m => m.toRow === 6 && m.toCol === 4);
    expect(canCapture).toBe(false);
  });
});
