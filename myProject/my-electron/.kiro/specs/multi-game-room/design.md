# Design Document: Multi-Game Room Electron Application

## Overview

This application is a dual-module Electron desktop app built with React + TypeScript. The first module is a feature demonstration panel showcasing Electron IPC capabilities (system info, notifications, file I/O, window control). The second module is a real-time multiplayer board game room supporting Gomoku, Army Chess (Luzhanqi), and Jungle Chess (Dou Shou Qi), with online play via a public WebSocket server.

The project consists of two independently deployable components:
- **Electron Client** — the desktop app (this repo)
- **WebSocket Server** — a Node.js server deployed to a public cloud host

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Electron Application                   │
│                                                         │
│  ┌──────────────┐        ┌──────────────────────────┐  │
│  │  Main Process │        │     Renderer Process      │  │
│  │  (Node.js)   │◄──IPC─►│   (React + TypeScript)   │  │
│  │              │        │                           │  │
│  │  - Window    │        │  ┌────────┐ ┌──────────┐ │  │
│  │  - Tray      │        │  │ Route 1│ │ Route 2  │ │  │
│  │  - Menu      │        │  │Feature │ │  Game    │ │  │
│  │  - IPC       │        │  │  Demo  │ │  Room    │ │  │
│  │  - File I/O  │        │  └────────┘ └──────────┘ │  │
│  └──────────────┘        │       │           │       │  │
│                          │       └─────┬─────┘       │  │
│                          │             │              │  │
│                          │    ┌────────▼────────┐    │  │
│                          │    │  WebSocket Hook  │    │  │
│                          │    └────────┬────────┘    │  │
│                          └────────────┼─────────────┘  │
└───────────────────────────────────────┼─────────────────┘
                                        │ WSS
                            ┌───────────▼───────────┐
                            │   WebSocket Server     │
                            │   (Node.js + ws)       │
                            │                        │
                            │  - Room Manager        │
                            │  - Game State Engine   │
                            │  - Rules Validator     │
                            │  - Session Manager     │
                            └───────────────────────┘
```

### Key Design Decisions

1. **`HashRouter` for Electron routing** — Electron loads via `file://` protocol. `BrowserRouter` requires a real HTTP server for path-based routing. `HashRouter` works natively with `file://` and requires no server-side configuration.

2. **`ws` library for WebSocket server** — Lightweight, no framework overhead, full control over room/session logic. Socket.io adds unnecessary abstraction for this use case.

3. **Authoritative server model** — All game rule validation happens on the server. The client performs optimistic local validation for UX only. The server is the single source of truth for game state.

4. **Sequence numbers for move ordering** — Each room maintains a monotonically increasing sequence counter. Clients include the last known sequence in every move. The server rejects moves with stale sequences, preventing race conditions.

5. **In-memory state with timeout cleanup** — Game state lives in server memory (Map). Disconnected player seats are held for 5 minutes via `setTimeout`. No database required for MVP.

---

## Components and Interfaces

### Client-Side Component Tree

```
App
├── NicknameModal          (first-launch nickname prompt)
├── NavBar                 (persistent top navigation)
└── Routes
    ├── /demo → FeatureDemoPage
    │   ├── IpcPanel
    │   ├── FilePanel
    │   └── WindowPanel
    └── /game → GameRoomPage
        ├── RoomEntry      (room ID input)
        ├── GameLobby      (player list, game type selector, start button)
        └── GameBoard
            ├── GomokuBoard
            ├── ArmyChessBoard
            │   └── ArmyChessSetup  (piece arrangement phase)
            └── JungleChessBoard
```

### Client State Management

State is managed with React Context + `useReducer`. No external state library needed given the scope.

```typescript
// src/contexts/PlayerContext.tsx
interface PlayerState {
  nickname: string | null;       // null = Anonymous_User
  sessionId: string | null;
}

// src/contexts/RoomContext.tsx
interface RoomState {
  roomId: string | null;
  players: RoomPlayer[];
  spectators: number;
  gameType: GameType | null;
  gameStatus: 'lobby' | 'setup' | 'playing' | 'ended';
  gameState: GomokuState | ArmyChessState | JungleChessState | null;
  myRole: 'player' | 'spectator';
  myTurn: boolean;
  lastError: string | null;
}

type GameType = 'gomoku' | 'army-chess' | 'jungle-chess';
```

