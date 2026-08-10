import { BALANCE } from '@/content/balance';
import { CARD_BY_ID, AGGRESSIVE_CATEGORIES } from '@/content/cards';
import { DISTRICTS } from '@/content/districts';
import { PROPERTY_BY_ID } from '@/content/properties';
import { WORKER_BY_ID } from '@/content/workers';
import {
  addHeat,
  addNotoriety,
  addPropertyHeat,
  attachWorker,
  clone,
  discardCard,
  drawCard,
  emit,
  gainClean,
  payClean,
  propertyName,
  rngFor,
} from '@/engine/core';
import {
  activeWorkersAt,
  hasMamasanTag,
  isOperating,
  ownedProperties,
  upgradesAt,
  workersAt,
} from '@/engine/selectors';
import { hexDistance, hexNeighbours } from '@/utils/hex';
import type {
  CardInstanceId,
  DistrictId,
  GameState,
  PlayerId,
  PoliceUnitId,
  PropertyId,
  PropertyModifier,
} from '@/types';

export interface CardTarget {
  propertyId?: PropertyId;
  workerId?: string;
  playerId?: PlayerId;
  district?: DistrictId;
  policeId?: PoliceUnitId;
  /** For cards that offer the player a choice between two effects. */
  choice?: string;
}

export interface PlayCardResult {
  state: GameState;
  ok: boolean;
  error?: string;
}

/** Which reaction cards can answer a given in-flight effect. */
const REACTIONS: Record<string, string[]> = {
  poach: ['staff_loyalty', 'counteroffer'],
  card_play: ['fake_booking'],
  noise_or_licence: ['community_support'],
  raid: ['tip_off', 'good_lawyer'],
};

export function canPlayCard(
  state: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
): { ok: boolean; reason?: string } {
  if (state.gameOver) return { ok: false, reason: 'The game is over.' };

  const player = state.players[playerId];
  if (!player.hand.includes(cardInstanceId)) {
    return { ok: false, reason: 'That card is not in your hand.' };
  }

  const def = CARD_BY_ID[state.cards[cardInstanceId].defId];
  if (!def) return { ok: false, reason: 'Unknown card.' };

  if (def.timing === 'reaction') {
    if (!state.pendingReaction || state.pendingReaction.responderId !== playerId) {
      return { ok: false, reason: 'Reaction cards can only be played into a reaction window.' };
    }
    const allowed = REACTIONS[state.pendingReaction.kind] ?? [];
    if (!allowed.includes(def.id)) {
      return { ok: false, reason: `${def.name} does not answer this effect.` };
    }
    return { ok: true };
  }

  if (state.phase !== 'scheme') {
    return { ok: false, reason: 'Cards are played during the Scheme phase.' };
  }
  if (state.playerOrder[state.activePlayerIndex] !== playerId) {
    return { ok: false, reason: 'It is not your turn.' };
  }
  if (player.cardPlayedThisTurn) {
    return { ok: false, reason: 'You have already played a card this turn.' };
  }

  if (def.target === 'own_property' && ownedProperties(state, playerId).length === 0) {
    return { ok: false, reason: 'You own no Property to target.' };
  }
  if (def.target === 'rival_property' && rivalProperties(state, playerId).length === 0) {
    return { ok: false, reason: 'No rival Property can be targeted.' };
  }
  if (def.target === 'rival_worker' && rivalWorkers(state, playerId).length === 0) {
    return { ok: false, reason: 'No rival Worker can be targeted.' };
  }

  return { ok: true };
}

export function rivalProperties(state: GameState, playerId: PlayerId) {
  return Object.values(state.properties).filter(
    (p) =>
      p.ownerId !== null &&
      p.ownerId !== playerId &&
      !p.modifiers.some((m) => m.immuneToDirtyTricks),
  );
}

export function rivalWorkers(state: GameState, playerId: PlayerId) {
  const out: { workerId: string; ownerId: PlayerId; propertyId: PropertyId | null }[] = [];
  for (const id of state.playerOrder) {
    if (id === playerId) continue;
    for (const worker of state.players[id].workers) {
      if (worker.conditions.protected) continue;
      out.push({ workerId: worker.id, ownerId: id, propertyId: worker.propertyId });
    }
  }
  return out;
}

