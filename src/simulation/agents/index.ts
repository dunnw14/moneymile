import { PROPERTY_BY_ID } from '@/content/properties';
import { UPGRADE_BY_ID } from '@/content/upgrades';
import { WORKER_BY_ID } from '@/content/workers';
import { enumerateActions, type GameAction } from '@/engine/actions';
import { canPlayCard, rivalProperties, rivalWorkers, type CardTarget } from '@/engine/effects/cards';
import {
  cleanNetWorth,
  isOperating,
  ownedProperties,
  effectiveCapacity,
} from '@/engine/selectors';
import { CARD_BY_ID } from '@/content/cards';
import type { GameState, PlayerId, UpkeepChoice } from '@/types';
import type { RngHandle } from '@/engine/rng';

export type AgentId = 'operator' | 'hustler' | 'shark' | 'fortress' | 'baron' | 'hybrid' | 'random';

export const AGENT_IDS: AgentId[] = [
  'operator',
  'hustler',
  'shark',
  'fortress',
  'baron',
  'hybrid',
  'random',
];

export interface Agent {
  id: AgentId;
  name: string;
  /** Higher score wins. Agents see only public information. */
  scoreAction(state: GameState, playerId: PlayerId, action: GameAction): number;
  chooseCard(state: GameState, playerId: PlayerId, rng: RngHandle): { cardId: string; target: CardTarget } | null;
  chooseUpkeep(state: GameState, playerId: PlayerId): UpkeepChoice;
}

/**
 * Agents are weighted heuristics, not search. They exist to shake out balance
 * problems and to prove the engine survives thousands of complete games — not
 * to play well enough to be an opponent.
 */
interface Weights {
  buyLicensed: number;
  buyUnlicensed: number;
  recruitVetted: number;
  recruitUnregistered: number;
  upgradeRevenue: number;
  upgradeSecurity: number;
  upgradeOperations: number;
  upgradeUnderworld: number;
  licence: number;
  vet: number;
  launder: number;
  reduceHeat: number;
  mamasan: number;
  districtFocus: number;
  aggression: number;
}

const PROFILES: Record<AgentId, Weights> = {
  operator: {
    buyLicensed: 10, buyUnlicensed: 1, recruitVetted: 9, recruitUnregistered: 1,
    upgradeRevenue: 6, upgradeSecurity: 5, upgradeOperations: 4, upgradeUnderworld: 0,
    licence: 9, vet: 8, launder: 4, reduceHeat: 5, mamasan: 7, districtFocus: 3, aggression: 1,
  },
  hustler: {
    buyLicensed: 3, buyUnlicensed: 10, recruitVetted: 1, recruitUnregistered: 10,
    upgradeRevenue: 7, upgradeSecurity: 1, upgradeOperations: 5, upgradeUnderworld: 8,
    licence: 1, vet: 2, launder: 8, reduceHeat: 2, mamasan: 6, districtFocus: 2, aggression: 4,
  },
  shark: {
    buyLicensed: 5, buyUnlicensed: 5, recruitVetted: 4, recruitUnregistered: 5,
    upgradeRevenue: 4, upgradeSecurity: 3, upgradeOperations: 3, upgradeUnderworld: 3,
    licence: 4, vet: 3, launder: 4, reduceHeat: 4, mamasan: 6, districtFocus: 2, aggression: 10,
  },
  fortress: {
    buyLicensed: 8, buyUnlicensed: 1, recruitVetted: 7, recruitUnregistered: 1,
    upgradeRevenue: 3, upgradeSecurity: 10, upgradeOperations: 3, upgradeUnderworld: 0,
    licence: 8, vet: 7, launder: 3, reduceHeat: 8, mamasan: 7, districtFocus: 2, aggression: 1,
  },
  baron: {
    buyLicensed: 10, buyUnlicensed: 7, recruitVetted: 5, recruitUnregistered: 5,
    upgradeRevenue: 4, upgradeSecurity: 3, upgradeOperations: 7, upgradeUnderworld: 2,
    licence: 5, vet: 4, launder: 4, reduceHeat: 4, mamasan: 9, districtFocus: 10, aggression: 3,
  },
  hybrid: {
    buyLicensed: 7, buyUnlicensed: 6, recruitVetted: 6, recruitUnregistered: 6,
    upgradeRevenue: 6, upgradeSecurity: 5, upgradeOperations: 5, upgradeUnderworld: 4,
    licence: 6, vet: 6, launder: 6, reduceHeat: 5, mamasan: 7, districtFocus: 5, aggression: 5,
  },
  random: {
    buyLicensed: 1, buyUnlicensed: 1, recruitVetted: 1, recruitUnregistered: 1,
    upgradeRevenue: 1, upgradeSecurity: 1, upgradeOperations: 1, upgradeUnderworld: 1,
    licence: 1, vet: 1, launder: 1, reduceHeat: 1, mamasan: 1, districtFocus: 1, aggression: 1,
  },
};

