// src/hooks/__tests__/useGameSocket.test.ts
// Unit tests for useGameSocket: reconnect behaviour and heartbeat ping
// Requirements: 13.2

import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { RoomProvider } from '../../contexts/RoomContext';

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------
type WsEventType = 'open' | 'close' | 'message' | 'error';

class MockWebSocket {
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.OPEN;
  sentMessages: string[] = [];

  // Handlers set by the hook
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  // Keep track of all instances created
  static instances: MockWebSocket[] = [];

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  /** Test helper: simulate the server opening the connection */
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  /** Test helper: simulate the server sending a message */
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  /** Test helper: simulate a connection drop */
  simulateDrop() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

// Replace global WebSocket with mock before tests
const OriginalWebSocket = global.WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  jest.useFakeTimers();
  (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
});

afterEach(() => {
  jest.useRealTimers();
  (global as unknown as { WebSocket: unknown }).WebSocket = OriginalWebSocket;
});

// ---------------------------------------------------------------------------
// Helper: render the hook inside RoomProvider
// ---------------------------------------------------------------------------
function renderSocketHook() {
  // Import here so the mock is in place
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useGameSocket } = require('../useGameSocket');
  return renderHook(() => useGameSocket(), {
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(RoomProvider, null, children),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useGameSocket — reconnect behaviour', () => {
  it('connects on mount and sets connected=true', () => {
    const { result } = renderSocketHook();

    act(() => {
      MockWebSocket.instances[0]?.simulateOpen();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.reconnecting).toBe(false);
  });

  it('attempts to reconnect up to 3 times after disconnect', () => {
    renderSocketHook();

    // Open initial connection then drop it — triggers reconnect cycle
    act(() => { MockWebSocket.instances[0]?.simulateOpen(); });
    act(() => { MockWebSocket.instances[0]?.simulateDrop(); });

    // Reconnect attempt 1 (timer fires, new WS created, immediately drops)
    act(() => { jest.advanceTimersByTime(2000); });
    expect(MockWebSocket.instances).toHaveLength(2);
    act(() => { MockWebSocket.instances[1]?.simulateDrop(); });

    // Reconnect attempt 2
    act(() => { jest.advanceTimersByTime(2000); });
    expect(MockWebSocket.instances).toHaveLength(3);
    act(() => { MockWebSocket.instances[2]?.simulateDrop(); });

    // Reconnect attempt 3
    act(() => { jest.advanceTimersByTime(2000); });
    expect(MockWebSocket.instances).toHaveLength(4);
    act(() => { MockWebSocket.instances[3]?.simulateDrop(); });

    // No more reconnects after 3 attempts
    act(() => { jest.advanceTimersByTime(2000); });
    expect(MockWebSocket.instances).toHaveLength(4);
  });

  it('stops reconnecting after 3 failed attempts', () => {
    const { result } = renderSocketHook();

    // Drop without ever opening (simulates immediate close)
    act(() => { MockWebSocket.instances[0]?.simulateDrop(); });

    // Exhaust all 3 reconnect attempts
    for (let i = 0; i < 3; i++) {
      act(() => { jest.advanceTimersByTime(2000); });
      const latest = MockWebSocket.instances[MockWebSocket.instances.length - 1];
      act(() => { latest?.simulateDrop(); });
    }

    const countAfterExhaustion = MockWebSocket.instances.length;
    act(() => { jest.advanceTimersByTime(10000); });
    // No new instances created
    expect(MockWebSocket.instances.length).toBe(countAfterExhaustion);
    expect(result.current.reconnecting).toBe(false);
  });
});

describe('useGameSocket — heartbeat ping', () => {
  it('sends a ping every 25 seconds after connecting', () => {
    renderSocketHook();

    act(() => { MockWebSocket.instances[0]?.simulateOpen(); });

    const ws = MockWebSocket.instances[0];
    expect(ws.sentMessages).toHaveLength(0);

    // Advance 25s — first ping
    act(() => { jest.advanceTimersByTime(25000); });
    expect(ws.sentMessages).toHaveLength(1);
    expect(JSON.parse(ws.sentMessages[0])).toEqual({ type: 'ping' });

    // Advance another 25s — second ping
    act(() => { jest.advanceTimersByTime(25000); });
    expect(ws.sentMessages).toHaveLength(2);
  });

  it('stops sending pings after disconnect', () => {
    renderSocketHook();

    act(() => { MockWebSocket.instances[0]?.simulateOpen(); });
    const ws = MockWebSocket.instances[0];

    // One ping fires
    act(() => { jest.advanceTimersByTime(25000); });
    expect(ws.sentMessages).toHaveLength(1);

    // Drop connection
    act(() => { ws.simulateDrop(); });

    // Advance — no more pings on the old socket
    act(() => { jest.advanceTimersByTime(25000); });
    expect(ws.sentMessages).toHaveLength(1);
  });
});
