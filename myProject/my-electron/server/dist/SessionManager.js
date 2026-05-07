"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const uuid_1 = require("uuid");
const ws_1 = require("ws");
class SessionManager {
    constructor() {
        this.sessions = new Map();
        /** Reverse lookup: ws → sessionId */
        this.wsSessions = new WeakMap();
    }
    /** Register a new connection, assign a UUID session ID, send session_init. */
    createSession(ws) {
        const sessionId = (0, uuid_1.v4)();
        const session = { sessionId, ws, isAlive: true };
        this.sessions.set(sessionId, session);
        this.wsSessions.set(ws, sessionId);
        const msg = { type: 'session_init', sessionId };
        ws.send(JSON.stringify(msg));
        return sessionId;
    }
    getSessionId(ws) {
        return this.wsSessions.get(ws);
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    getWs(sessionId) {
        return this.sessions.get(sessionId)?.ws;
    }
    markAlive(sessionId) {
        const s = this.sessions.get(sessionId);
        if (s)
            s.isAlive = true;
    }
    removeSession(sessionId) {
        const s = this.sessions.get(sessionId);
        if (s) {
            this.wsSessions.delete(s.ws);
            this.sessions.delete(sessionId);
        }
    }
    /** Send a typed message to a specific session. */
    send(sessionId, msg) {
        const s = this.sessions.get(sessionId);
        if (s && s.ws.readyState === ws_1.WebSocket.OPEN) {
            s.ws.send(JSON.stringify(msg));
        }
    }
    /** Iterate all sessions for heartbeat checks. */
    forEachSession(cb) {
        this.sessions.forEach(cb);
    }
}
exports.SessionManager = SessionManager;
