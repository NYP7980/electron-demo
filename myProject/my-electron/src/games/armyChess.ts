// Army Chess (Luzhanqi) game engine
// Board: 5 columns (0-4) x 12 rows (0-11)

export type ArmyChessPieceType =
  | 'commander'
  | 'lt_general'
  | 'maj_general'
  | 'brigadier'
  | 'colonel'
  | 'major'
  | 'captain'
  | 'lieutenant'
  | 'engineer'
  | 'landmine'
  | 'bomb'
  | 'flag';

export type Side = 'red' | 'blue';
export type TerrainType = 'road' | 'railway' | 'camp' | 'hq' | 'mountain';

export interface ArmyChessPiece {
  id: string;
  type: ArmyChessPieceType;
  side: Side;
  row: number;
  col: number;
  alive: boolean;
}

export interface ArmyChessState {
  pieces: ArmyChessPiece[];
  currentTurn: Side;
  phase: 'setup' | 'playing';
  setupConfirmed: { red: boolean; blue: boolean };
  winner: Side | null;
  seq: number;
}

export interface ArmyChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

export type CombatResult = 'attacker_wins' | 'defender_wins' | 'both_eliminated';
export type MoveResult = { ok: true; state: ArmyChessState } | { ok: false; error: string };

export const PIECE_RANK: Record<ArmyChessPieceType, number> = {
  commander: 10, lt_general: 9, maj_general: 8, brigadier: 7,
  colonel: 6, major: 5, captain: 4, lieutenant: 3,
  engineer: 2, landmine: 1, bomb: 0, flag: 0,
};

export const TERRAIN: TerrainType[][] = [
  ['road', 'hq',      'road',    'hq',      'road'],
  ['camp', 'railway', 'camp',    'railway', 'camp'],
  ['railway', 'road', 'road',    'road',    'railway'],
  ['railway', 'camp', 'road',    'camp',    'railway'],
  ['railway', 'road', 'road',    'road',    'railway'],
  ['mountain', 'railway', 'railway', 'railway', 'mountain'],
  ['mountain', 'railway', 'railway', 'railway', 'mountain'],
  ['railway', 'road', 'road',    'road',    'railway'],
  ['railway', 'camp', 'road',    'camp',    'railway'],
  ['railway', 'road', 'road',    'road',    'railway'],
  ['camp', 'railway', 'camp',    'railway', 'camp'],
  ['road', 'hq',      'road',    'hq',      'road'],
];

function isRailwayCell(r: number, c: number): boolean {
  if (r < 0 || r > 11 || c < 0 || c > 4) return false;
  const t = TERRAIN[r][c];
  return t === 'railway' || t === 'camp';
}

export function railwayNeighbours(r: number, c: number): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  if (isRailwayCell(r - 1, c)) result.push([r - 1, c]);
  if (isRailwayCell(r + 1, c)) result.push([r + 1, c]);
  if (isRailwayCell(r, c - 1)) result.push([r, c - 1]);
  if (isRailwayCell(r, c + 1)) result.push([r, c + 1]);
  return result;
}

function isPassable(r: number, c: number): boolean {
  if (r < 0 || r > 11 || c < 0 || c > 4) return false;
  return TERRAIN[r][c] !== 'mountain';
}

export function roadNeighbours(r: number, c: number): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  if (isPassable(r - 1, c)) result.push([r - 1, c]);
  if (isPassable(r + 1, c)) result.push([r + 1, c]);
  if (isPassable(r, c - 1)) result.push([r, c - 1]);
  if (isPassable(r, c + 1)) result.push([r, c + 1]);
  return result;
}

export function createInitialPieces(side: Side): ArmyChessPiece[] {
  const rowOffset = side === 'red' ? 6 : 0;
  const layout: Array<[number, number, ArmyChessPieceType]> = [
    [0, 0, 'landmine'], [0, 1, 'flag'],      [0, 2, 'landmine'],
    [0, 3, 'landmine'], [0, 4, 'bomb'],
    [1, 0, 'bomb'],     [1, 1, 'commander'], [1, 2, 'lt_general'],
    [1, 3, 'maj_general'], [1, 4, 'maj_general'],
    [2, 0, 'brigadier'], [2, 1, 'brigadier'], [2, 2, 'colonel'],
    [2, 3, 'colonel'],  [2, 4, 'major'],
    [3, 0, 'major'],    [3, 1, 'captain'],   [3, 2, 'captain'],
    [3, 3, 'captain'],  [3, 4, 'lieutenant'],
    [4, 0, 'lieutenant'], [4, 1, 'lieutenant'], [4, 2, 'engineer'],
    [4, 3, 'engineer'], [4, 4, 'engineer'],
  ];
  const pieces: ArmyChessPiece[] = [];
  for (let i = 0; i < layout.length; i++) {
    pieces.push({
      id: side + '-' + i,
      type: layout[i][2],
      side: side,
      row: rowOffset + layout[i][0],
      col: layout[i][1],
      alive: true,
    });
  }
  return pieces;
}

