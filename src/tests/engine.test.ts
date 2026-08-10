import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/content/balance';
import { CARDS } from '@/content/cards';
import { MAMASANS } from '@/content/mamasans';
import { PROPERTIES, PROPERTY_BY_ID } from '@/content/properties';
import { UPGRADES, COPIES_PER_UPGRADE } from '@/content/upgrades';
import { WORKER_PROFILES, COPIES_PER_WORKER_PROFILE } from '@/content/workers';
import { createGame } from '@/engine/setup';
import { dispatch, advancePhase } from '@/engine';
import { executeAction } from '@/engine/actions/execute';
import { validateAction } from '@/engine/actions';
import { computeWheel, spinWheel } from '@/engine/calculations/wheel';
import { computePotentialRevenue } from '@/engine/calculations/revenue';
import { assessRaid } from '@/engine/calculations/raid';
import { cleanWealthProgress, empireProgress } from '@/engine/calculations/victory';
import { empireOverhead, resolveFinalRaid, declareVictory } from '@/engine/phases';
import { createRng } from '@/engine/rng';
import {
  availableLaunderTiers,
  cleanNetWorth,
  controlsDistrict,
  effectiveCapacity,
  isOperating,
  ownedProperties,
} from '@/engine/selectors';
import { parseGameState, exportGameState } from '@/state/persistence';
import { playGame } from '@/simulation/runner';
import type { GameState, NightOutcome } from '@/types';

const NAMES = ['A', 'B', 'C', 'D'];

function game(seed = 'test-seed'): GameState {
  return createGame({ playerNames: NAMES, seed });
}

/** Runs a full turn for whoever is active, choosing sensible defaults. */
function playTurn(state: GameState): GameState {
  let current = state;
  let guard = 0;
  const startTurn = current.turnCounter;

  while (current.turnCounter === startTurn && !current.gameOver && guard++ < 200) {
    const actor = current.playerOrder[current.activePlayerIndex];

    if (current.pendingReaction) {
      current = dispatch(current, current.pendingReaction.responderId, {
        type: 'RESOLVE_REACTION',
        cardId: null,
      }).state;
      continue;
    }
    if (current.pendingUpkeep) {
      current = dispatch(current, current.pendingUpkeep.playerId, {
        type: 'UPKEEP_CHOICE',
        choice: 'heat',
      }).state;
      continue;
    }
    if (current.phase === 'scheme') {
      current = dispatch(current, actor, { type: 'SKIP_CARD' }).state;
      continue;
    }
    if (current.phase === 'operate') {
      current = dispatch(current, actor, { type: 'END_OPERATE' }).state;
      continue;
    }
    current = advancePhase(current);
  }

  return current;
}

// ===========================================================================
// Content integrity
// ===========================================================================

describe('content catalogues', () => {
  it('contains 24 Properties across 6 districts', () => {
    expect(PROPERTIES).toHaveLength(24);
    const byDistrict = new Map<string, number>();
    for (const p of PROPERTIES) byDistrict.set(p.district, (byDistrict.get(p.district) ?? 0) + 1);
    expect(byDistrict.size).toBe(6);
    for (const count of byDistrict.values()) expect(count).toBe(4);
  });

  it('places every Property on a unique hex', () => {
    const keys = new Set(PROPERTIES.map((p) => `${p.hex.q},${p.hex.r}`));
    expect(keys.size).toBe(24);
  });

  it('contains 24 Mamasans, 48 Workers and 48 Upgrade tiles', () => {
    expect(MAMASANS).toHaveLength(24);
    expect(WORKER_PROFILES.length * COPIES_PER_WORKER_PROFILE).toBe(48);
    expect(UPGRADES.length * COPIES_PER_UPGRADE).toBe(48);
  });

  it('builds a 72-card Night Deck with 18 of each category', () => {
    const total = CARDS.reduce((sum, c) => sum + c.copies, 0);
    expect(total).toBe(72);
    for (const category of ['opportunity', 'dirty_trick', 'protection', 'environment']) {
      const count = CARDS.filter((c) => c.category === category).reduce(
        (sum, c) => sum + c.copies,
        0,
      );
      expect(count, `${category} count`).toBe(18);
    }
  });
});

// ===========================================================================
// Setup
// ===========================================================================