function scoreFor(
  weights: Weights,
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
): number {
  const player = state.players[playerId];

  switch (action.type) {
    case 'BUY_PROPERTY': {
      const def = PROPERTY_BY_ID[action.propertyId];
      let score = def.licence === 'licensed' ? weights.buyLicensed : weights.buyUnlicensed;
      // Concentrating in a district the player already holds.
      const sameDistrict = ownedProperties(state, playerId).filter(
        (p) => PROPERTY_BY_ID[p.id].district === def.district,
      ).length;
      score += sameDistrict * weights.districtFocus;
      score += def.multiplier / 40;

      // Empire Overhead makes each extra Property progressively less attractive
      // — but an expansion-minded strategy is meant to push through that, so the
      // penalty scales down with how much this agent cares about territory.
      const owned = ownedProperties(state, playerId).length;
      score -= owned * Math.max(0.2, 1.5 - weights.districtFocus * 0.12);

      // Closing in on an Empire Victory is worth paying overhead for.
      if (weights.districtFocus >= 8 && owned >= 6) score += (owned - 5) * 2;

      return score;
    }

    case 'HIRE_MAMASAN': {
      // A Property without a Mamasan earns nothing at all, so this is urgent.
      const property = state.properties[action.propertyId];
      const idle = property.workerIds.length;
      return weights.mamasan + idle * 3;
    }

    case 'RECRUIT_WORKER': {
      const profile = WORKER_BY_ID[action.profileId];
      const base =
        profile.status === 'vetted' ? weights.recruitVetted : weights.recruitUnregistered;
      const heatPenalty = player.heat >= 7 && profile.status === 'unregistered' ? 6 : 0;
      return base + profile.revenue / 2 - heatPenalty;
    }

    case 'BUY_UPGRADE': {
      const def = UPGRADE_BY_ID[action.upgradeDefId];
      const map = {
        revenue: weights.upgradeRevenue,
        security: weights.upgradeSecurity,
        operations: weights.upgradeOperations,
        underworld: weights.upgradeUnderworld,
      };
      let score = map[def.category];
      if (def.category === 'security' && player.heat >= 6) score += 4;
      if (def.tag === 'launder_tier_2' && player.dirtyCash > 20) score += 5;
      return score;
    }

    case 'LICENCE_PROPERTY':
      return weights.licence + (player.heat >= 6 ? 4 : 0);

    case 'VET_WORKER':
      // Vetting matters most late, when Dirty Cash has to become victory value.
      return weights.vet + (state.finalRaidTriggered ? 8 : 0) + (state.round >= 8 ? 3 : 0);

    case 'LAUNDER':
      return weights.launder + Math.min(6, player.dirtyCash / 8) - (action.tier - 1) * 3;

    case 'REDUCE_HEAT':
      return weights.reduceHeat + Math.max(0, player.heat - 5) * 3;

    case 'MOVE_WORKER': {
      // Only worth it to fill an operating Property that has room.
      if (action.toPropertyId === null) return -10;
      const property = state.properties[action.toPropertyId];
      if (!isOperating(state, property)) return -10;
      const room = effectiveCapacity(state, property) - property.workerIds.length;
      return room > 0 ? 2 : -5;
    }

    case 'REOPEN_PROPERTY':
      return 7;

    case 'REPAIR_UPGRADE':
      return 4;

    default:
      return 1;
  }
}

