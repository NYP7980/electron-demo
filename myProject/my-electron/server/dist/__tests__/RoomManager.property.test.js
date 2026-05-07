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
// Feature: multi-game-room, Property 4: Room join is idempotent for existing rooms
const fc = __importStar(require("fast-check"));
const RoomManager_1 = require("../RoomManager");
const SessionManager_1 = require("../SessionManager");
const ws_1 = require("ws");
/** Create a minimal stub WebSocket that records sent messages. */
function makeStubWs() {
    const ws = {
        readyState: ws_1.WebSocket.OPEN,
        send: jest.fn(),
        terminate: jest.fn(),
        ping: jest.fn(),
    };
    return ws;
}
function makeSessionManager() {
    return new SessionManager_1.SessionManager();
}
function makeRoomManager(sessions) {
    return new RoomManager_1.RoomManager(sessions);
}
/** Register a fake session and return its sessionId. */
function registerSession(sessions, nickname) {
    const ws = makeStubWs();
    const sessionId = sessions.createSession(ws);
    return sessionId;
}
describe('RoomManager — Property 4: Room join is idempotent for existing rooms', () => {
    /**
     * Property 4: Room join is idempotent for existing rooms
     * For any room ID, if a room with that ID already exists on the server,
     * joining it should add the player to the existing room without creating a
     * duplicate room. If the room does not exist, joining should create it.
     * In both cases the player ends up in exactly one room with that ID.
     * Validates: Requirements 4.4, 4.5
     */
    test('joining a non-existent room creates it and places the player in it', () => {
        fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), fc.string({ minLength: 1, maxLength: 16 }).filter(s => s.trim().length > 0), (roomId, nickname) => {
            const sessions = makeSessionManager();
            const rooms = makeRoomManager(sessions);
            const sessionId = registerSession(sessions, nickname);
            const error = rooms.joinRoom(sessionId, roomId, nickname);
            expect(error).toBeNull();
            const room = rooms.getRoom(roomId);
            expect(room).toBeDefined();
            expect(room.players.has(sessionId)).toBe(true);
        }), { numRuns: 100 });
    });
    test('joining an existing room adds the player without creating a duplicate', () => {
        fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), fc.tuple(fc.string({ minLength: 1, maxLength: 16 }).filter(s => s.trim().length > 0), fc.string({ minLength: 1, maxLength: 16 }).filter(s => s.trim().length > 0)), (roomId, [nick1, nick2]) => {
            const sessions = makeSessionManager();
            const rooms = makeRoomManager(sessions);
            const s1 = registerSession(sessions, nick1);
            const s2 = registerSession(sessions, nick2);
            // First player creates the room
            rooms.joinRoom(s1, roomId, nick1);
            // Second player joins the same room
            rooms.joinRoom(s2, roomId, nick2);
            const room = rooms.getRoom(roomId);
            expect(room).toBeDefined();
            // Both players are in the same room
            expect(room.players.has(s1) || room.spectators.has(s1)).toBe(true);
            expect(room.players.has(s2) || room.spectators.has(s2)).toBe(true);
        }), { numRuns: 100 });
    });
    test('a player ends up in exactly one room after joining', () => {
        fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), fc.string({ minLength: 1, maxLength: 16 }).filter(s => s.trim().length > 0), (roomId, nickname) => {
            const sessions = makeSessionManager();
            const rooms = makeRoomManager(sessions);
            const sessionId = registerSession(sessions, nickname);
            rooms.joinRoom(sessionId, roomId, nickname);
            const room = rooms.getRoomForSession(sessionId);
            expect(room).toBeDefined();
            expect(room.id).toBe(roomId);
        }), { numRuns: 100 });
    });
    test('blank room IDs are rejected', () => {
        fc.assert(fc.property(fc.string().filter(s => s.trim().length === 0), fc.string({ minLength: 1, maxLength: 16 }), (blankRoomId, nickname) => {
            const sessions = makeSessionManager();
            const rooms = makeRoomManager(sessions);
            const sessionId = registerSession(sessions, nickname);
            const error = rooms.joinRoom(sessionId, blankRoomId, nickname);
            expect(error).not.toBeNull();
        }), { numRuns: 100 });
    });
    test('anonymous users join as spectators, not players', () => {
        fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0), (roomId) => {
            const sessions = makeSessionManager();
            const rooms = makeRoomManager(sessions);
            const sessionId = registerSession(sessions, null);
            rooms.joinRoom(sessionId, roomId, null);
            const room = rooms.getRoom(roomId);
            expect(room).toBeDefined();
            expect(room.players.has(sessionId)).toBe(false);
            expect(room.spectators.has(sessionId)).toBe(true);
        }), { numRuns: 100 });
    });
});
