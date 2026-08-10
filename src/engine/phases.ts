import { BALANCE } from '@/content/balance';
import { CARD_BY_ID, FINAL_RAID_CARD } from '@/content/cards';
import { DISTRICTS } from '@/content/districts';
import { POLICE_BY_ID } from '@/content/police';
import { PROPERTY_BY_ID } from '@/content/properties';
import { WORKER_BY_ID } from '@/content/workers';
import { checkNotorietyTriggers, computePlayerHeat } from '@/engine/calculations/heat';
import { assessRaid, raidConsequences, raidTarget } from '@/engine/calculations/raid';
import { realiseRevenue, computePotentialRevenue } from '@/engine/calculations/revenue';
import { computeWheel, spinWheel } from '@/engine/calculations/wheel';
import { extraPoliceMovement, upkeepWaived } from '@/engine/calculations/environment';
import { cleanWealthProgress, empireProgress, finalScores } from '@/engine/calculations/victory';
import {
  addHeat,
  addNotoriety,
  addPropertyHeat,
  clone,
  closeProperty,
  disableUpgrade,
  discardCard,
  drawCard,
  emit,
  gainClean,
  gainDirty,
  payClean,
  propertyName,
  removeWorker,
  resetTurnState,
  rngFor,
  setPhase,
} from '@/engine/core';
import { applyEnvironmentCard } from '@/engine/effects/environment';
import {
  activeUnregisteredWorkers,
  effectiveUpkeep,
  isOperating,
  ownedProperties,
  workersAt,
} from '@/engine/selectors';
import { hexDistance, hexNeighbours } from '@/utils/hex';
import type { GameState, PlayerId, UpkeepChoice, VictoryType } from '@/types';

/** Phase 1: Draw. */
export function runDrawPhase(input: GameState): GameState {
  const state = clone(input);
  if (state.phase !== 'draw' || state.gameOver) return input;

  const playerId = state.playerOrder[state.activePlayerIndex];
  const player = state.players[playerId];

  for (let i = 0; i < BALANCE.turn.cardsDrawnPerTurn; i++) {
    const cardId = drawCard(state, playerId);
    if (!cardId) break;

    const def = CARD_BY_ID[state.cards[cardId].defId];

    if (def.id === FINAL_RAID_CARD.id) {
      player.hand = player.hand.filter((id) => id !== cardId);
      state.discard.push(cardId);
      state.finalRaidTriggered = true;
      state.finalRaidTurnsRemaining = state.playerOrder.length;
      emit(
        state,
        'final_raid_drawn',
        `${player.name} draws The Final Raid. Every player completes one final Night.`,
        playerId,
      );
      continue;
    }

    if (def.category === 'environment') {
      player.hand = player.hand.filter((id) => id !== cardId);
      state.discard.push(cardId);
      emit(state, 'environment', `${player.name} draws ${def.name}: ${def.effect}`, playerId);
      applyEnvironmentCard(state, def.id);
    } else {
      emit(state, 'draw', `${player.name} draws a card.`, playerId);
    }
  }

  setPhase(state, 'scheme');
  return state;
}

/** Phase 2: Scheme — handled by the card module; this just skips it. */
export function skipScheme(input: GameState): GameState {
  const state = clone(input);
  if (state.phase !== 'scheme') return input;
  const playerId = state.playerOrder[state.activePlayerIndex];
  emit(state, 'scheme', `${state.players[playerId].name} holds their cards.`, playerId);
  setPhase(state, 'operate');
  return state;
}

/** Phase 3 -> 4: close out Operate and compute the Night. */
export function endOperate(input: GameState): GameState {
  const state = clone(input);
  if (state.phase !== 'operate') return input;

  const playerId = state.playerOrder[state.activePlayerIndex];
  const potential = computePotentialRevenue(state, playerId);
  const wheel = computeWheel(state, playerId);

  state.pendingNight = {
    playerId,
    potential,
    wheel,
    outcome: null,
    realisedClean: 0,
    realisedDirty: 0,
    realisedLines: [],
    consequences: [],
    spun: false,
  };

  setPhase(state, 'resolve');
  emit(
    state,
    'night_ready',
    `${state.players[playerId].name} opens for the Night. Potential: ${potential.clean} Clean / ${potential.dirty} Dirty.`,
    playerId,
  );
  return state;
}

