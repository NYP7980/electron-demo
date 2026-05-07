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
exports.handler = exports.rooms = exports.sessions = exports.wss = exports.server = void 0;
const http = __importStar(require("http"));
const ws_1 = require("ws");
const SessionManager_1 = require("./SessionManager");
const RoomManager_1 = require("./RoomManager");
const MessageHandler_1 = require("./MessageHandler");
const MessageValidator_1 = require("./MessageValidator");
const PORT = parseInt(process.env.PORT ?? '4000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const HEARTBEAT_INTERVAL_MS = 25000;
const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Multi-Game Room WebSocket Server\n');
});
exports.server = server;
const wss = new ws_1.WebSocketServer({ server });
exports.wss = wss;
const sessions = new SessionManager_1.SessionManager();
exports.sessions = sessions;
const rooms = new RoomManager_1.RoomManager(sessions);
exports.rooms = rooms;
const handler = new MessageHandler_1.MessageHandler(sessions, rooms);
exports.handler = handler;
wss.on('connection', (ws) => {
    const sessionId = sessions.createSession(ws);
    ws.on('message', (data) => {
        let raw;
        try {
            raw = JSON.parse(data.toString());
        }
        catch {
            sessions.send(sessionId, { type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' });
            return;
        }
        const result = (0, MessageValidator_1.validateMessage)(raw);
        if (!result.ok) {
            sessions.send(sessionId, {
                type: 'error',
                code: result.error.code,
                message: result.error.message,
            });
            return;
        }
        sessions.markAlive(sessionId);
        handler.handle(sessionId, result.message);
    });
    ws.on('pong', () => {
        sessions.markAlive(sessionId);
    });
    ws.on('close', () => {
        rooms.handleDisconnect(sessionId);
        sessions.removeSession(sessionId);
    });
    ws.on('error', (err) => {
        console.error(`[ws] error for session ${sessionId}:`, err.message);
    });
});
const heartbeatInterval = setInterval(() => {
    sessions.forEachSession((session) => {
        if (!session.isAlive) {
            session.ws.terminate();
            return;
        }
        session.isAlive = false;
        session.ws.ping();
    });
}, HEARTBEAT_INTERVAL_MS);
heartbeatInterval.unref?.();
server.listen(PORT, HOST, () => {
    console.log(`[server] WebSocket server listening on ${HOST}:${PORT}`);
});
