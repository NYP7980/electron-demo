"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Feature: multi-game-room, Property 13: Stale sequence numbers are rejected
const fc = __importStar(require("fast-check"));
const RoomManager_1 = require("../RoomManager");
const SessionManager_1 = require("../SessionManager");
const ws_1 = require("ws");
function makeStubWs() {
    return {
        readyState: ws_1.WebSocket.OPEN,
        send: jest.fn(),
        terminate: jest.fn(),
        ping: jest.fn(),
    };
}
function setup() {
    const sessions = new SessionManager_1.SessionManager();
    const rooms = new RoomManager_1.RoomManager(sessions);
    return { sessions, rooms };
}
function registerAndJoin(sessions, rooms, roomId, nickname) {
    const ws = makeStubWs();
    const sessionId = sessions.createSession(ws);
    rooms.joinRoom(sessionId, roomId, nickname);
    return sessionId;
}
describe('RoomManager — Property 13: Stale sequence numbers are rejected', () => {
    /**
     * Property 13: Stale sequence numbers are rejected
     * For any room with current sequence number N, a move message carrying
     * sequence number ≤ N should be rejected. Only moves with sequence number
     * N+1 should be accepted.
     * Validates: Requirements 9.6
     */
    test('seq ≤ current room seq is always rejected', () => {
        fc.assert(fc.property(fc.integer({ min: 0, max: 100 }), // current seq N
        fc.integer({ min: 0, max: 100 }), // incoming seq (will be clamped to ≤ N)
        (currentSeq, offset) => {
            const { sessions, rooms } = setup();
            const roomId = 'test-room-' + Math.random();
            registerAndJoin(sessions, rooms, roomId, 'Alice');
            const room = rooms.getRoom(roomId);
            // Manually set the room's seq to currentSeq
            room.seq = currentSeq;
            // Incoming seq is ≤ currentSeq
            const incomingSeq = currentSeq - (offset % (currentSeq + 1));
            const error = rooms.validateAndAdvanceSeq(room, incomingSeq);
            expect(error).not.toBeNull();
            // seq should not have changed
            expect(room.seq).toBe(currentSeq);
        }), { numRuns: 200 });
    });
    test('seq = N+1 is always accepted and advances the counter', () => {
        fc.assert(fc.property(fc.integer({ min: 0, max: 1000 }), (currentSeq) => {
            const { sessions, rooms } = setup();
            const roomId = 'test-room-' + Math.random();
            registerAndJoin(sessions, rooms, roomId, 'Alice');
            const room = rooms.getRoom(roomId);
            room.seq = currentSeq;
            const error = rooms.validateAndAdvanceSeq(room, currentSeq + 1);
            expect(error).toBeNull();
            expect(room.seq).toBe(currentSeq + 1);
        }), { numRuns: 200 });
    });
    test('seq > N+1 (gap) is rejected', () => {
        fc.assert(fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: 2, max: 50 }), // gap of at least 2
        (currentSeq, gap) => {
            const { sessions, rooms } = setup();
            const roomId = 'test-room-' + Math.random();
            registerAndJoin(sessions, rooms, roomId, 'Alice');
            const room = rooms.getRoom(roomId);
            room.seq = currentSeq;
            const error = rooms.validateAndAdvanceSeq(room, currentSeq + gap);
            expect(error).not.toBeNull();
            expect(room.seq).toBe(currentSeq);
        }), { numRuns: 200 });
    });
    test('seq = 0 is rejected when room seq is 0 (duplicate first move)', () => {
        const { sessions, rooms } = setup();
        const roomId = 'test-room-zero';
        registerAndJoin(sessions, rooms, roomId, 'Alice');
        const room = rooms.getRoom(roomId);
        expect(room.seq).toBe(0);
        const error = rooms.validateAndAdvanceSeq(room, 0);
        expect(error).not.toBeNull();
    });
});