/** Phase 4: spin the Night Wheel. The result comes from the seeded stream. */
export function spinNight(input: GameState): GameState {
  const state = clone(input);
  if (state.phase !== 'resolve' || !state.pendingNight || state.pendingNight.spun) return input;

  const pending = state.pendingNight;
  const playerId = pending.playerId;
  const player = state.players[playerId];

  const { rng, commit } = rngFor(state);
  const roll = rng.next();
  commit();

  let outcome = spinWheel(pending.wheel.probabilities, roll);

  // Public Holiday lets each player guarantee one Big Night.
  if (player.turnEffects.guaranteedBigProperty !== null) outcome = 'big';

  pending.outcome = outcome;
  pending.spun = true;

  const realised = realiseRevenue(state, playerId, outcome);
  pending.realisedClean = realised.clean;
  pending.realisedDirty = realised.dirty;
  pending.realisedLines = realised.lines;

  emit(
    state,
    'spin',
    `${player.name} spins: ${outcomeLabel(outcome)}.`,
    playerId,
    { outcome, roll },
  );

  return state;
}

function outcomeLabel(outcome: string): string {
  return (
    { big: 'Big Night', normal: 'Normal Night', quiet: 'Quiet Night', trouble: 'Trouble', raid: 'Raid' }[
      outcome
    ] ?? outcome
  );
}

/** Applies the spun outcome: revenue, Trouble and Raid consequences. */
export function applyNight(input: GameState): GameState {
  const state = clone(input);
  const pending = state.pendingNight;
  if (state.phase !== 'resolve' || !pending || !pending.spun) return input;

  const playerId = pending.playerId;
  const player = state.players[playerId];
  const outcome = pending.outcome!;

  // --- Raid resolves before revenue is collected ---------------------------
  if (outcome === 'raid') {
    if (player.turnEffects.cancelNextRaid) {
      player.turnEffects.cancelNextRaid = false;
      pending.consequences.push('A Tip-Off cancelled the Raid.');
      emit(state, 'raid', `${player.name} was tipped off — the Raid finds nothing.`, playerId);
    } else {
      resolveRaid(state, playerId);
    }
  }

  if (outcome === 'trouble') {
    applyTrouble(state, playerId);
  }

  // --- Collect revenue -----------------------------------------------------
  gainClean(state, playerId, pending.realisedClean);
  gainDirty(state, playerId, pending.realisedDirty);

  if (pending.realisedClean || pending.realisedDirty) {
    emit(
      state,
      'revenue',
      `${player.name} collects ${pending.realisedClean} Clean and ${pending.realisedDirty} Dirty.`,
      playerId,
    );
  }

  // --- Big Night bookkeeping ----------------------------------------------
  if (outcome === 'big') {
    player.stats.bigNightsThisRound += 1;
    if (
      player.stats.bigNightsThisRound === 1 &&
      DISTRICTS.some(
        (d) =>
          d.id === 'waterfront' &&
          d.properties.filter((id) => state.properties[id].ownerId === playerId).length >=
            BALANCE.district.controlThreshold,
      )
    ) {
      gainClean(state, playerId, 4); // Waterfront control: +$100k Clean
      emit(state, 'district_bonus', `Waterfront control adds $100k Clean.`, playerId);
    }
  }

  // Wilai removes Property Heat after a Normal Night.
  if (outcome === 'normal') {
    for (const property of ownedProperties(state, playerId)) {
      if (!property.mamasanId) continue;
      const mamasan = player.mamasans.find((m) => m.id === property.mamasanId);
      if (mamasan?.defId === 'wilai') addPropertyHeat(state, property.id, -1);
    }
  }

  // --- Underground Star Notoriety trigger ----------------------------------
  if (outcome !== 'raid') {
    for (const property of ownedProperties(state, playerId)) {
      if (!isOperating(state, property)) continue;
      for (const worker of workersAt(state, property)) {
        if (worker.conditions.unavailable) continue;
        worker.producingNights += 1;
        if (
          WORKER_BY_ID[worker.profileId].tag === 'notoriety_after_three' &&
          worker.producingNights === BALANCE.notoriety.undergroundStarProducingNights
        ) {
          addNotoriety(state, playerId, 1, 'An Underground Star has become well known');
        }
      }
    }
  }

  setPhase(state, 'police');
  return state;
}

