import { executeAction, type ActionResult } from '@/engine/actions/execute';
import { playCard, resolveReaction, type CardTarget } from '@/engine/effects/cards';
import {
  advanceTurn,
  applyNight,
  declareVictory,
  endOperate,
  resolveUpkeepChoice,
  runClosePhase,
  runDrawPhase,
  runPolicePhase,
  skipScheme,
  spinNight,
} from '@/engine/phases';
import { createGame, type NewGameOptions } from '@/engine/setup';
import type { GameState, PlayerId, UpkeepChoice, VictoryType } from '@/types';
import type { GameAction } from '@/engine/actions';

export * from '@/engine/actions';
export * from '@/engine/selectors';
export { createGame, advanceTurn, declareVictory, resolveUpkeepChoice, resolveReaction, playCard };
export type { NewGameOptions, CardTarget, ActionResult, GameAction };

/**
 * The single entry point the UI and the simulation both drive.
 *
 * Every command returns a brand new state; nothing mutates what it is given, so
 * React re-renders correctly and the simulation can snapshot freely.
 */
export type Command =
  | { type: 'ADVANCE_PHASE' }
  | { type: 'PLAY_CARD'; cardId: string; target?: CardTarget }
  | { type: 'SKIP_CARD' }
  | { type: 'RESOLVE_REACTION'; cardId: string | null }
  | { type: 'ACTION'; action: GameAction }
  | { type: 'END_OPERATE' }
  | { type: 'SPIN' }
  | { type: 'UPKEEP_CHOICE'; choice: UpkeepChoice }
  | { type: 'DECLARE'; victoryType: VictoryType };

export interface CommandResult {
  state: GameState;
  ok: boolean;
  error?: string;
}

export function dispatch(
  state: GameState,
  playerId: PlayerId,
  command: Command,
): CommandResult {
  if (state.gameOver && command.type !== 'ADVANCE_PHASE') {
    return { state, ok: false, error: 'The game is over.' };
  }

  // A pending reaction blocks everything else until it is answered.
  if (state.pendingReaction && command.type !== 'RESOLVE_REACTION') {
    return { state, ok: false, error: 'A reaction window is open.' };
  }

  // Same for an unpaid-upkeep decision.
  if (state.pendingUpkeep && command.type !== 'UPKEEP_CHOICE') {
    return { state, ok: false, error: 'An unpaid upkeep decision is pending.' };
  }

  switch (command.type) {
    case 'ADVANCE_PHASE':
      return { state: advancePhase(state), ok: true };

    case 'PLAY_CARD': {
      const result = playCard(state, playerId, command.cardId, command.target ?? {});
      return { state: result.state, ok: result.ok, error: result.error };
    }

    case 'SKIP_CARD':
      return { state: skipScheme(state), ok: true };

    case 'RESOLVE_REACTION':
      return { state: resolveReaction(state, command.cardId), ok: true };

    case 'ACTION': {
      const result = executeAction(state, playerId, command.action);
      return { state: result.state, ok: result.ok, error: result.error };
    }

    case 'END_OPERATE':
      return { state: endOperate(state), ok: true };

    case 'SPIN':
      return { state: spinNight(state), ok: true };

    case 'UPKEEP_CHOICE':
      return { state: resolveUpkeepChoice(state, command.choice), ok: true };

    case 'DECLARE':
      return { state: declareVictory(state, playerId, command.victoryType), ok: true };

    default:
      return { state, ok: false, error: 'Unknown command.' };
  }
}

/** Moves the game to the next phase, running whatever that phase entails. */
export function advancePhase(state: GameState): GameState {
  switch (state.phase) {
    case 'draw':
      return runDrawPhase(state);
    case 'scheme':
      return skipScheme(state);
    case 'operate':
      return endOperate(state);
    case 'resolve':
      if (!state.pendingNight?.spun) return spinNight(state);
      return applyNight(state);
    case 'police':
      return runPolicePhase(state);
    case 'close':
      return runClosePhase(state);
    default:
      return state;
  }
}

export function newGame(options: NewGameOptions): GameState {
  return createGame(options);
}
