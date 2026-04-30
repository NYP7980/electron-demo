// Jungle Chess (Dou Shou Qi) game engine
// Board: 7 columns (0-6) x 9 rows (0-8)
// Red occupies rows 6-8, Blue occupies rows 0-2

export type JungleAnimal = 'elephant' | 'lion' | 'tiger' | 'leopard' | 'wolf' | 'dog' | 'cat' | 'rat';
export type Side = 'red' | 'blue';
export type TerrainType = 'land' | 'river' | 'trap' | 'den';

export interface JunglePiece {
  id: string;
  animal: JungleAnimal;
  side: Side;
  row: number;
  col: number;
  alive: boolean;
}

export interface JungleChessState {
  pieces: JunglePiece[];
  currentTurn: Side;
  winner: Side | null;
  seq: number;
}

export interface JungleMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export type CombatOutcome = 'attacker_wins' | 'defender_wins' | 'both_eliminated';
export type MoveResult = { ok: true; state: JungleChessState } | { ok: false; error: string };

// Animal strength values: Elephant=8 … Rat=1
export const ANIMAL_STRENGTH: Record<JungleAnimal, number> = {
  elephant: 8,
  lion:     7,
  tiger:    6,
  leopard:  5,
  wolf:     4,
  dog:      3,
  cat:      2,
  rat:      1,
};

// ---------------------------------------------------------------------------
// Board terrain (7 cols x 9 rows)
// ---------------------------------------------------------------------------
// River occupies rows 3-5, cols 1-2 and rows 3-5, cols 4-5
// Traps: adjacent to each den
//   Blue den at (0,3): traps at (0,2),(0,4),(1,3)
//   Red  den at (8,3): traps at (8,2),(8,4),(7,3)
// Dens: blue=(0,3), red=(8,3)