function applyTrouble(state: GameState, playerId: PlayerId): void {
  const { rng, commit } = rngFor(state);
  const properties = ownedProperties(state, playerId).filter((p) => isOperating(state, p));
  if (properties.length === 0) {
    commit();
    return;
  }
  const property = rng.pick(properties);
  commit();

  addPropertyHeat(state, property.id, 1);
  addHeat(state, playerId, 1);
  state.pendingNight?.consequences.push(
    `Trouble at ${propertyName(property.id)}: +1 Property Heat, +1 Heat.`,
  );
  emit(state, 'trouble', `Trouble at ${propertyName(property.id)}.`, playerId);
}

export function resolveRaid(state: GameState, playerId: PlayerId, cityWide = false): void {
  const player = state.players[playerId];
  const targets = cityWide
    ? ownedProperties(state, playerId).filter((p) => isOperating(state, p))
    : [raidTarget(state, playerId)].filter(Boolean);

  if (targets.length === 0) {
    emit(state, 'raid', `${player.name} has nothing open to raid.`, playerId);
    return;
  }

  for (const property of targets) {
    if (!property) continue;
    const assessment = assessRaid(state, playerId, property, player.turnEffects.raidSeverityModifier);
    const consequences = raidConsequences(state, playerId, assessment);

    const notes: string[] = [`${assessment.label} Raid at ${assessment.propertyName}.`];

    if (consequences.dirtySeized > 0) {
      const protectedDirty = player.turnEffects.protectedDirty;
      const seized = Math.max(0, consequences.dirtySeized - protectedDirty);
      player.dirtyCash = Math.max(0, player.dirtyCash - seized);
      if (seized > 0) notes.push(`${seized} Dirty Cash seized.`);
    }

    for (let i = 0; i < consequences.workersRemoved; i++) {
      const workers = workersAt(state, property).sort((a, b) => a.stability - b.stability);
      const victim = workers[0];
      if (!victim) break;
      removeWorker(state, victim.id);
      notes.push(`A ${WORKER_BY_ID[victim.profileId].name} is removed.`);
    }

    for (let i = 0; i < consequences.upgradesDisabled; i++) {
      const upgradeId = property.upgradeIds.find((id) => !state.upgrades[id].disabled);
      if (!upgradeId) break;
      disableUpgrade(state, upgradeId);
      notes.push('An Upgrade is disabled.');
    }

    if (consequences.propertiesClosed > 0) {
      closeProperty(state, property.id, BALANCE.property.closureRounds);
      notes.push(`${assessment.propertyName} is closed.`);
    }

    if (consequences.heatAdded > 0) addHeat(state, playerId, consequences.heatAdded);
    if (consequences.notorietyAdded > 0) {
      addNotoriety(state, playerId, consequences.notorietyAdded, 'Suffered a Major Raid');
    }

    const message = notes.join(' ');
    state.pendingNight?.consequences.push(message);
    emit(state, 'raid', message, playerId, { level: assessment.level });
  }

  player.turnEffects.raidSeverityModifier = 0;
}

/** Phase 5: Police. */
export function runPolicePhase(input: GameState): GameState {
  const state = clone(input);
  if (state.phase !== 'police') return input;

  const playerId = state.playerOrder[state.activePlayerIndex];

  // One unit moves per turn, cycling through the three in order.
  const unitIndex = state.turnCounter % state.police.length;
  const unit = state.police[unitIndex];
  const def = POLICE_BY_ID[unit.id];
  const movement = def.movement + unit.bonusMovement + extraPoliceMovement(state);

  const { rng, commit } = rngFor(state);

  for (let step = 0; step < movement; step++) {
    const options = hexNeighbours(unit.hex).filter(onBoard);
    if (options.length === 0) break;

    // Police drift toward the hottest Property they can reach.
    let best = options[0];
    let bestScore = -Infinity;
    for (const option of options) {
      const property = propertyAt(state, option.q, option.r);
      const score = property ? propertyHeatScore(state, property.id) : -1;
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }

    // If nothing nearby is interesting, wander deterministically.
    if (bestScore <= 0) best = rng.pick(options);
    unit.hex = best;
  }
  commit();

  unit.bonusMovement = 0;

  emit(
    state,
    'police_move',
    `${def.name} moves to hex ${unit.hex.q},${unit.hex.r}.`,
    null,
    { unit: unit.id, hex: unit.hex },
  );

  // Proximity raises Property Heat.
  for (const property of Object.values(state.properties)) {
    if (property.ownerId === null) continue;
    const distance = hexDistance(unit.hex, PROPERTY_BY_ID[property.id].hex);
    if (distance === 0) addPropertyHeat(state, property.id, 2);
    else if (distance === 1) addPropertyHeat(state, property.id, 1);
  }

  // Vice Squad enforcement against Unregistered Workers.
  if (unit.id === 'vice_squad') {
    const property = propertyAt(state, unit.hex.q, unit.hex.r);
    if (property && property.ownerId && isOperating(state, property)) {
      const unregistered = workersAt(state, property).filter((w) => w.status === 'unregistered');
      if (unregistered.length > 0) {
        const victim = unregistered.sort((a, b) => a.stability - b.stability)[0];
        victim.conditions.unavailable = 1;
        emit(
          state,
          'police_enforce',
          `Vice Squad detains a ${WORKER_BY_ID[victim.profileId].name} at ${propertyName(property.id)} for the round.`,
          property.ownerId,
        );
      }
    }
  }

  // Financial Crimes Unit skims Dirty Cash from whoever it is standing on.
  if (unit.id === 'financial_crimes') {
    const property = propertyAt(state, unit.hex.q, unit.hex.r);
    if (property?.ownerId) {
      const owner = state.players[property.ownerId];
      if (!owner.turnEffects.immuneToFinancialCrimes && owner.dirtyCash > 0) {
        const taken = Math.min(owner.dirtyCash, 4); // $100k
        owner.dirtyCash -= taken;
        emit(
          state,
          'police_enforce',
          `The Financial Crimes Unit seizes ${taken} Dirty Cash from ${owner.name}.`,
          property.ownerId,
        );
      }
    }
  }

  void playerId;
  setPhase(state, 'close');
  return state;
}

