// Feature: multi-game-room, Property 7: Army Chess combat resolution follows rank hierarchy
// Feature: multi-game-room, Property 8: Army Chess movement only produces valid destinations
// Feature: multi-game-room, Property 9: Camp immunity holds for all pieces

import * as fc from 'fast-check';
import {
  resolveCombat,
  getValidMoves,
  getPieceAt,
  TERRAIN,
  PIECE_RANK,
  createInitialState,
  ArmyChessPieceType,
  ArmyChessState,
  ArmyChessPiece,
  Side,
} from '../armyChess';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const allPieceTypes: ArmyChessPieceType[] = [
  'commander', 'lt_general', 'maj_general', 'brigadier', 'colonel',
  'major', 'captain', 'lieutenant', 'engineer', 'landmine', 'bomb', 'flag',
];

// Pieces that can actually attack (move onto an enemy cell)
const attackingTypes: ArmyChessPieceType[] = [
  'commander', 'lt_general', 'maj_general', 'brigadier', 'colonel',
  'major', 'captain', 'lieutenant', 'engineer', 'bomb',
];

const pieceTypeArb = fc.constantFrom(...allPieceTypes);
const attackerArb = fc.constantFrom(...attackingTypes);

// ---------------------------------------------------------------------------
// Property 7: Army Chess combat resolution follows rank hierarchy
// Validates: Requirements 7.6
// ---------------------------------------------------------------------------