/**
 * Plays a card. Some cards park a reaction window instead of resolving
 * immediately; the caller then routes to `resolveReaction`.
 */
export function playCard(
  input: GameState,
  playerId: PlayerId,
  cardInstanceId: CardInstanceId,
  target: CardTarget = {},
): PlayCardResult {
  const check = canPlayCard(input, playerId, cardInstanceId);
  if (!check.ok) return { state: input, ok: false, error: check.reason };

  const state = clone(input);
  const def = CARD_BY_ID[state.cards[cardInstanceId].defId];
  const player = state.players[playerId];

  discardCard(state, playerId, cardInstanceId);
  if (def.timing !== 'reaction') player.cardPlayedThisTurn = true;

  if (AGGRESSIVE_CATEGORIES.has(def.category)) {
    player.stats.aggressiveCardsThisRound += 1;
  }

  emit(state, 'card', `${player.name} plays ${def.name}.`, playerId, { cardId: def.id });

  applyCardEffect(state, playerId, def.id, target);

  if (state.phase === 'scheme' && !state.pendingReaction) {
    state.phase = 'operate';
  }

  return { state, ok: true };
}

function addModifier(
  state: GameState,
  propertyId: PropertyId,
  modifier: Omit<PropertyModifier, 'id'>,
): void {
  state.properties[propertyId].modifiers.push({
    id: `mod-${state.nextEventId}-${propertyId}`,
    ...modifier,
  });
}

