import { PROPERTY_BY_ID } from '@/content/properties';
import { WORKER_BY_ID } from '@/content/workers';
import {
  activeWorkersAt,
  countUpgradeTag,
  effectiveCapacity,
  hasMamasanTag,
  isLicensed,
  isOperating,
  mamasanAt,
  ownedProperties,
  upgradesAt,
} from '@/engine/selectors';
import { applyMultiplier } from '@/utils/money';
import type {
  GameState,
  NightOutcome,
  PlayerId,
  PotentialRevenue,
  PropertyState,
  RevenueLine,
  WorkerState,
} from '@/types';
import { environmentRevenueMultiplier } from '@/engine/calculations/environment';

/**
 * Potential Revenue for a player's whole empire, before the Night Wheel is spun.
 *
 * Clean and Dirty are tracked separately the entire way through: a Property
 * multiplier scales both, but Dirty revenue never becomes Clean without an
 * explicit laundering Action.
 */
export function computePotentialRevenue(
  state: GameState,
  playerId: PlayerId,
  outcome: NightOutcome | null = null,
): PotentialRevenue {
  const lines: RevenueLine[] = [];
  let totalClean = 0;
  let totalDirty = 0;

  for (const property of ownedProperties(state, playerId)) {
    if (!isOperating(state, property)) continue;
    const line = computePropertyRevenue(state, property, outcome);
    if (line.clean === 0 && line.dirty === 0 && line.notes.length === 0) continue;
    lines.push(line);
    totalClean += line.clean;
    totalDirty += line.dirty;
  }

  return { clean: totalClean, dirty: totalDirty, lines };
}

export function computePropertyRevenue(
  state: GameState,
  property: PropertyState,
  outcome: NightOutcome | null,
): RevenueLine {
  const def = PROPERTY_BY_ID[property.id];
  const notes: string[] = [];
  const workers = activeWorkersAt(state, property).slice(0, effectiveCapacity(state, property));

  let grossClean = 0;
  let grossDirty = 0;

  const hasBuddy = workers.some((w) => WORKER_BY_ID[w.profileId].tag === 'buddy_bonus');
  let vettedBonusUsed = false;

  for (const worker of workers) {
    const profile = WORKER_BY_ID[worker.profileId];
    let revenue = profile.revenue;

    // --- Worker special rules ---------------------------------------------
    if (profile.tag === 'boutique_uptown_bonus') {
      if (def.archetype === 'boutique' || def.district === 'uptown') revenue += 1; // +$25k
    }
    if (profile.tag === 'big_night_bonus' && outcome === 'big') revenue += 2; // +$50k
    if (profile.tag === 'party_starter') {
      if (outcome === 'big') revenue += 2;
      if (outcome === 'quiet') revenue = 0;
    }
    if (hasBuddy && profile.tag !== 'buddy_bonus') revenue += 1; // Crowd Favourite

    // --- Mamasan worker-level bonuses -------------------------------------
    if (
      !vettedBonusUsed &&
      worker.status === 'vetted' &&
      hasMamasanTag(state, property, 'vetted_bonus')
    ) {
      revenue += 2; // Araya: +$50k
      vettedBonusUsed = true;
    }

    // --- Upgrade worker-level bonuses -------------------------------------
    revenue += countUpgradeTag(state, property, 'per_worker_bonus'); // Premium Bar +$25k

    // --- Conditions --------------------------------------------------------
    if (worker.conditions.hot) revenue += 2;
    if (worker.conditions.disrupted && !ignoresDisruption(state, property)) {
      revenue = Math.round(revenue / 2);
    }

    revenue = Math.max(0, revenue);

    if (worker.status === 'vetted') grossClean += revenue;
    else grossDirty += revenue;
  }

  // --- Property-level multipliers ------------------------------------------
  let multiplier = def.multiplier;

  const revenueUpgradeMultiplier = countUpgradeTag(state, property, 'multiplier_up') * 15; // VIP Room
  multiplier += revenueUpgradeMultiplier;
  if (revenueUpgradeMultiplier) notes.push(`VIP Room +0.${revenueUpgradeMultiplier}`);

  if (hasMamasanTag(state, property, 'multiplier_up')) {
    multiplier += 10; // Pailin
    notes.push('Pailin +0.10');
  }

  if (outcome === 'big') {
    if (hasMamasanTag(state, property, 'big_night_bonus')) {
      multiplier += 10;
      notes.push('Nok +10% on Big Night');
    }
    multiplier += countUpgradeTag(state, property, 'big_night_up') * 25; // Event Space
  }

  if (
    hasMamasanTag(state, property, 'all_vetted_bonus') &&
    workers.length > 0 &&
    workers.every((w) => w.status === 'vetted')
  ) {
    multiplier += 10; // Patcha
    notes.push('Patcha +10% (all Vetted)');
  }

  // Suda: one adjacent friendly Property earns +5%.
  if (property.ownerId && adjacentSudaBonus(state, property)) {
    multiplier += 5;
    notes.push('Suda +5% (adjacent)');
  }

  for (const mod of property.modifiers) {
    if (mod.multiplier !== undefined) {
      multiplier = Math.round((multiplier * mod.multiplier) / 100);
      notes.push(mod.source);
    }
  }

  const envMultiplier = environmentRevenueMultiplier(state, property, outcome);
  if (envMultiplier.multiplier !== 100) {
    multiplier = Math.round((multiplier * envMultiplier.multiplier) / 100);
    notes.push(...envMultiplier.notes);
  }

  multiplier = Math.max(0, multiplier);

  return {
    propertyId: property.id,
    propertyName: def.name,
    clean: applyMultiplier(grossClean, multiplier),
    dirty: applyMultiplier(grossDirty, multiplier),
    notes,
  };
}