describe('Property 7: Army Chess combat resolution follows rank hierarchy', () => {
  it('higher rank attacker beats lower rank defender (standard pieces)', () => {
    // Feature: multi-game-room, Property 7: Army Chess combat resolution follows rank hierarchy
    const standardTypes: ArmyChessPieceType[] = [
      'commander', 'lt_general', 'maj_general', 'brigadier', 'colonel',
      'major', 'captain', 'lieutenant', 'engineer',
    ];
    fc.assert(
      fc.property(
        fc.constantFrom(...standardTypes),
        fc.constantFrom(...standardTypes),
        (attacker, defender) => {
          const result = resolveCombat(attacker, defender);
          const aRank = PIECE_RANK[attacker];
          const dRank = PIECE_RANK[defender];
          if (aRank > dRank) {
            expect(result).toBe('attacker_wins');
          } else if (aRank < dRank) {
            expect(result).toBe('defender_wins');
          } else {
            expect(result).toBe('both_eliminated');
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('Bomb eliminates both pieces regardless of defender type (except Flag)', () => {
    // Feature: multi-game-room, Property 7: Army Chess combat resolution follows rank hierarchy
    // Flag-capture takes priority: bomb vs flag → attacker_wins (not both_eliminated)
    const nonFlagTypes = allPieceTypes.filter(t => t !== 'flag');
    fc.assert(
      fc.property(fc.constantFrom(...nonFlagTypes), (defender) => {
        const result = resolveCombat('bomb', defender);
        expect(result).toBe('both_eliminated');
      }),
      { numRuns: 200 }
    );
  });

  it('Landmine destroys all attackers except Engineer', () => {
    // Feature: multi-game-room, Property 7: Army Chess combat resolution follows rank hierarchy
    const nonEngineerAttackers = attackingTypes.filter(t => t !== 'engineer' && t !== 'bomb');
    fc.assert(
      fc.property(fc.constantFrom(...nonEngineerAttackers), (attacker) => {
        const result = resolveCombat(attacker, 'landmine');
        expect(result).toBe('defender_wins');
      }),
      { numRuns: 200 }
    );
  });

  it('Engineer defuses Landmine (attacker wins)', () => {
    expect(resolveCombat('engineer', 'landmine')).toBe('attacker_wins');
  });

  it('any piece captures Flag', () => {
    // Feature: multi-game-room, Property 7: Army Chess combat resolution follows rank hierarchy
    fc.assert(
      fc.property(attackerArb, (attacker) => {
        const result = resolveCombat(attacker, 'flag');
        expect(result).toBe('attacker_wins');
      }),
      { numRuns: 200 }
    );
  });

  it('defender Bomb eliminates both', () => {
    // Feature: multi-game-room, Property 7: Army Chess combat resolution follows rank hierarchy
    const nonBombAttackers = attackingTypes.filter(t => t !== 'bomb');
    fc.assert(
      fc.property(fc.constantFrom(...nonBombAttackers), (attacker) => {
        const result = resolveCombat(attacker, 'bomb');
        expect(result).toBe('both_eliminated');
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Helpers for building test states
// ---------------------------------------------------------------------------

function makePiece(
  id: string,
  type: ArmyChessPieceType,
  side: Side,
  row: number,
  col: number
): ArmyChessPiece {
  return { id, type, side, row, col, alive: true };
}

function stateWithPieces(pieces: ArmyChessPiece[], currentTurn: Side = 'red'): ArmyChessState {
  return {
    pieces,
    currentTurn,
    phase: 'playing',
    setupConfirmed: { red: true, blue: true },
    winner: null,
    seq: 0,
  };
}

// ---------------------------------------------------------------------------
// Property 8: Army Chess movement only produces valid destinations
// Validates: Requirements 7.5
// ---------------------------------------------------------------------------

describe('Property 8: Army Chess movement only produces valid destinations', () => {
  it('all returned destinations are passable (non-mountain) cells', () => {
    // Feature: multi-game-room, Property 8: Army Chess movement only produces valid destinations
    // Use a simple state: one red piece on a road cell, no other pieces
    const movablePieceTypes: ArmyChessPieceType[] = [
      'commander', 'lt_general', 'maj_general', 'brigadier', 'colonel',
      'major', 'captain', 'lieutenant', 'engineer', 'bomb',
    ];

    // Red road cells (rows 6–11, cols 0–4, excluding mountains at (6,0),(6,4))
    const redRoadCells: [number, number][] = [];
    for (let r = 6; r <= 11; r++) {
      for (let c = 0; c <= 4; c++) {
        if (TERRAIN[r][c] !== 'mountain') {
          redRoadCells.push([r, c]);
        }
      }
    }

    fc.assert(
      fc.property(
        fc.constantFrom(...movablePieceTypes),
        fc.constantFrom(...redRoadCells),
        (pieceType, [row, col]) => {
          const piece = makePiece('red-0', pieceType, 'red', row, col);
          // Add a blue flag so checkWinner doesn't immediately trigger
          const blueFlag = makePiece('blue-flag', 'flag', 'blue', 0, 1);
          const redFlag = makePiece('red-flag', 'flag', 'red', 11, 1);
          const state = stateWithPieces([piece, blueFlag, redFlag], 'red');

          const moves = getValidMoves(state, 'red-0');

          for (const move of moves) {
            // Destination must be in bounds
            expect(move.toRow).toBeGreaterThanOrEqual(0);
            expect(move.toRow).toBeLessThanOrEqual(11);
            expect(move.toCol).toBeGreaterThanOrEqual(0);
            expect(move.toCol).toBeLessThanOrEqual(4);
            // Destination must not be a mountain
            expect(TERRAIN[move.toRow][move.toCol]).not.toBe('mountain');
            // Destination must not be occupied by own piece
            const occupant = getPieceAt(state, move.toRow, move.toCol);
            if (occupant) {
              expect(occupant.side).not.toBe('red');
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('flag and landmine have no valid moves', () => {
    // Feature: multi-game-room, Property 8: Army Chess movement only produces valid destinations
    fc.assert(
      fc.property(
        fc.constantFrom<ArmyChessPieceType>('flag', 'landmine'),
        fc.integer({ min: 6, max: 11 }),
        fc.integer({ min: 0, max: 4 }),
        (pieceType, row, col) => {
          if (TERRAIN[row][col] === 'mountain') return; // skip impassable
          const piece = makePiece('red-0', pieceType, 'red', row, col);
          const blueFlag = makePiece('blue-flag', 'flag', 'blue', 0, 1);
          const redFlag = makePiece('red-flag', 'flag', 'red', 11, 1);
          const state = stateWithPieces([piece, blueFlag, redFlag], 'red');
          const moves = getValidMoves(state, 'red-0');
          expect(moves).toHaveLength(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('pieces cannot move to cells occupied by friendly pieces', () => {
    // Feature: multi-game-room, Property 8: Army Chess movement only produces valid destinations
    // Place two red pieces adjacent to each other; the moving piece should not list the friendly cell
    const piece1 = makePiece('red-0', 'captain', 'red', 7, 2);
    const piece2 = makePiece('red-1', 'major', 'red', 7, 3);
    const blueFlag = makePiece('blue-flag', 'flag', 'blue', 0, 1);
    const redFlag = makePiece('red-flag', 'flag', 'red', 11, 1);
    const state = stateWithPieces([piece1, piece2, blueFlag, redFlag], 'red');

    const moves = getValidMoves(state, 'red-0');
    for (const move of moves) {
      expect(!(move.toRow === 7 && move.toCol === 3)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 9: Camp immunity holds for all pieces
// Validates: Requirements 7.7
// ---------------------------------------------------------------------------

describe('Property 9: Camp immunity holds for all pieces', () => {
  it('pieces in camp cannot be targeted by enemy moves', () => {
    // Camp cells on the board (computed inside test to avoid module-init ordering issues)
    const campCells: [number, number][] = [];
    for (let r = 0; r <= 11; r++) {
      for (let c = 0; c <= 4; c++) {
        if (TERRAIN[r][c] === 'camp') campCells.push([r, c]);
      }
    }
    // Feature: multi-game-room, Property 9: Camp immunity holds for all pieces
    fc.assert(
      fc.property(
        fc.constantFrom(...campCells),
        fc.constantFrom(...allPieceTypes),
        ([campRow, campCol], defenderType) => {
          // Place a blue piece in a camp cell
          const defender = makePiece('blue-0', defenderType, 'blue', campRow, campCol);

          // Place a red attacker adjacent to the camp cell (find a road neighbour)
          // Use a red captain at a nearby road cell
          const attackerCandidates: [number, number][] = [];
          for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nr = campRow + dr;
            const nc = campCol + dc;
            if (nr >= 0 && nr <= 11 && nc >= 0 && nc <= 4 && TERRAIN[nr][nc] !== 'mountain') {
              attackerCandidates.push([nr, nc]);
            }
          }
          if (attackerCandidates.length === 0) return; // no adjacent cell, skip

          const [aRow, aCol] = attackerCandidates[0];
          const attacker = makePiece('red-0', 'captain', 'red', aRow, aCol);
          const blueFlag = makePiece('blue-flag', 'flag', 'blue', 0, 1);
          const redFlag = makePiece('red-flag', 'flag', 'red', 11, 1);

          const state = stateWithPieces([attacker, defender, blueFlag, redFlag], 'red');
          const moves = getValidMoves(state, 'red-0');

          // The camp cell should NOT appear as a valid destination
          const canAttackCamp = moves.some(
            m => m.toRow === campRow && m.toCol === campCol
          );
          expect(canAttackCamp).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });
});