describe('setup', () => {
  it('deals the documented starting position', () => {
    const state = game();
    expect(state.playerOrder).toHaveLength(4);
    for (const id of state.playerOrder) {
      const player = state.players[id];
      expect(player.cleanCash).toBe(BALANCE.setup.startingCleanCash);
      expect(player.dirtyCash).toBe(BALANCE.setup.startingDirtyCash);
      expect(player.heat).toBe(BALANCE.setup.startingHeat);
      expect(player.notoriety).toBe(0);
      expect(player.hand).toHaveLength(BALANCE.setup.startingHandSize);
      expect(player.workers).toHaveLength(2);
      expect(player.mamasans).toHaveLength(1);
      expect(ownedProperties(state, id)).toHaveLength(1);
    }
  });

  it('puts the Final Raid card inside the final window of the deck', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const state = createGame({ playerNames: NAMES, seed });
      const index = state.deck.findIndex((id) => state.cards[id].defId === 'final_raid');
      expect(index).toBeGreaterThanOrEqual(0);
      // Deck is 73 cards minus the 12 dealt as opening hands.
      expect(index).toBeGreaterThan(state.deck.length - BALANCE.setup.startingHandSize - 20);
    }
  });

  it('rejects player counts outside 3-4', () => {
    expect(() => createGame({ playerNames: ['A', 'B'] })).toThrow();
    expect(() => createGame({ playerNames: ['A', 'B', 'C', 'D', 'E'] })).toThrow();
  });

  it('starts each player with exactly one Mamasan in their Starter Property', () => {
    const state = game();
    for (const id of state.playerOrder) {
      const property = ownedProperties(state, id)[0];
      expect(property.mamasanId).not.toBeNull();
      expect(isOperating(state, property)).toBe(true);
    }
  });
});

// ===========================================================================
// Determinism
// ===========================================================================

describe('deterministic RNG', () => {
  it('produces an identical stream for the same seed and cursor', () => {
    const a = createRng('seed-x', 0);
    const b = createRng('seed-x', 0);
    const first = Array.from({ length: 50 }, () => a.next());
    const second = Array.from({ length: 50 }, () => b.next());
    expect(first).toEqual(second);
  });

  it('produces different streams for different seeds', () => {
    const a = Array.from({ length: 20 }, (_, i) => createRng('one', i).next());
    const b = Array.from({ length: 20 }, (_, i) => createRng('two', i).next());
    expect(a).not.toEqual(b);
  });

  it('replays a whole game identically from the same seed', () => {
    const first = playGame('determinism', ['operator', 'hustler', 'shark', 'baron']);
    const second = playGame('determinism', ['operator', 'hustler', 'shark', 'baron']);
    expect(second.winnerSeat).toBe(first.winnerSeat);
    expect(second.rounds).toBe(first.rounds);
    expect(second.finalScores).toEqual(first.finalScores);
  });

  it('resumes the same stream from a serialised save', () => {
    let state = game('resume-test');
    state = playTurn(state);
    const restored = parseGameState(exportGameState(state));
    expect(restored.ok).toBe(true);
    const a = playTurn(state);
    const b = playTurn(restored.state!);
    expect(b.log.map((e) => e.message)).toEqual(a.log.map((e) => e.message));
  });
});

// ===========================================================================
// Phases and turn structure
// ===========================================================================

describe('turn structure', () => {
  it('cycles draw -> scheme -> operate -> resolve -> police -> close', () => {
    let state = game();
    expect(state.phase).toBe('draw');
    state = advancePhase(state);
    expect(state.phase).toBe('scheme');
    state = dispatch(state, state.playerOrder[state.activePlayerIndex], { type: 'SKIP_CARD' }).state;
    expect(state.phase).toBe('operate');
    state = dispatch(state, state.playerOrder[state.activePlayerIndex], { type: 'END_OPERATE' }).state;
    expect(state.phase).toBe('resolve');
    state = advancePhase(state); // spin
    expect(state.pendingNight?.spun).toBe(true);
    state = advancePhase(state); // apply
    expect(state.phase).toBe('police');
    state = advancePhase(state);
    expect(state.phase).toBe('close');
  });

  it('grants exactly two Actions per turn', () => {
    const state = game();
    const id = state.playerOrder[state.activePlayerIndex];
    expect(state.players[id].actionsRemaining).toBe(BALANCE.turn.actionsPerTurn);
  });

  it('passes play clockwise and increments the round on wrap', () => {
    let state = game();
    const startIndex = state.activePlayerIndex;
    for (let i = 0; i < 4; i++) state = playTurn(state);
    expect(state.activePlayerIndex).toBe(startIndex);
    expect(state.round).toBeGreaterThan(1);
  });

  it('refuses Actions outside the Operate phase', () => {
    const state = game();
    const id = state.playerOrder[state.activePlayerIndex];
    const validation = validateAction(state, id, { type: 'REDUCE_HEAT' });
    expect(validation.ok).toBe(false);
    expect(validation.reason).toMatch(/Operate phase/);
  });
});

// ===========================================================================
// Integrity rules
// ===========================================================================