export const TERRAIN: TerrainType[][] = (() => {
  const grid: TerrainType[][] = Array.from({ length: 9 }, () =>
    Array(7).fill('land') as TerrainType[]
  );

  // River cells: rows 3-5, cols 1-2 and cols 4-5
  for (let r = 3; r <= 5; r++) {
    for (const c of [1, 2, 4, 5]) {
      grid[r][c] = 'river';
    }
  }

  // Blue traps (around blue den at row 0, col 3)
  grid[0][2] = 'trap';
  grid[0][4] = 'trap';
  grid[1][3] = 'trap';

  // Red traps (around red den at row 8, col 3)
  grid[8][2] = 'trap';
  grid[8][4] = 'trap';
  grid[7][3] = 'trap';

  // Dens
  grid[0][3] = 'den';
  grid[8][3] = 'den';

  return grid;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isRiver(row: number, col: number): boolean {
  return row >= 0 && row <= 8 && col >= 0 && col <= 6 && TERRAIN[row][col] === 'river';
}

export function isTrap(row: number, col: number): boolean {
  return row >= 0 && row <= 8 && col >= 0 && col <= 6 && TERRAIN[row][col] === 'trap';
}

export function isDen(row: number, col: number): boolean {
  return row >= 0 && row <= 8 && col >= 0 && col <= 6 && TERRAIN[row][col] === 'den';
}

/** Returns true if the trap at (row,col) belongs to the opponent of `side`. */
export function isOpponentTrap(row: number, col: number, side: Side): boolean {
  if (!isTrap(row, col)) return false;
  // Blue traps are in rows 0-1; Red traps are in rows 7-8
  return side === 'red' ? row <= 1 : row >= 7;
}

export function getPieceAt(
  state: JungleChessState,
  row: number,
  col: number
): JunglePiece | undefined {
  for (const p of state.pieces) {
    if (p.alive && p.row === row && p.col === col) return p;
  }
  return undefined;
}

export function getPieceById(
  state: JungleChessState,
  id: string
): JunglePiece | undefined {
  return state.pieces.find(p => p.id === id);
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

// Standard starting positions (row, col) for each side
// Blue occupies rows 0-2 (top), Red occupies rows 6-8 (bottom)
const BLUE_POSITIONS: Array<[JungleAnimal, number, number]> = [
  ['lion',     0, 0],
  ['tiger',    0, 6],
  ['dog',      1, 1],
  ['cat',      1, 5],
  ['rat',      2, 0],
  ['leopard',  2, 2],
  ['wolf',     2, 4],
  ['elephant', 2, 6],
];

const RED_POSITIONS: Array<[JungleAnimal, number, number]> = [
  ['lion',     8, 6],
  ['tiger',    8, 0],
  ['dog',      7, 5],
  ['cat',      7, 1],
  ['rat',      6, 6],
  ['leopard',  6, 4],
  ['wolf',     6, 2],
  ['elephant', 6, 0],
];

export function createInitialState(): JungleChessState {
  const pieces: JunglePiece[] = [];

  for (const [animal, row, col] of BLUE_POSITIONS) {
    pieces.push({ id: `blue-${animal}`, animal, side: 'blue', row, col, alive: true });
  }
  for (const [animal, row, col] of RED_POSITIONS) {
    pieces.push({ id: `red-${animal}`, animal, side: 'red', row, col, alive: true });
  }

  return { pieces, currentTurn: 'red', winner: null, seq: 0 };
}

// ---------------------------------------------------------------------------
// Combat resolution
// ---------------------------------------------------------------------------

/**
 * Resolve combat between attacker and defender.
 * `defenderInTrap` — true when the defender occupies an opponent's trap cell
 *   (which reduces its effective rank to 0).
 */
export function resolveCombat(
  attacker: JungleAnimal,
  defender: JungleAnimal,
  defenderInTrap: boolean
): CombatOutcome {
  const aStrength = ANIMAL_STRENGTH[attacker];
  const dStrength = defenderInTrap ? 0 : ANIMAL_STRENGTH[defender];

  // Rat captures Elephant special rule (only when attacker is rat and defender is elephant,
  // and the defender is NOT in a trap — trap already reduces to 0 which rat beats anyway)
  if (attacker === 'rat' && defender === 'elephant' && !defenderInTrap) {
    return 'attacker_wins';
  }

  if (aStrength > dStrength) return 'attacker_wins';
  if (aStrength < dStrength) return 'defender_wins';
  return 'both_eliminated';
}

// ---------------------------------------------------------------------------
// Movement rules
// ---------------------------------------------------------------------------

/**
 * Check whether a Rat in the river blocks a Lion/Tiger jump along a row or column.
 * `fixedAxis` — 'row' means jumping across columns (same row), 'col' means jumping across rows.
 */
function ratBlocksJump(
  state: JungleChessState,
  fixedValue: number,
  from: number,
  to: number,
  fixedAxis: 'row' | 'col'
): boolean {
  const lo = Math.min(from, to) + 1;
  const hi = Math.max(from, to) - 1;
  for (let i = lo; i <= hi; i++) {
    const r = fixedAxis === 'row' ? fixedValue : i;
    const c = fixedAxis === 'row' ? i : fixedValue;
    const p = getPieceAt(state, r, c);
    if (p && p.animal === 'rat') return true;
  }
  return false;
}

/**
 * Returns all valid destination cells for the piece with the given id.
 */
export function getValidMoves(state: JungleChessState, pieceId: string): JungleMove[] {
  if (state.winner !== null) return [];

  const piece = getPieceById(state, pieceId);
  if (!piece || !piece.alive || piece.side !== state.currentTurn) return [];

  const { row, col, animal, side } = piece;
  const moves: JungleMove[] = [];

  function tryAdd(toRow: number, toCol: number): void {
    if (toRow < 0 || toRow > 8 || toCol < 0 || toCol > 6) return;

    const terrain = TERRAIN[toRow][toCol];

    // No piece may enter its own den
    if (terrain === 'den') {
      const ownDenRow = side === 'red' ? 8 : 0;
      if (toRow === ownDenRow && toCol === 3) return;
    }

    // River rules
    if (terrain === 'river') {
      if (animal !== 'rat') return; // only Rat can enter river
    }

    // Rat cannot attack from river to land (can only attack from same terrain)
    const fromTerrain = TERRAIN[row][col];
    if (animal === 'rat' && fromTerrain === 'river' && terrain !== 'river') {
      // Rat in river cannot attack a land piece
      const occupant = getPieceAt(state, toRow, toCol);
      if (occupant && occupant.side !== side) return;
    }

    const occupant = getPieceAt(state, toRow, toCol);
    if (occupant) {
      if (occupant.side === side) return; // can't capture own piece
      // Check combat validity
      const inTrap = isOpponentTrap(toRow, toCol, occupant.side);
      const outcome = resolveCombat(animal, occupant.animal, inTrap);
      if (outcome === 'defender_wins') return; // can't move there
    }

    moves.push({ fromRow: row, fromCol: col, toRow, toCol });
  }

  const directions: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  for (const [dr, dc] of directions) {
    const nr = row + dr;
    const nc = col + dc;

    if (nr < 0 || nr > 8 || nc < 0 || nc > 6) continue;

    const nextTerrain = TERRAIN[nr][nc];

    // Lion and Tiger can jump over rivers
    if (nextTerrain === 'river' && (animal === 'lion' || animal === 'tiger')) {
      // Jump in this direction until we clear the river
      let jumpR = nr;
      let jumpC = nc;
      while (jumpR >= 0 && jumpR <= 8 && jumpC >= 0 && jumpC <= 6 && TERRAIN[jumpR][jumpC] === 'river') {
        jumpR += dr;
        jumpC += dc;
      }
      // jumpR/jumpC is now the landing cell (or out of bounds)
      if (jumpR < 0 || jumpR > 8 || jumpC < 0 || jumpC > 6) continue;
      if (TERRAIN[jumpR][jumpC] === 'river') continue; // still in river (shouldn't happen)

      // Check if a Rat is in the river on this line
      const blocked = dr === 0
        ? ratBlocksJump(state, row, col, jumpC, 'row')
        : ratBlocksJump(state, col, row, jumpR, 'col');
      if (blocked) continue;

      tryAdd(jumpR, jumpC);
      continue;
    }

    tryAdd(nr, nc);
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Apply move
// ---------------------------------------------------------------------------

export function applyMove(
  state: JungleChessState,
  move: JungleMove,
  side: Side
): MoveResult {
  if (state.winner !== null) return { ok: false, error: 'Game is already over' };
  if (side !== state.currentTurn) return { ok: false, error: 'Not your turn' };

  const movingPiece = getPieceAt(state, move.fromRow, move.fromCol);
  if (!movingPiece) return { ok: false, error: 'No piece at source' };
  if (movingPiece.side !== side) return { ok: false, error: 'Not your piece' };

  // Validate via getValidMoves
  const valid = getValidMoves(state, movingPiece.id);
  const isValid = valid.some(m => m.toRow === move.toRow && m.toCol === move.toCol);
  if (!isValid) return { ok: false, error: 'Invalid move' };

  // Build new pieces array
  const newPieces = state.pieces.map(p => ({ ...p }));

  const mover = newPieces.find(p => p.id === movingPiece.id)!;
  const target = newPieces.find(p => p.alive && p.row === move.toRow && p.col === move.toCol && p.side !== side);

  let winner: Side | null = null;

  if (target) {
    const inTrap = isOpponentTrap(move.toRow, move.toCol, target.side);
    const outcome = resolveCombat(mover.animal, target.animal, inTrap);
    if (outcome === 'attacker_wins') {
      target.alive = false;
    } else if (outcome === 'both_eliminated') {
      target.alive = false;
      mover.alive = false;
    }
    // defender_wins: mover can't move there — already filtered by getValidMoves
  }

  if (mover.alive) {
    mover.row = move.toRow;
    mover.col = move.toCol;
  }

  // Check win: entered opponent's den
  if (isDen(move.toRow, move.toCol)) {
    winner = side;
  }

  // Check win: all opponent pieces eliminated
  if (!winner) {
    const opponent: Side = side === 'red' ? 'blue' : 'red';
    const opponentAlive = newPieces.some(p => p.side === opponent && p.alive);
    if (!opponentAlive) winner = side;
  }

  return {
    ok: true,
    state: {
      pieces: newPieces,
      currentTurn: side === 'red' ? 'blue' : 'red',
      winner,
      seq: state.seq + 1,
    },
  };
}