export function createInitialState(): ArmyChessState {
  return {
    pieces: createInitialPieces('red').concat(createInitialPieces('blue')),
    currentTurn: 'red',
    phase: 'setup',
    setupConfirmed: { red: false, blue: false },
    winner: null,
    seq: 0,
  };
}

export function getPieceById(state: ArmyChessState, id: string): ArmyChessPiece | undefined {
  for (let i = 0; i < state.pieces.length; i++) {
    if (state.pieces[i].id === id) return state.pieces[i];
  }
  return undefined;
}

export function getPieceAt(state: ArmyChessState, row: number, col: number): ArmyChessPiece | undefined {
  for (let i = 0; i < state.pieces.length; i++) {
    const p = state.pieces[i];
    if (p.alive && p.row === row && p.col === col) return p;
  }
  return undefined;
}

export function resolveCombat(
  attacker: ArmyChessPieceType,
  defender: ArmyChessPieceType
): CombatResult {
  if (defender === 'flag') return 'attacker_wins';
  if (attacker === 'bomb') return 'both_eliminated';
  if (defender === 'landmine') {
    return attacker === 'engineer' ? 'attacker_wins' : 'defender_wins';
  }
  if (defender === 'bomb') return 'both_eliminated';
  const aRank = PIECE_RANK[attacker];
  const dRank = PIECE_RANK[defender];
  if (aRank > dRank) return 'attacker_wins';
  if (aRank < dRank) return 'defender_wins';
  return 'both_eliminated';
}

export function getValidMoves(state: ArmyChessState, pieceId: string): ArmyChessMove[] {
  if (state.phase !== 'playing' || state.winner !== null) return [];
  const piece = getPieceById(state, pieceId);
  if (!piece || !piece.alive || piece.side !== state.currentTurn) return [];
  if (piece.type === 'flag' || piece.type === 'landmine') return [];

  const row = piece.row;
  const col = piece.col;
  const seen: Record<string, boolean> = {};
  const moves: ArmyChessMove[] = [];

  function addMove(toRow: number, toCol: number): void {
    const key = toRow + ',' + toCol;
    if (seen[key]) return;
    seen[key] = true;
    const occ = getPieceAt(state, toRow, toCol);
    if (occ && occ.side === piece!.side) return;
    if (occ && TERRAIN[toRow][toCol] === 'camp') return;
    moves.push({ fromRow: row, fromCol: col, toRow: toRow, toCol: toCol });
  }

  const terrain = TERRAIN[row][col];

  if (terrain === 'railway' || terrain === 'camp') {
    if (piece.type === 'engineer') {
      const vis: Record<string, boolean> = {};
      vis[row + ',' + col] = true;
      const q: Array<[number, number]> = [[row, col]];
      while (q.length > 0) {
        const cur = q.shift()!;
        const nbrs = railwayNeighbours(cur[0], cur[1]);
        for (let i = 0; i < nbrs.length; i++) {
          const nr = nbrs[i][0];
          const nc = nbrs[i][1];
          const nk = nr + ',' + nc;
          if (vis[nk]) continue;
          vis[nk] = true;
          addMove(nr, nc);
          if (!getPieceAt(state, nr, nc)) q.push([nr, nc]);
        }
      }
    } else {
      const nbrs = railwayNeighbours(row, col);
      for (let i = 0; i < nbrs.length; i++) addMove(nbrs[i][0], nbrs[i][1]);
    }
    const rn = roadNeighbours(row, col);
    for (let i = 0; i < rn.length; i++) addMove(rn[i][0], rn[i][1]);
  } else {
    const rn = roadNeighbours(row, col);
    for (let i = 0; i < rn.length; i++) addMove(rn[i][0], rn[i][1]);
  }

  return moves;
}
