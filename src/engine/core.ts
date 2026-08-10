import { BALANCE } from '@/content/balance';
import { CARD_BY_ID } from '@/content/cards';
import { PROPERTY_BY_ID } from '@/content/properties';
import { UPGRADE_BY_ID } from '@/content/upgrades';
import { WORKER_BY_ID } from '@/content/workers';
import { createRng } from '@/engine/rng';
import { emptyTurnEffects } from '@/engine/setup';
import type {
  GameEvent,
  GameState,
  PlayerId,
  Phase,
  PropertyId,
} from '@/types';

/**
 * Shared plumbing for every reducer: cloning, event emission, and the small
 * primitives that enforce the integrity rules (cash never negative, Heat inside
 * bounds and never below Notoriety, and so on).
 */

export function clone(state: GameState): GameState {
  return structuredClone(state);
}

export function emit(
  state: GameState,
  type: string,
  message: string,
  playerId: PlayerId | null = null,
  data?: Record<string, unknown>,
): void {
  const event: GameEvent = {
    id: state.nextEventId++,
    round: state.round,
    phase: state.phase,
    playerId,
    type,
    message,
  };
  if (data) event.data = data;
  state.log.push(event);
}

export function rngFor(state: GameState) {
  const rng = createRng(state.seed, state.rngCursor);
  return {
    rng,
    commit() {
      state.rngCursor = rng.cursor();
    },
  };
}

export function nextId(state: GameState, prefix: string): string {
  return `${prefix}${state.nextEntityId++}`;
}

// ---------------------------------------------------------------------------
// Cash
// ---------------------------------------------------------------------------

export function payClean(state: GameState, playerId: PlayerId, amount: number): boolean {
  const player = state.players[playerId];
  if (player.cleanCash < amount) return false;
  player.cleanCash -= amount;
  return true;
}

export function payDirty(state: GameState, playerId: PlayerId, amount: number): boolean {
  const player = state.players[playerId];
  if (player.dirtyCash < amount) return false;
  player.dirtyCash -= amount;
  return true;
}

export function gainClean(state: GameState, playerId: PlayerId, amount: number): void {
  state.players[playerId].cleanCash = Math.max(0, state.players[playerId].cleanCash + amount);
}

export function gainDirty(state: GameState, playerId: PlayerId, amount: number): void {
  state.players[playerId].dirtyCash = Math.max(0, state.players[playerId].dirtyCash + amount);
}

// ---------------------------------------------------------------------------
// Heat and Notoriety
// ---------------------------------------------------------------------------

export function addHeat(state: GameState, playerId: PlayerId, amount: number): void {
  const player = state.players[playerId];
  const next = player.heat + amount;
  player.heat = Math.min(BALANCE.heat.max, Math.max(player.notoriety, Math.max(BALANCE.heat.min, next)));
}

export function addPropertyHeat(state: GameState, propertyId: PropertyId, amount: number): void {
  const property = state.properties[propertyId];
  property.heat = Math.max(0, Math.min(BALANCE.heat.propertyHeatMax, property.heat + amount));
}

export function addNotoriety(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  reason: string,
): void {
  const player = state.players[playerId];
  const before = player.notoriety;
  player.notoriety = Math.max(
    BALANCE.notoriety.min,
    Math.min(BALANCE.notoriety.max, player.notoriety + amount),
  );
  if (player.notoriety !== before) {
    // Heat can never sit below Notoriety.
    if (player.heat < player.notoriety) player.heat = player.notoriety;
    emit(
      state,
      'notoriety',
      `${player.name} ${amount > 0 ? 'gains' : 'loses'} Notoriety (${before} → ${player.notoriety}): ${reason}`,
      playerId,
    );
  }
}

// ---------------------------------------------------------------------------
// Entity movement
// ---------------------------------------------------------------------------

export function detachWorker(state: GameState, workerId: string): void {
  for (const playerId of state.playerOrder) {
    const worker = state.players[playerId].workers.find((w) => w.id === workerId);
    if (!worker) continue;
    if (worker.propertyId !== null) {
      const property = state.properties[worker.propertyId];
      property.workerIds = property.workerIds.filter((id) => id !== workerId);
    }
    worker.propertyId = null;
    return;
  }
}

export function attachWorker(state: GameState, workerId: string, propertyId: PropertyId): void {
  detachWorker(state, workerId);
  for (const playerId of state.playerOrder) {
    const worker = state.players[playerId].workers.find((w) => w.id === workerId);
    if (!worker) continue;
    worker.propertyId = propertyId;
    state.properties[propertyId].workerIds.push(workerId);
    return;
  }
}