describe('integrity rules', () => {
  it('never lets a Property have two owners', () => {
    let state = game();
    state = advancePhase(state);
    state = dispatch(state, state.playerOrder[state.activePlayerIndex], { type: 'SKIP_CARD' }).state;

    const buyerId = state.playerOrder[state.activePlayerIndex];
    const free = Object.values(state.properties).find((p) => p.ownerId === null)!;
    const result = executeAction(state, buyerId, { type: 'BUY_PROPERTY', propertyId: free.id });
    expect(result.ok).toBe(true);

    const other = state.playerOrder.find((id) => id !== buyerId)!;
    const second = validateAction(result.state, other, {
      type: 'BUY_PROPERTY',
      propertyId: free.id,
    });
    expect(second.ok).toBe(false);
  });

  it('allows only one Mamasan per Property and one Property per Mamasan', () => {
    const state = game();
    for (const id of state.playerOrder) {
      const seen = new Set<number>();
      for (const mamasan of state.players[id].mamasans) {
        if (mamasan.propertyId !== null) {
          expect(seen.has(mamasan.propertyId)).toBe(false);
          seen.add(mamasan.propertyId);
        }
      }
    }
    const occupied = Object.values(state.properties).filter((p) => p.mamasanId !== null);
    const ids = occupied.map((p) => p.mamasanId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never assigns a Worker to two Properties', () => {
    const state = game();
    const assignments = new Map<string, number>();
    for (const property of Object.values(state.properties)) {
      for (const workerId of property.workerIds) {
        expect(assignments.has(workerId)).toBe(false);
        assignments.set(workerId, property.id);
      }
    }
  });

  it('refuses to exceed Worker Capacity', () => {
    let state = game();
    state = advancePhase(state);
    state = dispatch(state, state.playerOrder[state.activePlayerIndex], { type: 'SKIP_CARD' }).state;

    const id = state.playerOrder[state.activePlayerIndex];
    const property = ownedProperties(state, id)[0];
    // Fill it to capacity.
    const capacity = effectiveCapacity(state, property);
    state.properties[property.id].workerIds = Array.from({ length: capacity }, (_, i) => `fake${i}`);
    state.players[id].cleanCash = 200;

    // Every player is dealt a Local Regular, so that profile's supply is empty
    // at 4 players — use one that is definitely still available.
    const validation = validateAction(state, id, {
      type: 'RECRUIT_WORKER',
      profileId: 'vip_specialist',
      propertyId: property.id,
    });
    expect(validation.ok).toBe(false);
    expect(validation.reason).toMatch(/Capacity/);
  });

  it('refuses to exceed Upgrade Slots', () => {
    let state = game();
    state = advancePhase(state);
    state = dispatch(state, state.playerOrder[state.activePlayerIndex], { type: 'SKIP_CARD' }).state;

    const id = state.playerOrder[state.activePlayerIndex];
    const property = ownedProperties(state, id)[0];
    const slots = PROPERTY_BY_ID[property.id].upgradeSlots;
    state.properties[property.id].upgradeIds = Array.from({ length: slots }, (_, i) => `fake${i}`);
    state.players[id].cleanCash = 200;

    const validation = validateAction(state, id, {
      type: 'BUY_UPGRADE',
      upgradeDefId: 'cameras',
      propertyId: property.id,
    });
    expect(validation.ok).toBe(false);
    expect(validation.reason).toMatch(/Upgrade Slot/);
  });

  it('keeps cash non-negative across a long game', () => {
    let state = game('cash-integrity');
    for (let i = 0; i < 40 && !state.gameOver; i++) {
      state = playTurn(state);
      for (const id of state.playerOrder) {
        expect(state.players[id].cleanCash).toBeGreaterThanOrEqual(0);
        expect(state.players[id].dirtyCash).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('keeps Heat within 0-10 and never below Notoriety', () => {
    let state = game('heat-integrity');
    for (let i = 0; i < 40 && !state.gameOver; i++) {
      state = playTurn(state);
      for (const id of state.playerOrder) {
        const player = state.players[id];
        expect(player.heat).toBeGreaterThanOrEqual(0);
        expect(player.heat).toBeLessThanOrEqual(10);
        expect(player.notoriety).toBeGreaterThanOrEqual(0);
        expect(player.notoriety).toBeLessThanOrEqual(5);
        expect(player.heat).toBeGreaterThanOrEqual(player.notoriety);
      }
    }
  });

  it('blocks every action once the game is over', () => {
    const state = resolveFinalRaid(game('over'));
    expect(state.gameOver).toBe(true);
    const id = state.playerOrder[0];
    expect(validateAction(state, id, { type: 'REDUCE_HEAT' }).ok).toBe(false);
    const result = dispatch(state, id, { type: 'ACTION', action: { type: 'REDUCE_HEAT' } });
    expect(result.ok).toBe(false);
  });
});

// ===========================================================================
// Night Wheel
// ===========================================================================

describe('Night Wheel', () => {
  it('always totals exactly 100%', () => {
    let state = game('wheel');
    for (let i = 0; i < 25 && !state.gameOver; i++) {
      for (const id of state.playerOrder) {
        const wheel = computeWheel(state, id);
        const total = Object.values(wheel.probabilities).reduce((a, b) => a + b, 0);
        expect(total, `player ${id} round ${state.round}`).toBe(100);
      }
      state = playTurn(state);
    }
  });

  it('never produces a negative probability', () => {
    const state = game('wheel-neg');
    for (const id of state.playerOrder) {
      const wheel = computeWheel(state, id);
      for (const value of Object.values(wheel.probabilities)) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('raises Raid chance as risk rises', () => {
    const calm = game('risk');
    const id = calm.playerOrder[0];
    const calmWheel = computeWheel(calm, id);

    const hot = structuredClone(calm);
    hot.players[id].heat = 10;
    hot.players[id].notoriety = 5;
    const hotWheel = computeWheel(hot, id);

    expect(hotWheel.effectiveRisk).toBeGreaterThan(calmWheel.effectiveRisk);
    expect(hotWheel.probabilities.raid).toBeGreaterThan(calmWheel.probabilities.raid);
  });

  it('maps rolls onto outcomes in wheel order', () => {
    const probabilities: Record<NightOutcome, number> = {
      big: 20,
      normal: 50,
      quiet: 20,
      trouble: 8,
      raid: 2,
    };
    expect(spinWheel(probabilities, 0.0)).toBe('big');
    expect(spinWheel(probabilities, 0.19)).toBe('big');
    expect(spinWheel(probabilities, 0.21)).toBe('normal');
    expect(spinWheel(probabilities, 0.71)).toBe('quiet');
    expect(spinWheel(probabilities, 0.91)).toBe('trouble');
    expect(spinWheel(probabilities, 0.99)).toBe('raid');
  });

  it('explains every probability change with a source', () => {
    const state = game('explain');
    const id = state.playerOrder[0];
    state.players[id].heat = 8;
    const wheel = computeWheel(state, id);
    expect(wheel.breakdown.length).toBeGreaterThan(1);
    expect(wheel.breakdown[0].source).toBe('Base');
  });
});

// ===========================================================================
// Revenue
// ===========================================================================

describe('revenue', () => {
  it('separates Clean and Dirty by Worker status', () => {
    const state = game('revenue');
    const id = state.playerOrder[0];
    const revenue = computePotentialRevenue(state, id);
    // Every player starts with one Vetted and one Unregistered Worker.
    expect(revenue.clean).toBeGreaterThan(0);
    expect(revenue.dirty).toBeGreaterThan(0);
  });

  it('produces nothing from a Property with no Mamasan', () => {
    const state = game('no-mamasan');
    const id = state.playerOrder[0];
    const property = ownedProperties(state, id)[0];
    const before = computePotentialRevenue(state, id);
    expect(before.clean + before.dirty).toBeGreaterThan(0);

    const stripped = structuredClone(state);
    stripped.properties[property.id].mamasanId = null;
    const after = computePotentialRevenue(stripped, id);
    expect(after.clean + after.dirty).toBe(0);
  });

  it('produces nothing from a closed Property', () => {
    const state = game('closed');
    const id = state.playerOrder[0];
    const property = ownedProperties(state, id)[0];
    const closed = structuredClone(state);
    closed.properties[property.id].closedUntilRound = closed.round + 2;
    const revenue = computePotentialRevenue(closed, id);
    expect(revenue.clean + revenue.dirty).toBe(0);
  });

  it('ignores Unavailable Workers', () => {
    const state = game('unavailable');
    const id = state.playerOrder[0];
    const before = computePotentialRevenue(state, id);

    const blocked = structuredClone(state);
    for (const worker of blocked.players[id].workers) worker.conditions.unavailable = 1;
    const after = computePotentialRevenue(blocked, id);
    expect(after.clean + after.dirty).toBe(0);
    expect(before.clean + before.dirty).toBeGreaterThan(0);
  });

  it('applies the Property Revenue Multiplier', () => {
    // Built explicitly rather than from the dealt starter: with only two Workers
    // a +0.10 multiplier can vanish into integer rounding, which would make the
    // assertion depend on which Property the seed happened to deal.
    const state = game('multiplier');
    const id = state.playerOrder[0];
    const property = ownedProperties(state, id)[0];

    const stack = (defId: string) => {
      const next = structuredClone(state);
      next.players[id].mamasans[0].defId = defId;
      next.players[id].workers = [];
      next.properties[property.id].workerIds = [];
      // Enough Workers that a 10% change is larger than a rounding step.
      for (let i = 0; i < 8; i++) {
        const workerId = `w-mult-${i}`;
        next.players[id].workers.push({
          id: workerId,
          profileId: 'local_regular',
          status: 'vetted',
          ownerId: id,
          propertyId: property.id,
          stability: 4,
          conditions: {},
          producingNights: 0,
        });
        next.properties[property.id].workerIds.push(workerId);
      }
      // Capacity has to allow all of them to earn.
      next.properties[property.id].modifiers.push({
        id: 'cap',
        source: 'test capacity',
        capacityDelta: 8,
        expiresAtRound: 999,
      });
      return computePotentialRevenue(next, id);
    };

    const base = stack('anong'); // no revenue effect
    const boosted = stack('pailin'); // +0.10 multiplier

    expect(boosted.clean).toBeGreaterThan(base.clean);
    expect(PROPERTY_BY_ID[property.id]).toBeDefined();
  });
});

// ===========================================================================
// Actions
// ===========================================================================

describe('actions', () => {
  function operating(seed: string) {
    let state = game(seed);
    state = advancePhase(state);
    state = dispatch(state, state.playerOrder[state.activePlayerIndex], { type: 'SKIP_CARD' }).state;
    return state;
  }

  it('spends an Action and Clean Cash when buying a Property', () => {
    const state = operating('buy');
    const id = state.playerOrder[state.activePlayerIndex];
    const before = state.players[id].cleanCash;
    const target = Object.values(state.properties).find(
      (p) => p.ownerId === null && PROPERTY_BY_ID[p.id].cost <= before,
    )!;

    const result = executeAction(state, id, { type: 'BUY_PROPERTY', propertyId: target.id });
    expect(result.ok).toBe(true);
    expect(result.state.properties[target.id].ownerId).toBe(id);
    expect(result.state.players[id].cleanCash).toBe(before - PROPERTY_BY_ID[target.id].cost);
    expect(result.state.players[id].actionsRemaining).toBe(1);
  });

  it('licences a Property, removing Heat', () => {
    const state = operating('licence');
    const id = state.playerOrder[state.activePlayerIndex];
    const unlicensed = ownedProperties(state, id).find((p) => !p.licensed);
    if (!unlicensed) return; // this seed dealt a Licensed starter

    state.players[id].cleanCash = 100;
    state.players[id].heat = 4;
    const result = executeAction(state, id, {
      type: 'LICENCE_PROPERTY',
      propertyId: unlicensed.id,
    });
    expect(result.ok).toBe(true);
    expect(result.state.properties[unlicensed.id].licensed).toBe(true);
    expect(result.state.players[id].heat).toBeLessThan(4);
  });

  it('vets a Worker: Clean revenue, no Notoriety relief', () => {
    const state = operating('vet');
    const id = state.playerOrder[state.activePlayerIndex];
    state.players[id].cleanCash = 100;
    state.players[id].notoriety = 2;
    state.players[id].heat = 3;

    const worker = state.players[id].workers.find((w) => w.status === 'unregistered')!;
    const result = executeAction(state, id, { type: 'VET_WORKER', workerId: worker.id });
    expect(result.ok).toBe(true);

    const vetted = result.state.players[id].workers.find((w) => w.id === worker.id)!;
    expect(vetted.status).toBe('vetted');
    expect(result.state.players[id].notoriety).toBe(2);
  });

  it('launders Dirty into Clean at the documented rate', () => {
    const state = operating('launder');
    const id = state.playerOrder[state.activePlayerIndex];
    state.players[id].dirtyCash = 40;
    const cleanBefore = state.players[id].cleanCash;

    const result = executeAction(state, id, { type: 'LAUNDER', tier: 1 });
    expect(result.ok).toBe(true);
    expect(result.state.players[id].dirtyCash).toBe(40 - 12);
    expect(result.state.players[id].cleanCash).toBe(cleanBefore + 8);
  });

  it('offers only Tier 1 without laundering infrastructure', () => {
    const state = game('tiers');
    const id = state.playerOrder[0];
    // A Cash Business unlocks Tier 2, so only test a player without one.
    const hasCashBusiness = ownedProperties(state, id).some(
      (p) => PROPERTY_BY_ID[p.id].archetype === 'cash_business',
    );
    if (!hasCashBusiness) {
      expect(availableLaunderTiers(state, id)).toEqual([1]);
    }
  });

  it('refuses to launder the same tier twice in one turn', () => {
    const state = operating('launder-twice');
    const id = state.playerOrder[state.activePlayerIndex];
    state.players[id].dirtyCash = 60;

    const first = executeAction(state, id, { type: 'LAUNDER', tier: 1 });
    expect(first.ok).toBe(true);
    const second = validateAction(first.state, id, { type: 'LAUNDER', tier: 1 });
    expect(second.ok).toBe(false);
    expect(second.reason).toMatch(/already been used/);
  });

  it('will not reduce Heat below the Notoriety floor', () => {
    const state = operating('heat-floor');
    const id = state.playerOrder[state.activePlayerIndex];
    state.players[id].notoriety = 3;
    state.players[id].heat = 3;
    state.players[id].cleanCash = 100;

    const validation = validateAction(state, id, { type: 'REDUCE_HEAT' });
    expect(validation.ok).toBe(false);
    expect(validation.reason).toMatch(/Notoriety floor/);
  });

  it('gives a specific reason for every unaffordable action', () => {
    const state = operating('poor');
    const id = state.playerOrder[state.activePlayerIndex];
    state.players[id].cleanCash = 0;
    state.players[id].dirtyCash = 0;

    const expensive = Object.values(state.properties).find((p) => p.ownerId === null)!;
    const validation = validateAction(state, id, {
      type: 'BUY_PROPERTY',
      propertyId: expensive.id,
    });
    expect(validation.ok).toBe(false);
    expect(validation.reason).toMatch(/requires/);
    // Money is reported in dollars, never raw units.
    expect(validation.reason).toMatch(/\$/);
  });
});

// ===========================================================================
// Upkeep
// ===========================================================================

describe('upkeep', () => {
  it('matches the Empire Overhead table', () => {
    expect(empireOverhead(1)).toBe(0);
    expect(empireOverhead(4)).toBe(0);
    expect(empireOverhead(5)).toBe(2); // $50k
    expect(empireOverhead(6)).toBe(4); // $100k
    expect(empireOverhead(7)).toBe(8); // $200k
    expect(empireOverhead(8)).toBe(12); // $300k
    expect(empireOverhead(9)).toBe(18); // $450k
    expect(empireOverhead(13)).toBe(42 + 8);
  });

  it('pauses on an unpaid-upkeep decision and resumes once resolved', () => {
    let state = game('unpaid');
    state = advancePhase(state); // draw
    state = dispatch(state, state.playerOrder[state.activePlayerIndex], { type: 'SKIP_CARD' }).state;
    state = dispatch(state, state.playerOrder[state.activePlayerIndex], { type: 'END_OPERATE' }).state;
    state = advancePhase(state); // spin
    state = advancePhase(state); // apply
    state = advancePhase(state); // police

    // Strip the player's cash so upkeep cannot be paid.
    const id = state.playerOrder[state.activePlayerIndex];
    state.players[id].cleanCash = 0;

    state = advancePhase(state); // close
    expect(state.pendingUpkeep).not.toBeNull();

    const heatBefore = state.players[id].heat;
    state = dispatch(state, id, { type: 'UPKEEP_CHOICE', choice: 'heat' }).state;
    expect(state.players[id].heat).toBeGreaterThanOrEqual(heatBefore);
  });

  it('adds Notoriety when emergency finance is taken', () => {
    let state = game('emergency');
    state.pendingUpkeep = { playerId: state.playerOrder[0], remaining: 1 };
    state.phase = 'close';
    const id = state.playerOrder[0];
    const before = state.players[id].notoriety;

    state = dispatch(state, id, { type: 'UPKEEP_CHOICE', choice: 'emergency_finance' }).state;
    expect(state.players[id].notoriety).toBe(before + 1);
  });
});

// ===========================================================================
// Districts and Police
// ===========================================================================

describe('districts and police', () => {
  it('grants control at three of four Properties', () => {
    const state = game('district');
    const id = state.playerOrder[0];
    expect(controlsDistrict(state, id, 'laneways')).toBe(false);

    const owned = structuredClone(state);
    for (const propertyId of [1, 2, 3]) owned.properties[propertyId].ownerId = id;
    expect(controlsDistrict(owned, id, 'laneways')).toBe(true);
  });

  it('moves a Police unit each Police phase and keeps it on the board', () => {
    let state = game('police');
    const before = state.police.map((p) => ({ ...p.hex }));

    for (let i = 0; i < 6; i++) state = playTurn(state);

    for (const unit of state.police) {
      expect(unit.hex.q).toBeGreaterThanOrEqual(0);
      expect(unit.hex.q).toBeLessThanOrEqual(5);
      expect(unit.hex.r).toBeGreaterThanOrEqual(0);
      expect(unit.hex.r).toBeLessThanOrEqual(3);
    }
    const moved = state.police.some(
      (unit, i) => unit.hex.q !== before[i].q || unit.hex.r !== before[i].r,
    );
    expect(moved).toBe(true);
  });
});

// ===========================================================================
// Raids
// ===========================================================================

describe('raids', () => {
  it('scores exposure against protection', () => {
    const state = game('raid');
    const id = state.playerOrder[0];
    const property = ownedProperties(state, id)[0];

    const assessment = assessRaid(state, id, property);
    expect(assessment.exposureTotal).toBeGreaterThanOrEqual(0);
    expect(assessment.score).toBe(assessment.exposureTotal - assessment.protectionTotal);
  });

  it('produces a worse Raid for a hotter, more notorious player', () => {
    const state = game('raid-severity');
    const id = state.playerOrder[0];
    const property = ownedProperties(state, id)[0];
    const calm = assessRaid(state, id, property);

    const hot = structuredClone(state);
    hot.players[id].heat = 10;
    hot.players[id].notoriety = 5;
    hot.properties[property.id].heat = 5;
    const severe = assessRaid(hot, id, property);

    expect(severe.level).toBeGreaterThan(calm.level);
  });

  it('reduces severity with Security', () => {
    const state = game('raid-security');
    const id = state.playerOrder[0];
    const property = ownedProperties(state, id)[0];
    state.players[id].heat = 8;

    const before = assessRaid(state, id, property);

    const guarded = structuredClone(state);
    guarded.upgrades['u-test'] = {
      id: 'u-test',
      defId: 'private_security',
      propertyId: property.id,
      disabled: false,
    };
    guarded.properties[property.id].upgradeIds.push('u-test');
    // Must pass the *cloned* Property, not the one from the original state.
    const after = assessRaid(guarded, id, guarded.properties[property.id]);

    expect(after.protectionTotal).toBeGreaterThan(before.protectionTotal);
    expect(after.score).toBeLessThan(before.score);
  });
});

// ===========================================================================
// Victory
// ===========================================================================

describe('victory', () => {
  it('reports Clean Wealth progress against the player-count thresholds', () => {
    const state = game('victory');
    const id = state.playerOrder[0];
    const progress = cleanWealthProgress(state, id);
    expect(progress.eligible).toBe(false);
    expect(progress.requirements).toHaveLength(3);
  });

  it('declares and holds a Clean Wealth Victory', () => {
    let state = game('declare');
    const id = state.playerOrder[0];
    state.activePlayerIndex = 0;
    // Give this player a decisively winning position.
    state.players[id].cleanCash = 400;

    expect(cleanWealthProgress(state, id).eligible).toBe(true);
    state = declareVictory(state, id, 'clean_wealth');
    expect(state.declaration).not.toBeNull();
    expect(state.declaration!.pendingResponders).toHaveLength(3);

    // Every opponent takes their final turn.
    for (let i = 0; i < 4 && !state.gameOver; i++) state = playTurn(state);

    expect(state.gameOver).toBe(true);
    expect(state.winnerId).toBe(id);
    expect(state.victoryType).toBe('clean_wealth');
  });

  it('fails a declaration that no longer holds when it comes back around', () => {
    let state = game('declare-fail');
    const id = state.playerOrder[0];
    state.activePlayerIndex = 0;
    state.players[id].cleanCash = 400;
    state = declareVictory(state, id, 'clean_wealth');
    expect(state.declaration).not.toBeNull();

    // Strip the position out from under them before the responses finish.
    state.players[id].cleanCash = 0;
    for (let i = 0; i < 4 && !state.gameOver; i++) state = playTurn(state);

    expect(state.winnerId).not.toBe(id);
  });

  it('recognises an Empire Victory when every condition is met', () => {
    const state = game('empire');
    const id = state.playerOrder[0];
    const built = structuredClone(state);

    // Hand this player two whole districts plus enough Properties to qualify.
    const propertyIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    built.players[id].mamasans = [];
    built.players[id].workers = [];

    propertyIds.forEach((propertyId, index) => {
      const property = built.properties[propertyId];
      property.ownerId = id;
      property.closedUntilRound = null;
      const mamasanId = `m-test-${index}`;
      built.players[id].mamasans.push({
        id: mamasanId,
        defId: 'anong',
        ownerId: id,
        propertyId,
      });
      property.mamasanId = mamasanId;

      // Fill to at least half capacity so utilisation clears 50%.
      property.workerIds = [];
      const capacity = PROPERTY_BY_ID[propertyId].capacity;
      for (let w = 0; w < Math.ceil(capacity * 0.75); w++) {
        const workerId = `w-test-${propertyId}-${w}`;
        built.players[id].workers.push({
          id: workerId,
          profileId: 'local_regular',
          status: 'vetted',
          ownerId: id,
          propertyId,
          stability: 4,
          conditions: {},
          producingNights: 0,
        });
        property.workerIds.push(workerId);
      }
    });

    const progress = empireProgress(built, id);
    expect(progress.requirements.find((r) => r.label === 'Properties owned')!.met).toBe(true);
    expect(progress.requirements.find((r) => r.label === 'Districts controlled')!.met).toBe(true);
    expect(progress.requirements.find((r) => r.label === 'Capacity utilisation')!.met).toBe(true);
    expect(progress.eligible).toBe(true);
  });

  it('scores Dirty Cash and Underworld Upgrades as zero', () => {
    const state = game('scoring');
    const id = state.playerOrder[0];
    const before = cleanNetWorth(state, id);

    const rich = structuredClone(state);
    rich.players[id].dirtyCash += 500;
    expect(cleanNetWorth(rich, id)).toBe(before);

    const property = ownedProperties(rich, id)[0];
    rich.upgrades['u-dirty'] = {
      id: 'u-dirty',
      defId: 'offshore_books',
      propertyId: property.id,
      disabled: false,
    };
    rich.properties[property.id].upgradeIds.push('u-dirty');
    expect(cleanNetWorth(rich, id)).toBe(before);
  });

  it('scores a legal Upgrade at half its cost', () => {
    const state = game('scoring-legal');
    const id = state.playerOrder[0];
    const before = cleanNetWorth(state, id);
    const property = ownedProperties(state, id)[0];

    const upgraded = structuredClone(state);
    upgraded.upgrades['u-legal'] = {
      id: 'u-legal',
      defId: 'vip_room', // costs 10 units
      propertyId: property.id,
      disabled: false,
    };
    upgraded.properties[property.id].upgradeIds.push('u-legal');
    expect(cleanNetWorth(upgraded, id)).toBe(before + 5);
  });

  it('resolves the Final Raid and picks the highest surviving Clean Net Worth', () => {
    const state = resolveFinalRaid(game('final'));
    expect(state.gameOver).toBe(true);
    expect(state.finalRaidResolved).toBe(true);
    expect(state.victoryType).toBe('final_raid');
    expect(state.winnerId).not.toBeNull();

    const scores = state.finalScores!;
    const best = Math.max(...Object.values(scores));
    expect(scores[state.winnerId!]).toBe(best);
  });
});

// ===========================================================================
// Persistence
// ===========================================================================

describe('save and load', () => {
  it('round-trips a game through JSON', () => {
    const state = playTurn(game('persist'));
    const result = parseGameState(exportGameState(state));
    expect(result.ok).toBe(true);
    expect(result.state!.round).toBe(state.round);
    expect(result.state!.seed).toBe(state.seed);
  });

  it('rejects malformed JSON', () => {
    expect(parseGameState('{ not json').ok).toBe(false);
  });

  it('rejects a state missing required fields', () => {
    expect(parseGameState(JSON.stringify({ version: 1 })).ok).toBe(false);
  });

  it('rejects a state with impossible values', () => {
    const state = game('invalid');
    const broken = structuredClone(state) as unknown as Record<string, unknown>;
    (broken.players as Record<string, { heat: number }>)[state.playerOrder[0]].heat = 99;
    const result = parseGameState(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Heat/);
  });

  it('rejects a state whose Heat sits below its Notoriety', () => {
    const state = game('invalid-2');
    const broken = structuredClone(state);
    broken.players[state.playerOrder[0]].heat = 0;
    broken.players[state.playerOrder[0]].notoriety = 3;
    const result = parseGameState(JSON.stringify(broken));
    expect(result.ok).toBe(false);
  });

  it('rejects a version it does not understand', () => {
    const state = game('version');
    const future = structuredClone(state);
    future.version = 99;
    expect(parseGameState(JSON.stringify(future)).ok).toBe(false);
  });
});

// ===========================================================================
// Integration
// ===========================================================================

describe('integration', () => {
  it('plays a complete game to a winner', () => {
    const result = playGame('integration-1', ['operator', 'hustler', 'shark', 'fortress']);
    expect(result.aborted).toBe(false);
    expect(result.winnerAgent).not.toBeNull();
    expect(result.rounds).toBeGreaterThan(1);
  });

  it('plays a complete 3-player game', () => {
    const result = playGame('integration-3p', ['operator', 'baron', 'hybrid']);
    expect(result.aborted).toBe(false);
    expect(result.winnerAgent).not.toBeNull();
  });

  it('never leaves a game unfinished across many seeds', () => {
    for (let i = 0; i < 12; i++) {
      const result = playGame(`batch-${i}`, ['operator', 'hustler', 'shark', 'baron']);
      expect(result.aborted, `seed batch-${i}`).toBe(false);
    }
  });

  it('keeps the event log append-only and ordered', () => {
    let state = game('log');
    for (let i = 0; i < 8; i++) state = playTurn(state);
    const ids = state.log.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
