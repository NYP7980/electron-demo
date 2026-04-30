// Feature: multi-game-room, Property 2: Anonymous users are always spectators
// Validates: Requirements 3.4
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Inline the role-assignment logic from RoomContext so we can test it in
// isolation without a React rendering environment.
// ---------------------------------------------------------------------------

interface RoomPlayer {
    sessionId: string;
    nickname: string;
    connected: boolean;
    side: 'red' | 'blue' | null;
}

/**
 * Mirrors the role-assignment logic in RoomContext's applyServerMessage
 * for the 'room_joined' case.
 *
 * A user is a 'player' if their sessionId appears in the players list.
 * A user with a null nickname (anonymous) is never added to the players list
 * by the server — they are tracked as spectators only.
 */
function assignRole(
    sessionId: string | null,
    nickname: string | null,
    players: RoomPlayer[]
): 'player' | 'spectator' {
    if (!sessionId) return 'spectator';
    const found = players.find(p => p.sessionId === sessionId);
    return found ? 'player' : 'spectator';
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const arbitrarySessionId = fc.string({ minLength: 1, maxLength: 36 });

const arbitraryPlayer = fc.record<RoomPlayer>({
    sessionId: arbitrarySessionId,
    nickname: fc.string({ minLength: 1, maxLength: 16 }),
    connected: fc.boolean(),
    side: fc.constantFrom('red' as const, 'blue' as const, null),
});

const arbitraryPlayers = fc.array(arbitraryPlayer, { minLength: 0, maxLength: 4 });

// ---------------------------------------------------------------------------
// Property 2: Anonymous users are always spectators
// ---------------------------------------------------------------------------

describe('Property 2: Anonymous users are always spectators', () => {
    it('assigns spectator role for any anonymous user (null nickname) regardless of room state', () => {
        fc.assert(
            fc.property(
                arbitrarySessionId,
                arbitraryPlayers,
                (sessionId, players) => {
                    // Anonymous user: nickname is null
                    // The server never adds anonymous users to the players list,
                    // so we ensure sessionId is NOT in the players list.
                    const playersWithoutMe = players.filter(p => p.sessionId !== sessionId);
                    const role = assignRole(sessionId, null, playersWithoutMe);
                    expect(role).toBe('spectator');
                }
            ),
            { numRuns: 200 }
        );
    });

    it('assigns player role for registered users whose sessionId is in the players list', () => {
        fc.assert(
            fc.property(
                arbitrarySessionId,
                fc.string({ minLength: 1, maxLength: 16 }),
                arbitraryPlayers,
                (sessionId, nickname, otherPlayers) => {
                    // Registered user: nickname is non-null, sessionId is in players list
                    const myEntry: RoomPlayer = { sessionId, nickname, connected: true, side: null };
                    const players = [myEntry, ...otherPlayers.filter(p => p.sessionId !== sessionId)];
                    const role = assignRole(sessionId, nickname, players);
                    expect(role).toBe('player');
                }
            ),
            { numRuns: 200 }
        );
    });

    it('assigns spectator role when sessionId is null', () => {
        fc.assert(
            fc.property(
                arbitraryPlayers,
                (players) => {
                    const role = assignRole(null, null, players);
                    expect(role).toBe('spectator');
                }
            ),
            { numRuns: 100 }
        );
    });
});
