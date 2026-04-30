import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { SessionManager } from './SessionManager';
import { RoomManager } from './RoomManager';
import { MessageHandler } from './MessageHandler';
import { validateMessage } from './MessageValidator';

const PORT = parseInt(process.env.PORT ?? '4000', 10);

const HEARTBEAT_INTERVAL_MS = 25_000;  // ping every 25s
const HEARTBEAT_TIMEOUT_MS  = 30_000;  // terminate if no pong within 30s

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Multi-Game Room WebSocket Server\n');
});

const wss = new WebSocketServer({ server });

const sessions = new SessionManager();
const rooms    = new RoomManager(sessions);
const handler  = new MessageHandler(sessions, rooms);

// ---------------------------------------------------------------------------
// Connection handling
// ---------------------------------------------------------------------------

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

    // Reset heartbeat liveness on any message
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

// ---------------------------------------------------------------------------
// Heartbeat — ping every 25s, terminate if no response within 30s
// ---------------------------------------------------------------------------

const heartbeatInterval = setInterval(() => {
  sessions.forEachSession((session) => {
    if (!session.isAlive) {
      // No pong received since last ping — terminate
      session.ws.terminate();
      return;
    }
    session.isAlive = false;
    session.ws.ping();
  });
}, HEARTBEAT_INTERVAL_MS);

// Ensure the interval doesn't keep the process alive
heartbeatInterval.unref?.();

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`[server] WebSocket server listening on port ${PORT}`);
});

export { server, wss, sessions, rooms, handler };