function onBoard(hex: { q: number; r: number }): boolean {
  return hex.q >= 0 && hex.q <= 5 && hex.r >= 0 && hex.r <= 3;
}

function propertyAt(state: GameState, q: number, r: number) {
  const def = Object.values(PROPERTY_BY_ID).find((p) => p.hex.q === q && p.hex.r === r);
  return def ? state.properties[def.id] : null;
}

function propertyHeatScore(state: GameState, propertyId: number): number {
  const property = state.properties[propertyId];
  if (property.ownerId === null) return -1;
  return property.heat + PROPERTY_BY_ID[propertyId].baseHeat + (property.licensed ? 0 : 2);
}

/** Phase 6: Close. May pause on an unpaid-upkeep decision. */
export function runClosePhase(input: GameState): GameState {
  let state = clone(input);
  if (state.phase !== 'close') return input;

  const playerId = state.playerOrder[state.activePlayerIndex];
  const player = state.players[playerId];

  // --- 1 & 2: upkeep and Empire Overhead ----------------------------------
  if (!upkeepWaived(state)) {
    const owned = ownedProperties(state, playerId);
    const propertyUpkeep = owned.reduce((sum, p) => sum + effectiveUpkeep(state, p), 0);
    const overhead = empireOverhead(owned.length);
    const total = propertyUpkeep + overhead;

    if (total > 0) {
      const paid = Math.min(player.cleanCash, total);
      payClean(state, playerId, paid);
      const shortfall = total - paid;

      emit(
        state,
        'upkeep',
        `${player.name} pays ${paid} upkeep (Properties ${propertyUpkeep}, Empire Overhead ${overhead}).`,
        playerId,
      );

      if (shortfall > 0) {
        const chunks = Math.ceil(shortfall / BALANCE.upkeep.unpaidChunk);
        state.pendingUpkeep = { playerId, remaining: chunks };
        emit(
          state,
          'upkeep_unpaid',
          `${player.name} cannot cover ${shortfall} of upkeep and must choose ${chunks} consequence(s).`,
          playerId,
        );
        return state; // wait for the player's choices
      }
    }
  } else {
    emit(state, 'upkeep', 'Rental Slump: upkeep is waived this round.', playerId);
  }

  state = finishClose(state);
  return state;
}

export function empireOverhead(propertyCount: number): number {
  const table = BALANCE.upkeep.overheadByPropertyCount;
  if (propertyCount < table.length) return table[propertyCount];
  const extra = propertyCount - (table.length - 1);
  return table[table.length - 1] + extra * BALANCE.upkeep.overheadPerExtraProperty;
}