function ignoresDisruption(state: GameState, property: PropertyState): boolean {
  return hasMamasanTag(state, property, 'ignore_disrupted');
}

function adjacentSudaBonus(state: GameState, property: PropertyState): boolean {
  if (!property.ownerId) return false;
  const def = PROPERTY_BY_ID[property.id];
  return ownedProperties(state, property.ownerId).some((other) => {
    if (other.id === property.id) return false;
    if (!hasMamasanTag(state, other, 'adjacent_bonus')) return false;
    const otherDef = PROPERTY_BY_ID[other.id];
    const dq = otherDef.hex.q - def.hex.q;
    const dr = otherDef.hex.r - def.hex.r;
    return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2 === 1;
  });
}

/**
 * Applies the Night outcome to a Potential Revenue figure.
 * Marketing Office and the guarantee cards act here, per Property.
 */
export function realiseRevenue(
  state: GameState,
  playerId: PlayerId,
  outcome: NightOutcome,
): { clean: number; dirty: number; lines: RevenueLine[] } {
  const lines: RevenueLine[] = [];
  let clean = 0;
  let dirty = 0;

  for (const property of ownedProperties(state, playerId)) {
    if (!isOperating(state, property)) continue;

    let effectiveOutcome = outcome;
    const notes: string[] = [];

    for (const mod of property.modifiers) {
      if (mod.forceOutcome) {
        effectiveOutcome = mod.forceOutcome;
        notes.push(`${mod.source}: forced ${mod.forceOutcome}`);
      }
      if (mod.treatNormalAsBig && effectiveOutcome === 'normal') {
        effectiveOutcome = 'big';
        notes.push(`${mod.source}: Normal counts as Big`);
      }
      if (mod.guaranteeAtLeastNormal && (effectiveOutcome === 'quiet' || effectiveOutcome === 'trouble')) {
        effectiveOutcome = 'normal';
        notes.push(`${mod.source}: guaranteed Normal`);
      }
    }

    if (effectiveOutcome === 'quiet' && countUpgradeTag(state, property, 'quiet_as_normal') > 0) {
      effectiveOutcome = 'normal';
      notes.push('Marketing Office: Quiet treated as Normal');
    }

    const base = computePropertyRevenue(state, property, effectiveOutcome);
    const outcomeMultiplier = outcomeMultiplierFor(state, property, effectiveOutcome);

    const lineClean = applyMultiplier(base.clean, outcomeMultiplier);
    const lineDirty = applyMultiplier(base.dirty, outcomeMultiplier);

    clean += lineClean;
    dirty += lineDirty;
    lines.push({
      propertyId: property.id,
      propertyName: base.propertyName,
      clean: lineClean,
      dirty: lineDirty,
      notes: [...base.notes, ...notes],
    });
  }

  return { clean, dirty, lines };
}

function outcomeMultiplierFor(
  state: GameState,
  property: PropertyState,
  outcome: NightOutcome,
): number {
  const base: Record<NightOutcome, number> = {
    big: 150,
    normal: 100,
    quiet: 50,
    trouble: 50,
    raid: 0,
  };
  let multiplier = base[outcome];
  if (outcome === 'quiet' && hasMamasanTag(state, property, 'quiet_night_up')) {
    multiplier += 10; // Ratree
  }
  return multiplier;
}

/** Whether a Property still has a working Revenue Upgrade (used by Dirty Tricks). */
export function hasWorkingRevenueUpgrade(state: GameState, property: PropertyState): boolean {
  return upgradesAt(state, property).some(
    (u) => !u.instance.disabled && u.def.category === 'revenue',
  );
}

export function summariseWorker(state: GameState, worker: WorkerState): string {
  const profile = WORKER_BY_ID[worker.profileId];
  const property = worker.propertyId ? state.properties[worker.propertyId] : null;
  const licence = property ? (isLicensed(property) ? 'Licensed' : 'Unlicensed') : 'Unassigned';
  const mamasan = property ? mamasanAt(state, property)?.def.name ?? 'none' : 'none';
  return `${profile.name} · ${worker.status} · ${licence} · Mamasan: ${mamasan}`;
}