/** Returns a Worker to the supply — used by Raids and Vice Squad enforcement. */
export function removeWorker(state: GameState, workerId: string): void {
  for (const playerId of state.playerOrder) {
    const player = state.players[playerId];
    const worker = player.workers.find((w) => w.id === workerId);
    if (!worker) continue;
    detachWorker(state, workerId);
    player.workers = player.workers.filter((w) => w.id !== workerId);
    state.workerSupply[worker.profileId] = (state.workerSupply[worker.profileId] ?? 0) + 1;
    return;
  }
}

export function detachMamasan(state: GameState, mamasanId: string): void {
  for (const playerId of state.playerOrder) {
    const mamasan = state.players[playerId].mamasans.find((m) => m.id === mamasanId);
    if (!mamasan) continue;
    if (mamasan.propertyId !== null) {
      state.properties[mamasan.propertyId].mamasanId = null;
    }
    mamasan.propertyId = null;
    return;
  }
}

export function attachMamasan(state: GameState, mamasanId: string, propertyId: PropertyId): void {
  detachMamasan(state, mamasanId);
  for (const playerId of state.playerOrder) {
    const mamasan = state.players[playerId].mamasans.find((m) => m.id === mamasanId);
    if (!mamasan) continue;
    mamasan.propertyId = propertyId;
    state.properties[propertyId].mamasanId = mamasanId;
    return;
  }
}

export function closeProperty(state: GameState, propertyId: PropertyId, rounds: number): void {
  const property = state.properties[propertyId];
  const owner = property.ownerId;
  let effectiveRounds = rounds;
  if (owner) {
    const mamasan = property.mamasanId
      ? state.players[owner].mamasans.find((m) => m.id === property.mamasanId)
      : null;
    if (mamasan && mamasan.defId === 'napha') effectiveRounds = Math.max(1, effectiveRounds - 1);
  }
  property.closedUntilRound = state.round + effectiveRounds;
}

export function disableUpgrade(state: GameState, upgradeId: string): void {
  const upgrade = state.upgrades[upgradeId];
  if (upgrade) upgrade.disabled = true;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export function drawCard(state: GameState, playerId: PlayerId): string | null {
  if (state.deck.length === 0) reshuffleDiscard(state);
  const cardId = state.deck.shift();
  if (!cardId) return null;
  state.players[playerId].hand.push(cardId);
  return cardId;
}

export function reshuffleDiscard(state: GameState): void {
  if (state.discard.length === 0) return;
  const { rng, commit } = rngFor(state);
  state.deck = rng.shuffle(state.discard);
  state.discard = [];
  commit();
  emit(state, 'deck', 'The discard pile is reshuffled into the Night Deck.');
}

export function discardCard(state: GameState, playerId: PlayerId, cardId: string): void {
  const player = state.players[playerId];
  player.hand = player.hand.filter((id) => id !== cardId);
  state.discard.push(cardId);
}

export function cardDef(state: GameState, cardInstanceId: string) {
  const instance = state.cards[cardInstanceId];
  return instance ? CARD_BY_ID[instance.defId] : undefined;
}

export function enforceHandLimit(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  while (player.hand.length > BALANCE.cards.handLimit) {
    const { rng, commit } = rngFor(state);
    const index = rng.int(player.hand.length);
    commit();
    const cardId = player.hand[index];
    discardCard(state, playerId, cardId);
    emit(state, 'discard', `${player.name} discards down to the hand limit.`, playerId);
  }
}

// ---------------------------------------------------------------------------
// Turn bookkeeping
// ---------------------------------------------------------------------------

export function resetTurnState(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  player.actionsRemaining = BALANCE.turn.actionsPerTurn;
  player.cardPlayedThisTurn = false;
  player.stats.launderTiersUsedThisTurn = [];
  player.stats.freeWorkerMovesUsed = 0;
  player.stats.heatReductionActionsThisTurn = 0;
  player.turnEffects = emptyTurnEffects();
}

export function setPhase(state: GameState, phase: Phase): void {
  state.phase = phase;
}

export function upgradeName(defId: string): string {
  return UPGRADE_BY_ID[defId]?.name ?? defId;
}

export function workerName(profileId: string): string {
  return WORKER_BY_ID[profileId]?.name ?? profileId;
}

export function propertyName(propertyId: PropertyId): string {
  return PROPERTY_BY_ID[propertyId]?.name ?? `Property ${propertyId}`;
}
