import { BALANCE } from '@/content/balance';
import {
  activeUnregisteredWorkers,
  effectiveBaseHeat,
  isOperating,
  ownedProperties,
  policePressure,
  underworldUpgradeCount,
  unlicensedOperatingProperties,
} from '@/engine/selectors';
import { clamp } from '@/utils/money';
import type { GameState, PlayerId } from '@/types';

export interface HeatBreakdown {
  entries: { source: string; value: number }[];
  total: number;
  floor: number;
  final: number;
}

/**
 * Recomputes a player's Heat from scratch each Close phase.
 *
 * Heat is a *state of the empire*, not an accumulating counter — that is what
 * makes closing a Property or licensing one actually reduce it. Heat may never
 * fall below Notoriety, which is what makes Notoriety permanent in practice.
 */
export function computePlayerHeat(
  state: GameState,
  playerId: PlayerId,
  carriedHeat: number,
): HeatBreakdown {
  const player = state.players[playerId];
  const entries: { source: string; value: number }[] = [];

  const unlicensed = unlicensedOperatingProperties(state, playerId);
  if (unlicensed) entries.push({ source: 'Unlicensed Properties', value: unlicensed });

  const unregistered = activeUnregisteredWorkers(state, playerId);
  const unregisteredHeat = Math.floor(unregistered / BALANCE.heat.unregisteredWorkersPerHeat);
  if (unregisteredHeat) {
    entries.push({ source: 'Unregistered Workers', value: unregisteredHeat });
  }

  const underworld = underworldUpgradeCount(state, playerId);
  if (underworld) entries.push({ source: 'Underworld Upgrades', value: underworld });

  // Police standing on top of an operating Property is felt at the player level.
  const pressuredProperties = ownedProperties(state, playerId).filter(
    (p) => isOperating(state, p) && policePressure(state, p.id) >= BALANCE.police.pressureSameHex,
  ).length;
  if (pressuredProperties) {
    entries.push({ source: 'Police on your Properties', value: pressuredProperties });
  }

  const environmentHeat = state.environment.filter((e) => e.defId === 'election_night').length;
  if (environmentHeat && unlicensed > 0) {
    entries.push({ source: 'Election Night', value: environmentHeat });
  }

  const structural = entries.reduce((sum, e) => sum + e.value, 0);

  // Carried heat is the running value after card effects and Heat-reduction
  // Actions; structural heat sets a floor beneath it.
  const total = Math.max(carriedHeat, structural);
  const floor = player.notoriety;
  const final = clamp(Math.max(total, floor), BALANCE.heat.min, BALANCE.heat.max);

  return { entries, total, floor, final };
}

export function propertyHeatFor(state: GameState, propertyId: number): number {
  const property = state.properties[propertyId];
  const base = effectiveBaseHeat(state, property);
  return clamp(base + property.heat, 0, BALANCE.heat.propertyHeatMax);
}

export interface NotorietyTrigger {
  reason: string;
}

/** Checks every Notoriety trigger for a player at the end of their turn. */
export function checkNotorietyTriggers(state: GameState, playerId: PlayerId): NotorietyTrigger[] {
  const player = state.players[playerId];
  const triggers: NotorietyTrigger[] = [];

  if (
    player.stats.consecutiveHighHeatTurns >=
    BALANCE.notoriety.consecutiveHighHeatTurnsForNotoriety
  ) {
    triggers.push({
      reason: `Finished ${player.stats.consecutiveHighHeatTurns} consecutive turns at Heat ${BALANCE.notoriety.highHeatThreshold}+`,
    });
  }

  if (
    player.stats.consecutiveHighUnregisteredRounds >=
    BALANCE.notoriety.consecutiveRoundsForNotoriety
  ) {
    triggers.push({
      reason: `Operated ${BALANCE.notoriety.unregisteredWorkerThreshold}+ Unregistered Workers for ${BALANCE.notoriety.consecutiveRoundsForNotoriety} consecutive rounds`,
    });
  }

  if (
    player.stats.aggressiveCardsThisRound >= BALANCE.notoriety.aggressiveCardsPerRoundForNotoriety
  ) {
    triggers.push({
      reason: `Played ${player.stats.aggressiveCardsThisRound} Dirty Trick cards in one round`,
    });
  }

  return triggers;
}