/** Resolves one unpaid-upkeep consequence chosen by the player. */
export function resolveUpkeepChoice(input: GameState, choice: UpkeepChoice): GameState {
  const state = clone(input);
  const pending = state.pendingUpkeep;
  if (!pending) return input;

  const playerId = pending.playerId;
  const player = state.players[playerId];

  switch (choice) {
    case 'heat':
      addHeat(state, playerId, 1);
      emit(state, 'upkeep_choice', `${player.name} takes 1 Heat for unpaid upkeep.`, playerId);
      break;

    case 'disable_upgrade': {
      const property = ownedProperties(state, playerId).find((p) =>
        p.upgradeIds.some((id) => !state.upgrades[id].disabled),
      );
      const upgradeId = property?.upgradeIds.find((id) => !state.upgrades[id].disabled);
      if (upgradeId) {
        disableUpgrade(state, upgradeId);
        emit(state, 'upkeep_choice', `${player.name} disables an Upgrade.`, playerId);
      } else {
        addHeat(state, playerId, 1);
        emit(
          state,
          'upkeep_choice',
          `${player.name} has no Upgrade to disable and takes 1 Heat instead.`,
          playerId,
        );
      }
      break;
    }

    case 'close_property': {
      const property = ownedProperties(state, playerId).find((p) => isOperating(state, p));
      if (property) {
        closeProperty(state, property.id, BALANCE.property.closureRounds);
        emit(
          state,
          'upkeep_choice',
          `${player.name} closes ${propertyName(property.id)} until next round.`,
          playerId,
        );
      } else {
        addHeat(state, playerId, 1);
        emit(state, 'upkeep_choice', `${player.name} has nothing to close and takes 1 Heat.`, playerId);
      }
      break;
    }

    case 'emergency_finance':
      gainDirty(state, playerId, BALANCE.upkeep.emergencyFinanceDirty);
      addNotoriety(state, playerId, 1, 'Took emergency finance');
      emit(
        state,
        'upkeep_choice',
        `${player.name} takes ${BALANCE.upkeep.emergencyFinanceDirty} Dirty emergency finance and gains 1 Notoriety.`,
        playerId,
      );
      break;
  }

  pending.remaining -= 1;
  if (pending.remaining <= 0) {
    state.pendingUpkeep = null;
    return finishClose(state);
  }

  return state;
}

/** Steps 4-7 of the Close phase, after upkeep is settled. */
function finishClose(input: GameState): GameState {
  const state = clone(input);
  const playerId = state.playerOrder[state.activePlayerIndex];
  const player = state.players[playerId];

  // --- 4: update Heat and Notoriety ---------------------------------------
  const heat = computePlayerHeat(state, playerId, player.heat);
  player.heat = heat.final;

  if (player.heat >= BALANCE.notoriety.highHeatThreshold) {
    player.stats.consecutiveHighHeatTurns += 1;
  } else {
    player.stats.consecutiveHighHeatTurns = 0;
  }

  if (activeUnregisteredWorkers(state, playerId) >= BALANCE.notoriety.unregisteredWorkerThreshold) {
    player.stats.consecutiveHighUnregisteredRounds += 1;
  } else {
    player.stats.consecutiveHighUnregisteredRounds = 0;
  }

  for (const trigger of checkNotorietyTriggers(state, playerId)) {
    addNotoriety(state, playerId, 1, trigger.reason);
    player.stats.consecutiveHighHeatTurns = 0;
    player.stats.consecutiveHighUnregisteredRounds = 0;
    player.stats.aggressiveCardsThisRound = 0;
  }

  // --- 5: remove expired effects ------------------------------------------
  expireEffects(state);

  // --- 6 & 7: victory check, then pass play -------------------------------
  return advanceTurn(state);
}

function expireEffects(state: GameState): void {
  for (const property of Object.values(state.properties)) {
    property.modifiers = property.modifiers.filter((m) => m.expiresAtRound > state.round);
    if (property.closedUntilRound !== null && property.closedUntilRound <= state.round) {
      property.closedUntilRound = null;
    }
  }

  for (const playerId of state.playerOrder) {
    for (const worker of state.players[playerId].workers) {
      for (const key of ['hot', 'protected', 'unavailable', 'disrupted'] as const) {
        const value = worker.conditions[key];
        if (value !== undefined) {
          const next = value - 1;
          if (next <= 0) delete worker.conditions[key];
          else worker.conditions[key] = next;
        }
      }
    }
  }
}

