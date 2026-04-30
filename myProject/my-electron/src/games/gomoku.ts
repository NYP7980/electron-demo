export type Cell = 0 | 1 | 2; // 0=empty, 1=black, 2=white
export type Side = 1 | 2;

export interface GomokuState {
  board: Cell[][];
  currentTurn: Side;
  winner: 0 | 1 | 2 | null; // 0=draw, null=in progress
  seq: number;
}

export interface GomokuMove {
  row: number; // 0–14
  col: number; // 0–14
}

export type MoveResult =
  | { ok: true; state: GomokuState }
  | { ok: false; error: string };

const BOARD_SIZE = 15;

export function createInitialState(): GomokuState {
  const board: Cell[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(0)
  );
  return { board, currentTurn: 1, winner: null, seq: 0 };
}

/** Returns all empty intersections as valid moves for the current turn. */
export function getValidMoves(state: GomokuState): GomokuMove[] {
  if (state.winner !== null) return [];
  const moves: GomokuMove[] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (state.board[r][c] === 0) moves.push({ row: r, col: c });
    }
  }
  return moves;
}

/**
 * Apply a move. Returns a new state on success or an error string on failure.
 * The `side` parameter must match `state.currentTurn`.
 */
export function applyMove(
  state: GomokuState,
  move: GomokuMove,
  side: Side
): MoveResult {
  if (state.winner !== null) {
    return { ok: false, error: 'Game is already over' };
  }
  if (side !== state.currentTurn) {
    return { ok: false, error: 'Not your turn' };
  }
  const { row, col } = move;
  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return { ok: false, error: 'Position out of bounds' };
  }
  if (state.board[row][col] !== 0) {
    return { ok: false, error: 'Intersection already occupied' };
  }

  // Deep-copy the board
  const newBoard: Cell[][] = state.board.map(r => [...r] as Cell[]);
  newBoard[row][col] = side;

  const winner = checkWinner(newBoard);
  const draw = winner === null ? checkDraw(newBoard) : false;

  return {
    ok: true,
    state: {
      board: newBoard,
      currentTurn: side === 1 ? 2 : 1,
      winner: winner !== null ? winner : draw ? 0 : null,
      seq: state.seq + 1,
    },
  };
}

/** Scan all rows, columns, and diagonals for 5 consecutive same-color pieces. */
export function checkWinner(board: Cell[][]): 1 | 2 | null {
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal ↘
    [1, -1], // diagonal ↙
  ];

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (cell === 0) continue;
      for (const [dr, dc] of directions) {
        let count = 1;
        for (let i = 1; i < 5; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
          if (board[nr][nc] !== cell) break;
          count++;
        }
        if (count >= 5) return cell as 1 | 2;
      }
    }
  }
  return null;
}

/** Returns true when the board is completely full (used to detect a draw). */
export function checkDraw(board: Cell[][]): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) return false;
    }
  }
  return true;
}