### WebSocket Hook

```typescript
// src/hooks/useGameSocket.ts
interface UseGameSocketReturn {
  connected: boolean;
  reconnecting: boolean;
  sendMessage: (msg: ClientMessage) => void;
}
```

The hook manages:
- Connection lifecycle (connect, reconnect up to 3 times, disconnect)
- Heartbeat ping every 25 seconds
- Incoming message dispatch to `RoomContext` reducer
- Outgoing message queuing during reconnection

### Server-Side Modules

```
server/
├── index.ts               entry point, HTTP + WS server
├── RoomManager.ts         create/join/delete rooms
├── SessionManager.ts      track connected clients, assign session IDs
├── games/
│   ├── GomokuEngine.ts    board state + win detection
│   ├── ArmyChessEngine.ts board state + movement + combat rules
│   └── JungleChessEngine.ts board state + terrain + combat rules
└── MessageHandler.ts      route incoming messages to correct handler
```

---

## Data Models

### WebSocket Message Protocol

All messages are JSON. Every message has a `type` field.

**Client → Server messages:**

```typescript
type ClientMessage =
  | { type: 'join_room';    roomId: string; nickname: string | null }
  | { type: 'leave_room' }
  | { type: 'select_game';  gameType: GameType }
  | { type: 'start_game' }
  | { type: 'make_move';    move: GameMove; seq: number }
  | { type: 'confirm_setup'; arrangement: ArmyChessPiece[] }  // Army Chess only
  | { type: 'ping' }
```

**Server → Client messages:**

```typescript
type ServerMessage =
  | { type: 'session_init';    sessionId: string }
  | { type: 'room_joined';     roomId: string; players: RoomPlayer[]; gameType: GameType | null; gameStatus: string }
  | { type: 'room_updated';    players: RoomPlayer[]; spectators: number }
  | { type: 'game_selected';   gameType: GameType }
  | { type: 'game_started';    gameState: GameState }
  | { type: 'move_applied';    move: GameMove; gameState: GameState; seq: number }
  | { type: 'move_rejected';   reason: string; seq: number }
  | { type: 'game_ended';      winner: string | null; reason: string }
  | { type: 'player_disconnected'; nickname: string; reconnectTimeout: number }
  | { type: 'player_reconnected';  nickname: string }
  | { type: 'error';           code: string; message: string }
  | { type: 'pong' }
```

### Room Model (Server)

```typescript
interface Room {
  id: string;
  players: Map<string, RoomPlayer>;   // sessionId → player
  spectators: Set<string>;            // sessionIds
  creatorId: string;
  gameType: GameType | null;
  gameStatus: 'lobby' | 'setup' | 'playing' | 'ended';
  gameEngine: GomokuEngine | ArmyChessEngine | JungleChessEngine | null;
  seq: number;                        // monotonic move counter
  cleanupTimer: NodeJS.Timeout | null;
}

interface RoomPlayer {
  sessionId: string;
  nickname: string;
  connected: boolean;
  reconnectTimer: NodeJS.Timeout | null;
  side: 'red' | 'blue' | null;       // assigned on game start
}
```

### Game Move Types

```typescript
// Gomoku
interface GomokuMove {
  row: number;   // 0–14
  col: number;   // 0–14
}

// Army Chess
interface ArmyChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}

// Jungle Chess
interface JungleChessMove {
  fromRow: number;  // 0–8
  fromCol: number;  // 0–6
  toRow: number;
  toCol: number;
}

type GameMove = GomokuMove | ArmyChessMove | JungleChessMove;
```

### Gomoku State

```typescript
interface GomokuState {
  board: (0 | 1 | 2)[][];   // 0=empty, 1=black, 2=white
  currentTurn: 1 | 2;
  winner: 1 | 2 | 0 | null; // 0=draw
  seq: number;
}
```

### Army Chess State

```typescript
type ArmyChessPieceType =
  | 'commander' | 'lt_general' | 'maj_general' | 'brigadier'
  | 'colonel' | 'major' | 'captain' | 'lieutenant'
  | 'engineer' | 'landmine' | 'bomb' | 'flag';

interface ArmyChessPiece {
  id: string;
  type: ArmyChessPieceType;
  side: 'red' | 'blue';
  row: number;
  col: number;
  alive: boolean;
}

interface ArmyChessState {
  pieces: ArmyChessPiece[];
  currentTurn: 'red' | 'blue';
  phase: 'setup' | 'playing';
  setupConfirmed: { red: boolean; blue: boolean };
  winner: 'red' | 'blue' | null;
  seq: number;
}
```