/** The effect table. Every card in the deck resolves through here. */
export function applyCardEffect(
  state: GameState,
  playerId: PlayerId,
  defId: string,
  target: CardTarget,
): void {
  const player = state.players[playerId];
  const thisRound = state.round + 1;

  switch (defId) {
    // ---------------------------------------------------------------- OPPORTUNITY
    case 'bachelor_party': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      addModifier(state, id, { source: 'Bachelor Party x2', multiplier: 200, expiresAtRound: thisRound });
      addPropertyHeat(state, id, 2);
      break;
    }

    case 'high_roller': {
      const workerId = target.workerId ?? player.workers.find((w) => w.propertyId !== null)?.id;
      const worker = player.workers.find((w) => w.id === workerId);
      if (worker) worker.conditions.hot = 1;
      break;
    }

    case 'payday_weekend':
      for (const property of ownedProperties(state, playerId)) {
        addModifier(state, property.id, {
          source: 'Payday Weekend +20%',
          multiplier: 120,
          expiresAtRound: thisRound,
        });
      }
      break;

    case 'packed_house': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      if (target.choice === 'cool') {
        addPropertyHeat(state, id, -1);
      } else {
        addModifier(state, id, {
          source: 'Packed House +50%',
          multiplier: 150,
          expiresAtRound: thisRound,
        });
        addHeat(state, playerId, 2);
      }
      break;
    }

    case 'tourist_bus': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      addModifier(state, id, { source: 'Tourist Bus +2 Capacity', capacityDelta: 2, expiresAtRound: thisRound });
      break;
    }

    case 'celebrity_visit': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      addModifier(state, id, {
        source: 'Celebrity Visit',
        multiplier: 100,
        expiresAtRound: thisRound,
      });
      gainClean(state, playerId, 10); // $250k, paid unless the Night is a Raid
      emit(state, 'card', 'Celebrity Visit brings $250k Clean (forfeit on a Raid).', playerId);
      break;
    }

    case 'corporate_function': {
      const vetted = player.workers.filter((w) => w.status === 'vetted' && w.propertyId).slice(0, 3);
      for (const worker of vetted) worker.conditions.hot = 1;
      break;
    }

    case 'festival_crowd': {
      const district = target.district ?? DISTRICTS[0].id;
      for (const id of DISTRICTS.find((d) => d.id === district)!.properties) {
        if (state.properties[id].ownerId === playerId) {
          addModifier(state, id, {
            source: 'Festival Crowd +25%',
            multiplier: 125,
            expiresAtRound: thisRound,
          });
        }
      }
      break;
    }

    case 'cash_buyer':
      player.turnEffects.propertyDiscount += 4; // $100k
      break;

    case 'recruitment_drive':
      player.turnEffects.recruitTwoWithOneAction = true;
      break;

    case 'renovation_grant':
      player.turnEffects.upgradeDiscount += 4;
      break;

    case 'fresh_licence':
      player.turnEffects.licenceDiscount += 4;
      addHeat(state, playerId, -1);
      break;

    case 'loyal_customers': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      addModifier(state, id, {
        source: 'Loyal Customers',
        treatNormalAsBig: true,
        expiresAtRound: thisRound,
      });
      break;
    }

    case 'private_booking': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      addModifier(state, id, {
        source: 'Private Booking',
        guaranteeAtLeastNormal: true,
        expiresAtRound: thisRound,
      });
      break;
    }

    case 'new_management':
      player.turnEffects.freeMamasanAction = true;
      break;

    case 'word_of_mouth': {
      drawCard(state, playerId);
      drawCard(state, playerId);
      const { rng, commit } = rngFor(state);
      if (player.hand.length > 0) {
        const index = rng.int(player.hand.length);
        discardCard(state, playerId, player.hand[index]);
      }
      commit();
      break;
    }

    // ---------------------------------------------------------------- DIRTY TRICK
    case 'anonymous_tip': {
      const unit = state.police.find((p) => p.id === (target.policeId ?? 'vice_squad'));
      const destination = target.propertyId ? PROPERTY_BY_ID[target.propertyId].hex : null;
      if (unit && destination) {
        for (let step = 0; step < 2; step++) {
          const options = hexNeighbours(unit.hex).filter(
            (h) => h.q >= 0 && h.q <= 5 && h.r >= 0 && h.r <= 3,
          );
          if (options.length === 0) break;
          options.sort((a, b) => hexDistance(a, destination) - hexDistance(b, destination));
          unit.hex = options[0];
        }
        emit(state, 'card', `Police redirected toward ${propertyName(target.propertyId!)}.`, playerId);
      }
      break;
    }

    case 'better_offer': {
      const victimId = target.workerId;
      if (!victimId) return;
      const owner = ownerOfWorker(state, victimId);
      if (!owner) return;
      openReaction(state, owner, 'poach', `${player.name} is trying to poach one of your Workers.`, {
        attackerId: playerId,
        workerId: victimId,
      });
      break;
    }

    case 'noise_complaint': {
      const id = target.propertyId;
      if (!id) return;
      const owner = state.properties[id].ownerId;
      if (!owner) return;
      openReaction(
        state,
        owner,
        'noise_or_licence',
        `${player.name} filed a Noise Complaint against ${propertyName(id)}.`,
        { propertyId: id, effect: 'noise_complaint' },
      );
      break;
    }

    case 'licence_challenge': {
      const id = target.propertyId;
      if (!id) return;
      const owner = state.properties[id].ownerId;
      if (!owner) return;
      openReaction(
        state,
        owner,
        'noise_or_licence',
        `${player.name} challenged the licence at ${propertyName(id)}.`,
        { propertyId: id, effect: 'licence_challenge' },
      );
      break;
    }

    case 'new_boyfriend': {
      const worker = findAnyWorker(state, target.workerId);
      if (worker) worker.conditions.unavailable = 1;
      break;
    }

    case 'bad_review': {
      const id = target.propertyId;
      if (!id) return;
      addModifier(state, id, { source: 'Bad Review -25%', multiplier: 75, expiresAtRound: thisRound });
      break;
    }

    case 'supplier_problem': {
      const id = target.propertyId;
      if (!id) return;
      const revenueUpgrade = upgradesAt(state, state.properties[id]).find(
        (u) => !u.instance.disabled && u.def.category === 'revenue',
      );
      if (revenueUpgrade) state.upgrades[revenueUpgrade.instance.id].disabled = true;
      break;
    }

    case 'sabotaged_renovation': {
      const id = target.propertyId;
      if (!id) return;
      const upgrade = upgradesAt(state, state.properties[id]).find((u) => !u.instance.disabled);
      if (upgrade) state.upgrades[upgrade.instance.id].disabled = true;
      break;
    }

    case 'street_blockade': {
      const district = target.district ?? DISTRICTS[0].id;
      state.environment.push({
        id: `env-${state.nextEventId}`,
        defId: 'street_blockade',
        expiresAtRound: thisRound,
        data: { district },
      });
      break;
    }

    case 'rival_promotion': {
      const id = target.propertyId;
      if (!id) return;
      addModifier(state, id, {
        source: 'Rival Promotion',
        multiplier: 80,
        expiresAtRound: thisRound,
      });
      gainClean(state, playerId, 4); // $100k transferred
      break;
    }

    case 'inside_information': {
      const victimId = target.playerId;
      if (!victimId) return;
      const victim = state.players[victimId];
      if (victim.hand.length === 0) return;
      const { rng, commit } = rngFor(state);
      const index = rng.int(victim.hand.length);
      commit();
      discardCard(state, victimId, victim.hand[index]);
      emit(state, 'card', `${victim.name} is forced to discard a card.`, victimId);
      break;
    }

    case 'staff_walkout': {
      const id = target.propertyId;
      if (!id) return;
      const workers = workersAt(state, state.properties[id]).slice(0, 2);
      for (const worker of workers) worker.conditions.disrupted = 1;
      break;
    }

    case 'protection_demand': {
      const victimId = target.playerId;
      if (!victimId) return;
      const victim = state.players[victimId];
      if (victim.cleanCash >= BALANCE.cards.protectionDemandCost) {
        payClean(state, victimId, BALANCE.cards.protectionDemandCost);
        gainClean(state, playerId, BALANCE.cards.protectionDemandCost);
        emit(state, 'card', `${victim.name} pays the protection demand.`, victimId);
      } else {
        addHeat(state, victimId, BALANCE.cards.protectionDemandHeat);
        emit(state, 'card', `${victim.name} cannot pay and takes 2 Heat.`, victimId);
      }
      break;
    }

    case 'territorial_pressure': {
      const victimId = target.playerId;
      const district = target.district ?? DISTRICTS[0].id;
      if (!victimId) return;
      const count = DISTRICTS.find((d) => d.id === district)!.properties.filter(
        (id) => state.properties[id].ownerId === victimId,
      ).length;
      const charge = count * BALANCE.cards.territorialPressurePerProperty;
      const paid = Math.min(state.players[victimId].cleanCash, charge);
      payClean(state, victimId, paid);
      gainClean(state, playerId, paid);
      break;
    }

    case 'financial_leak': {
      for (const id of state.playerOrder) {
        if (state.players[id].dirtyCash >= 40) {
          // $1m
          addNotoriety(state, id, 1, 'A financial leak exposed their Dirty Cash');
        }
      }
      break;
    }

    // ---------------------------------------------------------------- PROTECTION
    case 'trusted_doorman': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      addModifier(state, id, {
        source: 'Trusted Doorman',
        immuneToDirtyTricks: true,
        expiresAtRound: thisRound,
      });
      break;
    }

    case 'friends_downtown':
      addHeat(state, playerId, -3);
      break;

    case 'emergency_closure': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      state.properties[id].closedUntilRound = state.round + 1;
      addPropertyHeat(state, id, -2);
      break;
    }

    case 'insurance_payout':
      gainClean(state, playerId, 10); // $250k
      break;

    case 'clean_books':
      player.turnEffects.immuneToFinancialCrimes = true;
      player.turnEffects.protectedDirty += 20; // $500k
      break;

    case 'security_sweep': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      for (const worker of workersAt(state, state.properties[id])) {
        delete worker.conditions.disrupted;
        delete worker.conditions.unavailable;
      }
      break;
    }

    case 'diversion': {
      const unit = state.police.find((p) => p.id === target.policeId) ?? state.police[0];
      const options = hexNeighbours(unit.hex).filter(
        (h) => h.q >= 0 && h.q <= 5 && h.r >= 0 && h.r <= 3,
      );
      if (options.length > 0) {
        const { rng, commit } = rngFor(state);
        unit.hex = rng.pick(options);
        commit();
      }
      break;
    }

    case 'quiet_week': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      addPropertyHeat(state, id, -2);
      addModifier(state, id, { source: 'Quiet Week -20%', multiplier: 80, expiresAtRound: thisRound });
      break;
    }

    case 'backup_manager': {
      const id = target.propertyId ?? firstOwned(state, playerId);
      if (id === null) return;
      addModifier(state, id, { source: 'no_mamasan', expiresAtRound: thisRound });
      break;
    }

    case 'locked_safe':
      player.turnEffects.protectedCash += 12; // $300k
      player.turnEffects.protectedDirty += 12;
      break;

    case 'compliance_review': {
      const property = ownedProperties(state, playerId).find((p) =>
        upgradesAt(state, p).some((u) => !u.instance.disabled && u.def.category === 'underworld'),
      );
      if (property) {
        const upgrade = upgradesAt(state, property).find(
          (u) => !u.instance.disabled && u.def.category === 'underworld',
        );
        if (upgrade) state.upgrades[upgrade.instance.id].disabled = true;
      }
      addNotoriety(state, playerId, -1, 'Compliance Review');
      break;
    }

    case 'good_lawyer':
      player.turnEffects.raidSeverityModifier += 2;
      break;

    case 'tip_off':
      player.turnEffects.cancelNextRaid = true;
      addHeat(state, playerId, 1);
      break;

    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Reaction windows