/** Ends the current turn and hands play on, resolving end-of-game states. */
export function advanceTurn(input: GameState): GameState {
  const state = clone(input);
  const finishedPlayerId = state.playerOrder[state.activePlayerIndex];

  // A declaration gives every opponent one final turn.
  if (state.declaration) {
    state.declaration.pendingResponders = state.declaration.pendingResponders.filter(
      (id) => id !== finishedPlayerId,
    );
  }

  // The Final Raid countdown ticks once per completed Night.
  if (state.finalRaidTriggered && !state.finalRaidResolved) {
    state.finalRaidTurnsRemaining -= 1;
    if (state.finalRaidTurnsRemaining <= 0) {
      return resolveFinalRaid(state);
    }
  }

  state.turnCounter += 1;
  state.activePlayerIndex = (state.activePlayerIndex + 1) % state.playerOrder.length;
  const nextPlayerId = state.playerOrder[state.activePlayerIndex];

  // A new round begins when play returns to the head of the order.
  if (state.activePlayerIndex === 0) {
    state.round += 1;
    startRound(state);
  }

  // If a declaration has survived every response turn, the declarer wins.
  if (state.declaration && state.declaration.pendingResponders.length === 0) {
    const declarerId = state.declaration.playerId;
    if (nextPlayerId === declarerId || state.declaration.pendingResponders.length === 0) {
      const stillValid =
        state.declaration.type === 'clean_wealth'
          ? cleanWealthProgress(state, declarerId).eligible
          : empireProgress(state, declarerId).eligible;

      if (stillValid) {
        state.gameOver = true;
        state.winnerId = declarerId;
        state.victoryType = state.declaration.type;
        state.finalScores = finalScores(state);
        emit(
          state,
          'victory',
          `${state.players[declarerId].name} holds their claim and wins a ${
            state.declaration.type === 'clean_wealth' ? 'Clean Wealth' : 'Empire'
          } Victory.`,
          declarerId,
        );
        return state;
      }

      emit(
        state,
        'declaration_failed',
        `${state.players[declarerId].name} no longer meets the conditions. The claim fails.`,
        declarerId,
      );
      state.declaration = null;
    }
  }

  // Safety valve so simulations always terminate.
  if (state.round > BALANCE.simulation.maxRounds) {
    return resolveFinalRaid(state);
  }

  resetTurnState(state, nextPlayerId);
  setPhase(state, 'draw');
  state.pendingNight = null;
  emit(state, 'turn', `${state.players[nextPlayerId].name}'s Night begins.`, nextPlayerId);

  return state;
}

function startRound(state: GameState): void {
  // Environment conditions that last "this round" expire here.
  state.environment = state.environment.filter(
    (env) => env.expiresAtRound === null || env.expiresAtRound > state.round,
  );

  for (const playerId of state.playerOrder) {
    const player = state.players[playerId];
    player.stats.aggressiveCardsThisRound = 0;
    player.stats.bigNightsThisRound = 0;
    player.stats.recruitsThisRound = 0;
  }

  emit(state, 'round', `Round ${state.round} begins.`);
}

/** The Final Raid: one city-wide Raid, then surviving Clean Net Worth decides it. */
export function resolveFinalRaid(input: GameState): GameState {
  const state = clone(input);
  if (state.finalRaidResolved) return state;

  emit(state, 'final_raid', 'The Final Raid sweeps the entire mile.');

  for (const playerId of state.playerOrder) {
    resolveRaid(state, playerId, true);
  }

  state.finalRaidResolved = true;
  state.gameOver = true;
  const scores = finalScores(state);
  state.finalScores = scores;

  const winnerId = state.playerOrder.reduce(
    (best, id) => (scores[id] > scores[best] ? id : best),
    state.playerOrder[0],
  );
  state.winnerId = winnerId;
  state.victoryType = 'final_raid';

  emit(
    state,
    'victory',
    `${state.players[winnerId].name} survives the Final Raid with the highest Clean Net Worth (${scores[winnerId]}).`,
    winnerId,
  );

  return state;
}

/** Declaring a victory at the end of your turn. */
export function declareVictory(
  input: GameState,
  playerId: PlayerId,
  type: VictoryType,
): GameState {
  const state = clone(input);
  if (state.declaration) return input;

  const eligible =
    type === 'clean_wealth'
      ? cleanWealthProgress(state, playerId).eligible
      : empireProgress(state, playerId).eligible;

  if (!eligible) return input;

  state.declaration = {
    playerId,
    type,
    declaredAtRound: state.round,
    pendingResponders: state.playerOrder.filter((id) => id !== playerId),
  };

  emit(
    state,
    'declaration',
    `${state.players[playerId].name} declares a ${
      type === 'clean_wealth' ? 'Clean Wealth' : 'Empire'
    } Victory. Every opponent gets one final turn.`,
    playerId,
  );

  return state;
}

export { discardCard };
