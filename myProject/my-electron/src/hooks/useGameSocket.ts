import { useEffect, useRef, useCallback } from 'react';
import { useRoom } from '../contexts/RoomContext';
import { getGameServerUrl } from '../config/gameServer';
import type { ServerMessage } from '../types/shared';

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 25000;

export interface UseGameSocketReturn {
  connected: boolean;
  reconnecting: boolean;
  sendMessage: (msg: { type: string; [key: string]: unknown }) => void;
}

export function useGameSocket(): UseGameSocketReturn {
  const { dispatch, setSendMessage, roomState } = useRoom();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current !== null) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((msg: { type: string; [key: string]: unknown }) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(getGameServerUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      reconnectAttemptsRef.current = 0;
      dispatch({ type: 'CONNECTED' });

      clearHeartbeat();
      heartbeatTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, HEARTBEAT_INTERVAL_MS);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const message = JSON.parse(event.data as string) as ServerMessage;
        dispatch({ type: 'SERVER_MESSAGE', message });
      } catch {
        console.error('Failed to parse server message:', event.data);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      clearHeartbeat();
      dispatch({ type: 'DISCONNECTED' });

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        dispatch({ type: 'RECONNECTING' });
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [dispatch, clearHeartbeat]);

  useEffect(() => {
    setSendMessage(sendMessage);
  }, [sendMessage, setSendMessage]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearHeartbeat();
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearHeartbeat, clearReconnectTimer, connect]);

  return {
    connected: roomState.connected,
    reconnecting: roomState.reconnecting,
    sendMessage,
  };
}
