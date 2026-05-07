import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { SessionManager } from './SessionManager';
import { RoomManager } from './RoomManager';
import { MessageHandler } from './MessageHandler';
import { validateMessage } from './MessageValidator';

const PORT = parseInt(process.env.PORT ?? '4000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

const HEARTBEAT_INTERVAL_MS = 25_000;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Multi-Game Room WebSocket Server\n');
});

const wss = new WebSocketServer({ server });

const sessions = new SessionManager();
const rooms = new RoomManager(sessions);
const handler = new MessageHandler(sessions, rooms);

wss.on('connection', (ws: WebSocket) => {
  const sessionId = sessions.createSession(ws);

  ws.on('message', (data) => {
    let raw: unknown;
    try {
      raw = JSON.parse(data.toString());
    } catch {
      sessions.send(sessionId, { type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' });
      return;
    }

    const result = validateMessage(raw);
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

export { server, wss, sessions, rooms, handler };
