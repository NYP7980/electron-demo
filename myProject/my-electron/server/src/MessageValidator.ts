import { ClientMessage, GameType } from './types';

export interface ValidationError {
  code: 'INVALID_MESSAGE';
  message: string;
}

export type ValidationResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: ValidationError };

const VALID_GAME_TYPES: GameType[] = ['gomoku', 'army-chess', 'jungle-chess'];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function err(message: string): ValidationResult {
  return { ok: false, error: { code: 'INVALID_MESSAGE', message } };
}

/**
 * Validate a raw parsed JSON value as a ClientMessage.
 * Returns a typed ClientMessage on success, or a ValidationError on failure.
 */
export function validateMessage(raw: unknown): ValidationResult {
  if (!isObject(raw)) {
    return err('Message must be a JSON object');
  }

  const { type } = raw;
  if (!isString(type)) {
    return err('Message must have a string "type" field');
  }

  switch (type) {
    case 'join_room': {
      if (!isString(raw.roomId)) return err('"join_room" requires string "roomId"');
      if (raw.nickname !== null && !isString(raw.nickname)) {
        return err('"join_room" requires string or null "nickname"');
      }
      return { ok: true, message: { type: 'join_room', roomId: raw.roomId as string, nickname: raw.nickname as string | null } };
    }

    case 'leave_room': {
      return { ok: true, message: { type: 'leave_room' } };
    }

    case 'select_game': {
      if (!isString(raw.gameType) || !VALID_GAME_TYPES.includes(raw.gameType as GameType)) {
        return err('"select_game" requires "gameType" to be one of: ' + VALID_GAME_TYPES.join(', '));
      }
      return { ok: true, message: { type: 'select_game', gameType: raw.gameType as GameType } };
    }

    case 'start_game': {
      return { ok: true, message: { type: 'start_game' } };
    }

    case 'make_move': {
      if (!isObject(raw.move)) return err('"make_move" requires object "move"');
      if (!isNumber(raw.seq)) return err('"make_move" requires number "seq"');
      return { ok: true, message: { type: 'make_move', move: raw.move as unknown as import('./types').GameMove, seq: raw.seq as number } };
    }

    case 'confirm_setup': {
      if (!isArray(raw.arrangement)) return err('"confirm_setup" requires array "arrangement"');
      for (const item of raw.arrangement) {
        if (!isObject(item)) return err('"confirm_setup" arrangement items must be objects');
        if (!isString(item.id)) return err('"confirm_setup" arrangement items require string "id"');
        if (!isNumber(item.row)) return err('"confirm_setup" arrangement items require number "row"');
        if (!isNumber(item.col)) return err('"confirm_setup" arrangement items require number "col"');
      }
      return {
        ok: true,
        message: {
          type: 'confirm_setup',
          arrangement: (raw.arrangement as Array<Record<string, unknown>>).map(item => ({
            id: item.id as string,
            row: item.row as number,
            col: item.col as number,
          })),
        },
      };
    }

    case 'ping': {
      return { ok: true, message: { type: 'ping' } };
    }

    default:
      return err(`Unknown message type: "${type}"`);
  }
}
