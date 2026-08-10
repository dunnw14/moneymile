import { BALANCE } from '@/content/balance';
import {
  capacityUtilisationPct,
  cleanNetWorth,
  closedProperties,
  controlledDistricts,
  isOperating,
  ownedProperties,
} from '@/engine/selectors';
import { formatMoney } from '@/utils/money';
import type { GameState, PlayerId, VictoryType } from '@/types';

export interface VictoryRequirement {
  label: string;
  met: boolean;
  current: string;
  required: string;
}

export interface VictoryProgress {
  type: VictoryType;
  eligible: boolean;
  requirements: VictoryRequirement[];
}

export function cleanWealthProgress(state: GameState, playerId: PlayerId): VictoryProgress {
  const playerCount = state.playerOrder.length;
  const thresholds = BALANCE.victory.cleanWealth[playerCount] ?? BALANCE.victory.cleanWealth[4];
  const player = state.players[playerId];

  const netWorth = cleanNetWorth(state, playerId);
  const rivals = state.playerOrder.filter((id) => id !== playerId);
  const bestRival = rivals.reduce((max, id) => Math.max(max, cleanNetWorth(state, id)), 0);
  const lead = netWorth - bestRival;

  const requirements: VictoryRequirement[] = [
    {
      label: 'Clean Net Worth',
      met: netWorth >= thresholds.netWorth,
      current: formatMoney(netWorth),
      required: formatMoney(thresholds.netWorth),
    },
    {
      label: 'Clean Cash',
      met: player.cleanCash >= thresholds.cleanCash,
      current: formatMoney(player.cleanCash),
      required: formatMoney(thresholds.cleanCash),
    },
    {
      label: 'Lead over every opponent',
      met: lead >= thresholds.lead,
      current: formatMoney(lead),
      required: formatMoney(thresholds.lead),
    },
  ];

  return {
    type: 'clean_wealth',
    eligible: requirements.every((r) => r.met),
    requirements,
  };
}

export function empireProgress(state: GameState, playerId: PlayerId): VictoryProgress {
  const config = BALANCE.victory.empire;
  const owned = ownedProperties(state, playerId);
  const operating = owned.filter((p) => isOperating(state, p));
  const districts = controlledDistricts(state, playerId);
  const utilisation = capacityUtilisationPct(state, playerId);
  const closed = closedProperties(state, playerId).length;
  const mamasanEverywhere = operating.every((p) => p.mamasanId !== null);

  const requirements: VictoryRequirement[] = [
    {
      label: 'Properties owned',
      met: owned.length >= config.minProperties,
      current: String(owned.length),
      required: String(config.minProperties),
    },
    {
      label: 'Districts controlled',
      met: districts.length >= config.minDistricts,
      current: String(districts.length),
      required: String(config.minDistricts),
    },
    {
      label: 'Capacity utilisation',
      met: utilisation >= config.minCapacityUtilisationPct,
      current: `${utilisation}%`,
      required: `${config.minCapacityUtilisationPct}%`,
    },
    {
      label: 'Mamasan in every operating Property',
      met: mamasanEverywhere,
      current: mamasanEverywhere ? 'yes' : 'no',
      required: 'yes',
    },
    {
      label: 'Closed Properties',
      met: closed <= config.maxClosedProperties,
      current: String(closed),
      required: `${config.maxClosedProperties} or fewer`,
    },
  ];

  return {
    type: 'empire',
    eligible: owned.length > 0 && requirements.every((r) => r.met),
    requirements,
  };
}

export function victoryProgress(state: GameState, playerId: PlayerId): VictoryProgress[] {
  return [cleanWealthProgress(state, playerId), empireProgress(state, playerId)];
}

export function canDeclare(
  state: GameState,
  playerId: PlayerId,
  type: VictoryType,
): boolean {
  if (type === 'clean_wealth') return cleanWealthProgress(state, playerId).eligible;
  if (type === 'empire') return empireProgress(state, playerId).eligible;
  return false;
}

/** Final Raid scoring: highest surviving Clean Net Worth wins. */
export function finalScores(state: GameState): Record<PlayerId, number> {
  const scores: Record<PlayerId, number> = {};
  for (const id of state.playerOrder) {
    scores[id] = cleanNetWorth(state, id);
  }
  return scores;
}

export function leader(state: GameState): PlayerId {
  const scores = finalScores(state);
  return state.playerOrder.reduce((best, id) => (scores[id] > scores[best] ? id : best), state.playerOrder[0]);
}