### Jungle Chess State

```typescript
type JungleAnimal = 'elephant' | 'lion' | 'tiger' | 'leopard' | 'wolf' | 'dog' | 'cat' | 'rat';

interface JunglePiece {
  animal: JungleAnimal;
  side: 'red' | 'blue';
  row: number;
  col: number;
  alive: boolean;
}

interface JungleChessState {
  pieces: JunglePiece[];
  currentTurn: 'red' | 'blue';
  winner: 'red' | 'blue' | null;
  seq: number;
}
```

### Army Chess Board Layout

The standard Luzhanqi board is 5 columns × 12 rows (each player's half is 5×6). Special terrain:

```
Terrain types per cell:
- 'road'      normal movement, 1 step
- 'railway'   Engineer can traverse continuously
- 'camp'      immune to capture (rows 2,4 cols 1,3 and row 3 col 2 per side)
- 'hq'        headquarters (row 0 cols 1,3 per side) — Flag must be placed here
- 'mountain'  impassable
```

### Jungle Chess Board Layout

Standard 7×9 board terrain:

```
Terrain types:
- 'land'      normal
- 'river'     only Rat can enter; Lion/Tiger jump over
- 'trap'      opponent's piece rank → 0 while inside
- 'den'       entering opponent's den wins the game
```

---

## Error Handling

| Scenario | Client Behavior | Server Behavior |
|---|---|---|
| WebSocket connection fails | Show error toast, retry up to 3× with 2s backoff | — |
| Move rejected by server | Show inline reason, revert optimistic update | Send `move_rejected` with reason |
| Player disconnects mid-game | Show "reconnecting" badge on their slot | Hold seat 5 min, broadcast `player_disconnected` |
| Room not found / full | Show error message on room entry screen | Send `error` with code `ROOM_FULL` or `ROOM_NOT_FOUND` |
| Invalid nickname | Show inline validation error, block submission | — |
| Heartbeat timeout (30s) | — | Terminate connection, trigger disconnect flow |

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)

- Game engine logic: win detection, move validation, combat resolution
- `NicknameModal` renders and validates input
- `RoomEntry` blocks empty submission
- `useGameSocket` hook reconnect logic (mock WebSocket)

### Property-Based Tests (fast-check)

Property tests run with a minimum of 100 iterations each.

Each property test is tagged with a comment in the format:
`// Feature: multi-game-room, Property N: <property text>`

---

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property-Based Testing Overview

Property-based testing (PBT) validates software correctness by testing universal properties across many generated inputs. Each property is a formal specification that should hold for all valid inputs. The library used is **fast-check** (TypeScript/JavaScript).

Each property test runs a minimum of 100 iterations and is tagged with:
`// Feature: multi-game-room, Property N: <property text>`

---

### Property 1: Nickname validation is consistent

*For any* string input, the nickname validation function should accept it if and only if it contains between 1 and 16 non-whitespace characters (after trimming), and reject all other inputs including empty strings and whitespace-only strings.

**Validates: Requirements 3.2**

---

### Property 2: Anonymous users are always spectators

*For any* room state and any user with a null nickname, their assigned role in the room should always be `'spectator'`, never `'player'`.

**Validates: Requirements 3.4**

---

### Property 3: Room ID validation rejects blank inputs

*For any* string composed entirely of whitespace characters (including empty string), the room entry validation should reject it and not attempt a server connection.

**Validates: Requirements 4.3**

---

### Property 4: Room join is idempotent for existing rooms

*For any* room ID, if a room with that ID already exists on the server, joining it should add the player to the existing room without creating a duplicate room. If the room does not exist, joining should create it. In both cases the player ends up in exactly one room with that ID.

**Validates: Requirements 4.4, 4.5**

---

### Property 5: Gomoku win detection covers all directions

*For any* 15×15 board state where exactly five consecutive pieces of the same color exist in any row, column, or diagonal, the win detection function should return that color as the winner. Boards with fewer than five in a row should return no winner.

**Validates: Requirements 6.4**

---

### Property 6: Gomoku move validation rejects illegal placements

