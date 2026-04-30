import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { ServerMessage } from './types';

export interface Session {
  sessionId: string;
  ws: WebSocket;
  isAlive: boolean;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  /** Reverse lookup: ws → sessionId */
  private wsSessions: WeakMap<WebSocket, string> = new WeakMap();

  /** Register a new connection, assign a UUID session ID, send session_init. */
  createSession(ws: WebSocket): string {
    const sessionId = uuidv4();
    const session: Session = { sessionId, ws, isAlive: true };
    this.sessions.set(sessionId, session);
    this.wsSessions.set(ws, sessionId);

    const msg: ServerMessage = { type: 'session_init', sessionId };
    ws.send(JSON.stringify(msg));

    return sessionId;
  }

  getSessionId(ws: WebSocket): string | undefined {
    return this.wsSessions.get(ws);
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getWs(sessionId: string): WebSocket | undefined {
    return this.sessions.get(sessionId)?.ws;
  }

  markAlive(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (s) s.isAlive = true;
  }

  removeSession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (s) {
      this.wsSessions.delete(s.ws);
      this.sessions.delete(sessionId);
    }
  }

  /** Send a typed message to a specific session. */
  send(sessionId: string, msg: ServerMessage): void {
    const s = this.sessions.get(sessionId);
    if (s && s.ws.readyState === WebSocket.OPEN) {
      s.ws.send(JSON.stringify(msg));
    }
  }

  /** Iterate all sessions for heartbeat checks. */
  forEachSession(cb: (session: Session) => void): void {
    this.sessions.forEach(cb);
  }
}