// ---------------------------------------------------------------------------

function openReaction(
  state: GameState,
  responderId: PlayerId,
  kind: 'poach' | 'card_play' | 'raid' | 'noise_or_licence',
  prompt: string,
  payload: Record<string, unknown>,
): void {
  const allowed = REACTIONS[kind] ?? [];
  const eligible = state.players[responderId].hand.filter((cardId) =>
    allowed.includes(state.cards[cardId].defId),
  );

  if (eligible.length === 0) {
    // Nobody can answer, so the effect lands immediately.
    completeReaction(state, kind, payload, null);
    return;
  }

  state.pendingReaction = { responderId, kind, prompt, eligibleCardIds: eligible, payload };
  emit(state, 'reaction_window', prompt, responderId);
}

/** Resolves the open reaction window, with or without a reaction card. */
export function resolveReaction(
  input: GameState,
  cardInstanceId: CardInstanceId | null,
): GameState {
  const state = clone(input);
  const pending = state.pendingReaction;
  if (!pending) return input;

  let cancelled = false;

  if (cardInstanceId) {
    const check = canPlayCard(state, pending.responderId, cardInstanceId);
    if (check.ok) {
      const def = CARD_BY_ID[state.cards[cardInstanceId].defId];
      discardCard(state, pending.responderId, cardInstanceId);
      emit(
        state,
        'card',
        `${state.players[pending.responderId].name} reacts with ${def.name}.`,
        pending.responderId,
      );

      if (def.id === 'counteroffer') gainClean(state, pending.responderId, 2); // $50k
      if (def.id === 'good_lawyer') {
        state.players[pending.responderId].turnEffects.raidSeverityModifier += 2;
      }
      if (def.id === 'tip_off') {
        state.players[pending.responderId].turnEffects.cancelNextRaid = true;
        addHeat(state, pending.responderId, 1);
      }

      cancelled = def.id !== 'good_lawyer';
    }
  }

  state.pendingReaction = null;
  completeReaction(state, pending.kind, pending.payload, cancelled ? 'cancelled' : null);

  if (state.phase === 'scheme') state.phase = 'operate';

  return state;
}

