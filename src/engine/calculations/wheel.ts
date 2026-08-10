import { BALANCE } from '@/content/balance';
import { extraRaidChance } from '@/engine/calculations/environment';
import {
  activeUnregisteredWorkers,
  effectiveSafety,
  isOperating,
  maxPolicePressure,
  ownedProperties,
  policePressureDetail,
  underworldUpgradeCount,
  unlicensedOperatingProperties,
} from '@/engine/selectors';
import { clamp } from '@/utils/money';
import type {
  GameState,
  NightOutcome,
  PlayerId,
  WheelBreakdownEntry,
  WheelState,
} from '@/types';

const OUTCOMES: NightOutcome[] = ['big', 'normal', 'quiet', 'trouble', 'raid'];

/**
 * Builds the Night Wheel for a player.
 *
 * Risk is accumulated per source so the UI can explain exactly why the wheel
 * changed. Each risk point past the threshold converts Normal into Trouble and
 * Raid; each point past the volatility threshold additionally converts Quiet
 * into Big — a burning-hot empire is not just more dangerous, it is swingier.
 */
export function computeWheel(state: GameState, playerId: PlayerId): WheelState {
  const player = state.players[playerId];
  const riskSources: { source: string; points: number }[] = [];

  // --- Risk sources --------------------------------------------------------
  if (player.heat > 0) riskSources.push({ source: 'Heat', points: Math.floor(player.heat / 2) });
  if (player.notoriety > 0) riskSources.push({ source: 'Notoriety', points: player.notoriety });

  const pressure = maxPolicePressure(state, playerId);
  if (pressure > 0) riskSources.push({ source: 'Police proximity', points: Math.ceil(pressure / 2) });

  const unlicensed = unlicensedOperatingProperties(state, playerId);
  if (unlicensed > 0) riskSources.push({ source: 'Unlicensed Properties', points: unlicensed });

  const unregistered = activeUnregisteredWorkers(state, playerId);
  if (unregistered > 0) {
    riskSources.push({
      source: 'Unregistered Workers',
      points: Math.floor(unregistered / BALANCE.heat.unregisteredWorkersPerHeat),
    });
  }

  const underworld = underworldUpgradeCount(state, playerId);
  if (underworld > 0) riskSources.push({ source: 'Underworld Upgrades', points: underworld });

  // Security is the only negative source.
  const security = securityReduction(state, playerId);
  if (security > 0) riskSources.push({ source: 'Security', points: -security });

  const filtered = riskSources.filter((r) => r.points !== 0);
  const rawRisk = filtered.reduce((sum, r) => sum + r.points, 0);
  const effectiveRisk = clamp(rawRisk, 0, BALANCE.wheel.maxEffectiveRisk);

  // --- Build the distribution ---------------------------------------------
  const probabilities: Record<NightOutcome, number> = { ...BALANCE.wheel.base };
  const breakdown: WheelBreakdownEntry[] = [
    {
      source: 'Base',
      detail: 'Baseline Night Wheel',
      deltas: { ...BALANCE.wheel.base },
    },
  ];

  // Walk the risk points in source order, attributing each point's effect back
  // to the source that produced it. Negative sources unwind points already applied.
  let cursor = 0;
  for (const source of filtered) {
    const deltas: Partial<Record<NightOutcome, number>> = {};
    const step = source.points > 0 ? 1 : -1;

    for (let i = 0; i < Math.abs(source.points); i++) {
      const pointIndex = step > 0 ? cursor : cursor - 1;
      cursor += step;
      if (cursor < 0) {
        cursor = 0;
        break;
      }
      if (pointIndex >= BALANCE.wheel.maxEffectiveRisk) continue;

      if (pointIndex >= BALANCE.wheel.riskThreshold) {
        addDelta(deltas, 'raid', BALANCE.wheel.perRiskPoint.raid * step);
        addDelta(deltas, 'trouble', BALANCE.wheel.perRiskPoint.trouble * step);
        addDelta(deltas, 'normal', BALANCE.wheel.perRiskPoint.normal * step);
      }
      if (pointIndex >= BALANCE.wheel.volatilityThreshold) {
        addDelta(deltas, 'big', BALANCE.wheel.perVolatilityPoint.big * step);
        addDelta(deltas, 'quiet', BALANCE.wheel.perVolatilityPoint.quiet * step);
      }
    }

    if (Object.keys(deltas).length > 0) {
      for (const outcome of OUTCOMES) {
        probabilities[outcome] += deltas[outcome] ?? 0;
      }
      breakdown.push({
        source: source.source,
        detail: `${source.points > 0 ? '+' : ''}${source.points} risk`,
        deltas,
      });
    } else {
      breakdown.push({
        source: source.source,
        detail:
          source.points > 0
            ? `${source.points} risk (below threshold)`
            : `${source.points} risk`,
        deltas: {},
      });
    }
  }

  // --- Environment ---------------------------------------------------------
  const crackdown = extraRaidChance(state);
  if (crackdown > 0) {
    probabilities.raid += crackdown;
    probabilities.normal -= crackdown;
    breakdown.push({
      source: 'City Crackdown',
      detail: 'Environment',
      deltas: { raid: crackdown, normal: -crackdown },
    });
  }

  // --- Clamp and normalise to exactly 100 ----------------------------------
  for (const outcome of OUTCOMES) {
    probabilities[outcome] = Math.max(0, probabilities[outcome]);
  }
  normaliseTo100(probabilities);

  return { probabilities, breakdown, effectiveRisk, riskSources: filtered };
}

