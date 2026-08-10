import type { GameSettings, GameState } from '@/types';

const GAME_KEY = 'money-mile:game';
const SETTINGS_KEY = 'money-mile:settings';
const SNAPSHOT_KEY = 'money-mile:snapshot';
const TUTORIAL_KEY = 'money-mile:tutorial-seen';

const CURRENT_VERSION = 1;

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(GAME_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or private mode: the game still plays, it just will not resume.
  }
}

export function loadGame(): GameState | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  const raw = storage.getItem(GAME_KEY);
  if (!raw) return null;
  const result = parseGameState(raw);
  return result.ok && result.state ? result.state : null;
}

export function clearGame(): void {
  safeLocalStorage()?.removeItem(GAME_KEY);
}

export function saveSnapshot(state: GameState): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  storage.setItem(SNAPSHOT_KEY, JSON.stringify(state));
}

export function loadSnapshot(): GameState | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  const raw = storage.getItem(SNAPSHOT_KEY);
  if (!raw) return null;
  const result = parseGameState(raw);
  return result.ok && result.state ? result.state : null;
}

export function hasSnapshot(): boolean {
  return Boolean(safeLocalStorage()?.getItem(SNAPSHOT_KEY));
}

export function saveSettings(settings: GameSettings): void {
  safeLocalStorage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSettings(): GameSettings | null {
  const raw = safeLocalStorage()?.getItem(SETTINGS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameSettings;
  } catch {
    return null;
  }
}

export function markTutorialSeen(): void {
  safeLocalStorage()?.setItem(TUTORIAL_KEY, '1');
}

export function tutorialSeen(): boolean {
  return safeLocalStorage()?.getItem(TUTORIAL_KEY) === '1';
}

export interface ParseResult {
  ok: boolean;
  state?: GameState;
  error?: string;
}

/**
 * Validates an imported game state before it is trusted.
 *
 * An imported file is untrusted input: a malformed one must produce an error
 * message, never a half-loaded game that breaks three turns later.
 */
export function parseGameState(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' };
  }

  const state = parsed as Partial<GameState>;

  const required: (keyof GameState)[] = [
    'version',
    'seed',
    'round',
    'phase',
    'players',
    'playerOrder',
    'properties',
    'police',
    'deck',
    'cards',
  ];

  for (const key of required) {
    if (state[key] === undefined || state[key] === null) {
      return { ok: false, error: `Saved game is missing "${String(key)}".` };
    }
  }

  if (state.version !== CURRENT_VERSION) {
    return {
      ok: false,
      error: `Saved game is version ${state.version}; this build reads version ${CURRENT_VERSION}.`,
    };
  }

  if (!Array.isArray(state.playerOrder) || state.playerOrder.length < 3) {
    return { ok: false, error: 'Saved game does not contain 3 or 4 players.' };
  }

  for (const id of state.playerOrder) {
    const player = state.players?.[id];
    if (!player) return { ok: false, error: `Saved game is missing player "${id}".` };
    if (typeof player.cleanCash !== 'number' || player.cleanCash < 0) {
      return { ok: false, error: `Player "${id}" has invalid Clean Cash.` };
    }
    if (typeof player.dirtyCash !== 'number' || player.dirtyCash < 0) {
      return { ok: false, error: `Player "${id}" has invalid Dirty Cash.` };
    }
    if (player.heat < 0 || player.heat > 10) {
      return { ok: false, error: `Player "${id}" has Heat outside 0-10.` };
    }
    if (player.notoriety < 0 || player.notoriety > 5) {
      return { ok: false, error: `Player "${id}" has Notoriety outside 0-5.` };
    }
    if (player.heat < player.notoriety) {
      return { ok: false, error: `Player "${id}" has Heat below their Notoriety.` };
    }
  }

  if (Object.keys(state.properties ?? {}).length !== 24) {
    return { ok: false, error: 'Saved game does not contain 24 Properties.' };
  }

  return { ok: true, state: state as GameState };
}

export function exportGameState(state: GameState): string {
  return JSON.stringify(state, null, 2);
}

export function downloadGameState(state: GameState): void {
  const blob = new Blob([exportGameState(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `money-mile-${state.seed}-r${state.round}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