function completeReaction(
  state: GameState,
  kind: string,
  payload: Record<string, unknown>,
  outcome: 'cancelled' | null,
): void {
  if (outcome === 'cancelled') {
    emit(state, 'reaction', 'The effect is cancelled.');
    return;
  }

  switch (kind) {
    case 'poach': {
      const attackerId = payload.attackerId as PlayerId;
      const workerId = payload.workerId as string;
      resolvePoach(state, attackerId, workerId);
      break;
    }

    case 'noise_or_licence': {
      const propertyId = payload.propertyId as PropertyId;
      const effect = payload.effect as string;
      if (effect === 'noise_complaint') {
        addPropertyHeat(state, propertyId, 2);
        emit(state, 'card', `${propertyName(propertyId)} gains 2 Heat.`);
      } else {
        state.properties[propertyId].modifiers.push({
          id: `mod-${state.nextEventId}-${propertyId}`,
          source: 'Licence Challenge',
          licenceSuspended: true,
          expiresAtRound: state.round + 1,
        });
        emit(state, 'card', `${propertyName(propertyId)} is treated as Unlicensed.`);
      }
      break;
    }

    default:
      break;
  }
}

function resolvePoach(state: GameState, attackerId: PlayerId, workerId: string): void {
  const ownerId = ownerOfWorker(state, workerId);
  if (!ownerId) return;

  const owner = state.players[ownerId];
  const worker = owner.workers.find((w) => w.id === workerId);
  if (!worker) return;

  const profile = WORKER_BY_ID[worker.profileId];
  let cost = BALANCE.cards.poachBaseCost;
  if (profile.tag === 'cheap_poach') cost -= 2;
  if (profile.tag === 'poach_tax') cost += 2;
  if (worker.propertyId && hasMamasanTag(state, state.properties[worker.propertyId], 'poach_tax')) {
    cost += 4; // Duangjai
  }

  const attacker = state.players[attackerId];
  if (attacker.cleanCash < cost) {
    emit(
      state,
      'card',
      `${attacker.name} cannot afford the poach (${cost} required).`,
      attackerId,
    );
    return;
  }

  // Stability is the Worker's resistance: high-stability Workers are hard to move.
  const { rng, commit } = rngFor(state);
  const resisted = rng.int(6) + 1 <= worker.stability;
  commit();

  payClean(state, attackerId, cost);

  if (resisted) {
    emit(state, 'card', `The poach fails — the Worker stays put.`, ownerId);
    return;
  }

  // Move the Worker across to the attacker, if they have room.
  const destination = ownedProperties(state, attackerId).find(
    (p) => isOperating(state, p) && p.workerIds.length < PROPERTY_BY_ID[p.id].capacity,
  );

  owner.workers = owner.workers.filter((w) => w.id !== workerId);
  if (worker.propertyId !== null) {
    const property = state.properties[worker.propertyId];
    property.workerIds = property.workerIds.filter((id) => id !== workerId);
  }

  worker.ownerId = attackerId;
  worker.propertyId = null;
  attacker.workers.push(worker);

  if (destination) attachWorker(state, workerId, destination.id);

  emit(
    state,
    'card',
    `${attacker.name} poaches a ${profile.name} from ${owner.name} for ${cost}.`,
    attackerId,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstOwned(state: GameState, playerId: PlayerId): PropertyId | null {
  const owned = ownedProperties(state, playerId).filter((p) => isOperating(state, p));
  if (owned.length === 0) return null;
  // Prefer the Property with the most active Workers, so untargeted plays still land well.
  return owned.reduce((best, p) =>
    activeWorkersAt(state, p).length > activeWorkersAt(state, best).length ? p : best,
  ).id;
}

function ownerOfWorker(state: GameState, workerId: string): PlayerId | null {
  for (const id of state.playerOrder) {
    if (state.players[id].workers.some((w) => w.id === workerId)) return id;
  }
  return null;
}

function findAnyWorker(state: GameState, workerId?: string) {
  if (!workerId) return null;
  for (const id of state.playerOrder) {
    const worker = state.players[id].workers.find((w) => w.id === workerId);
    if (worker) return worker;
  }
  return null;
}