*For any* Gomoku board state, attempting to place a piece on an already-occupied intersection should be rejected. Attempting to place a piece when it is not the player's turn should also be rejected.

**Validates: Requirements 6.6**

---

### Property 7: Army Chess combat resolution follows rank hierarchy

*For any* pair of Army Chess piece types (attacker, defender), the combat resolution function should return the correct outcome: higher rank wins, equal ranks eliminate both, Bomb beats all except Flag, Landmine beats all attackers except Engineer, Engineer captures Landmine.

**Validates: Requirements 7.6**

---

### Property 8: Army Chess movement only produces valid destinations

*For any* Army Chess board state and any selected piece, the set of valid move destinations returned by the engine should contain only cells reachable by that piece type according to terrain rules (road: 1 step, railway: Engineer continuous traversal, no jumping over occupied cells on railways).

**Validates: Requirements 7.5**

---

### Property 9: Camp immunity holds for all pieces

*For any* Army Chess board state where a piece occupies a camp cell, any attack targeting that piece should be rejected by the rules engine.

**Validates: Requirements 7.7**

---

### Property 10: Jungle Chess combat follows animal hierarchy

*For any* pair of Jungle Chess animal types (attacker, defender) on land, the combat resolution function should return the correct outcome: higher strength wins, equal strength eliminates both, Rat captures Elephant, any animal captures a piece with effective rank 0 (in trap).

**Validates: Requirements 8.4, 8.8**

---

### Property 11: Jungle Chess terrain movement rules are enforced

*For any* Jungle Chess board state and any selected piece, the valid move set should satisfy: only Rat can enter river cells; Lion and Tiger can jump over a river column/row if no Rat is in the river on that line; no other piece can enter or cross river cells.

**Validates: Requirements 8.7**

---

### Property 12: Trap reduces effective rank to zero

*For any* Jungle Chess piece that occupies an opponent's trap cell, its effective rank used in combat resolution should be 0, regardless of its actual animal type.

**Validates: Requirements 8.6**

---

### Property 13: Stale sequence numbers are rejected

*For any* room with current sequence number N, a move message carrying sequence number ≤ N should be rejected by the server with a `move_rejected` response. Only moves with sequence number N+1 should be accepted.

**Validates: Requirements 9.6**

---

### Property 14: Malformed messages are rejected by the server

*For any* WebSocket message that is missing required fields or contains fields of the wrong type, the server's message validator should return an error and not process the message.

**Validates: Requirements 14.3**

---

## Testing Strategy

### Unit Tests (Jest + React Testing Library)

Focus on specific examples, edge cases, and integration points:

- `NicknameModal`: renders on first launch, accepts valid nickname, blocks empty/whitespace/too-long input, skip sets anonymous state
- `RoomEntry`: blocks empty room ID submission, shows loading state during connection
- `GomokuBoard`: renders 15×15 grid, clicking places piece, occupied cell click is ignored
- `ArmyChessEngine`: setup phase piece placement, camp immunity, railway traversal edge cases
- `JungleChessEngine`: den entry win condition, trap entry/exit rank change, river jump blocked by Rat
- `useGameSocket`: reconnect fires up to 3 times, stops after 3 failures, restores state on reconnect

### Property-Based Tests (fast-check, min 100 iterations each)

One test per property listed above. Generators:

- `arbitraryNickname()` — random strings of varying length and whitespace composition
- `arbitraryGomokuBoard()` — random 15×15 boards with varying piece distributions
- `arbitraryArmyChessBoard()` — random valid board states respecting piece counts
- `arbitraryJungleBoard()` — random valid jungle board states
- `arbitraryPiecePair()` — random pairs of piece types for combat testing
- `arbitraryWsMessage()` — random objects with missing/wrong-typed fields for validation testing

### Test File Locations

```
src/
├── components/__tests__/
│   ├── NicknameModal.test.tsx
│   ├── RoomEntry.test.tsx
│   └── GomokuBoard.test.tsx
├── games/__tests__/
│   ├── gomoku.test.ts          (unit + property)
│   ├── armyChess.test.ts       (unit + property)
│   └── jungleChess.test.ts     (unit + property)
└── hooks/__tests__/
    └── useGameSocket.test.ts

server/
└── __tests__/
    ├── RoomManager.test.ts     (unit + property)
    ├── MessageValidator.test.ts (unit + property)
    └── GameEngines.test.ts
```