function addDelta(
  deltas: Partial<Record<NightOutcome, number>>,
  outcome: NightOutcome,
  value: number,
): void {
  deltas[outcome] = (deltas[outcome] ?? 0) + value;
}

/**
 * Forces the distribution to total exactly 100 (integrity rule 14) using
 * largest-remainder, which keeps the visual wheel honest.
 */
function normaliseTo100(probabilities: Record<NightOutcome, number>): void {
  const total = OUTCOMES.reduce((sum, o) => sum + probabilities[o], 0);
  if (total === 100) return;
  if (total === 0) {
    probabilities.normal = 100;
    return;
  }

  const scaled = OUTCOMES.map((outcome) => {
    const exact = (probabilities[outcome] * 100) / total;
    return { outcome, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  let assigned = scaled.reduce((sum, s) => sum + s.floor, 0);
  scaled.sort((a, b) => b.remainder - a.remainder);
  let index = 0;
  while (assigned < 100) {
    scaled[index % scaled.length].floor += 1;
    assigned += 1;
    index += 1;
  }

  for (const entry of scaled) {
    probabilities[entry.outcome] = entry.floor;
  }
}

function securityReduction(state: GameState, playerId: PlayerId): number {
  // Every 3 points of Safety across operating Properties buys back one risk point.
  const properties = ownedProperties(state, playerId).filter((p) => isOperating(state, p));
  if (properties.length === 0) return 0;
  const totalSafety = properties.reduce((sum, p) => sum + effectiveSafety(state, p), 0);
  const averageSafety = totalSafety / properties.length;
  return Math.floor(averageSafety / 2);
}

/** Picks an outcome from the wheel using the seeded RNG stream. */
export function spinWheel(
  probabilities: Record<NightOutcome, number>,
  roll: number,
): NightOutcome {
  let cumulative = 0;
  const target = roll * 100;
  for (const outcome of OUTCOMES) {
    cumulative += probabilities[outcome];
    if (target < cumulative) return outcome;
  }
  return 'normal';
}

/** Explains one outcome's probability as a list of contributions. */
export function explainOutcome(
  wheel: WheelState,
  outcome: NightOutcome,
): { source: string; delta: number }[] {
  return wheel.breakdown
    .map((entry) => ({ source: entry.source, delta: entry.deltas[outcome] ?? 0 }))
    .filter((entry) => entry.delta !== 0);
}

export function policeExplanation(state: GameState, playerId: PlayerId): string[] {
  const lines: string[] = [];
  for (const property of ownedProperties(state, playerId)) {
    if (!isOperating(state, property)) continue;
    for (const detail of policePressureDetail(state, property.id)) {
      lines.push(
        `${detail.unit.name} is ${detail.distance === 0 ? 'on' : `${detail.distance} hex from`} ${
          property.id
        } (+${detail.pressure})`,
      );
    }
  }
  return lines;
}