export function createAgent(id: AgentId): Agent {
  const weights = PROFILES[id];

  return {
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),

    scoreAction(state, playerId, action) {
      if (id === 'random') return 1;
      return scoreFor(weights, state, playerId, action);
    },

    chooseCard(state, playerId, rng) {
      const player = state.players[playerId];
      const playable = player.hand.filter((cardId) => canPlayCard(state, playerId, cardId).ok);
      if (playable.length === 0) return null;

      // Hold cards sometimes, so hands are not dumped the instant they are drawn.
      if (id !== 'random' && rng.next() < 0.25) return null;

      const scored = playable.map((cardId) => {
        const def = CARD_BY_ID[state.cards[cardId].defId];
        let score = 5;
        if (def.category === 'dirty_trick') score = weights.aggression;
        if (def.category === 'protection') score = state.players[playerId].heat >= 6 ? 8 : 3;
        if (def.category === 'opportunity') score = 7;
        return { cardId, def, score: score + rng.next() };
      });

      scored.sort((a, b) => b.score - a.score);
      const chosen = scored[0];

      return { cardId: chosen.cardId, target: pickTarget(state, playerId, chosen.def.target, rng) };
    },

    chooseUpkeep(state, playerId) {
      const player = state.players[playerId];
      // Notoriety is permanent, so emergency finance is the last resort.
      if (player.heat < 7) return 'heat';
      const hasUpgrade = ownedProperties(state, playerId).some((p) =>
        p.upgradeIds.some((upgradeId) => !state.upgrades[upgradeId].disabled),
      );
      if (hasUpgrade) return 'disable_upgrade';
      return 'close_property';
    },
  };
}

function pickTarget(
  state: GameState,
  playerId: PlayerId,
  targetType: string,
  rng: RngHandle,
): CardTarget {
  switch (targetType) {
    case 'own_property': {
      const owned = ownedProperties(state, playerId).filter((p) => isOperating(state, p));
      return owned.length ? { propertyId: rng.pick(owned).id } : {};
    }
    case 'own_worker': {
      const workers = state.players[playerId].workers.filter((w) => w.propertyId !== null);
      return workers.length ? { workerId: rng.pick(workers).id } : {};
    }
    case 'rival_property':
    case 'any_property': {
      const rivals = rivalProperties(state, playerId);
      return rivals.length ? { propertyId: rng.pick(rivals).id } : {};
    }
    case 'rival_worker': {
      const workers = rivalWorkers(state, playerId);
      return workers.length ? { workerId: rng.pick(workers).workerId } : {};
    }
    case 'rival_player': {
      // Target whoever is winning — that is what a rational rival would do.
      const rivals = state.playerOrder.filter((id) => id !== playerId);
      if (rivals.length === 0) return {};
      const leader = rivals.reduce((best, id) =>
        cleanNetWorth(state, id) > cleanNetWorth(state, best) ? id : best,
      );
      return { playerId: leader };
    }
    case 'district': {
      const districts = ['laneways', 'waterfront', 'bazaar', 'transit', 'uptown', 'old_quarter'] as const;
      return { district: rng.pick(districts) };
    }
    case 'police': {
      const rivals = rivalProperties(state, playerId);
      return {
        policeId: rng.pick(state.police).id,
        ...(rivals.length ? { propertyId: rng.pick(rivals).id } : {}),
      };
    }
    default:
      return {};
  }
}

/** Picks the highest-scoring legal Action, with a small random tiebreak. */
export function chooseAction(
  agent: Agent,
  state: GameState,
  playerId: PlayerId,
  rng: RngHandle,
): GameAction | null {
  const legal = enumerateActions(state, playerId).filter((entry) => entry.validation.ok);
  if (legal.length === 0) return null;

  let best: GameAction | null = null;
  let bestScore = -Infinity;

  for (const entry of legal) {
    const score = agent.scoreAction(state, playerId, entry.action) + rng.next() * 2;
    if (score > bestScore) {
      bestScore = score;
      best = entry.action;
    }
  }

  // Passing is better than a genuinely bad move.
  if (bestScore < 0) return null;
  return best;
}
