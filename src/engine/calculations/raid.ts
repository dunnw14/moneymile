import { BALANCE } from '@/content/balance';
import { PROPERTY_BY_ID } from '@/content/properties';
import {
  countUpgradeTag,
  effectiveSafety,
  hasMamasanTag,
  isLicensed,
  isOperating,
  ownedProperties,
  policePressure,
  upgradesAt,
  workersAt,
} from '@/engine/selectors';
import { propertyHeatFor } from '@/engine/calculations/heat';
import type { GameState, PlayerId, PropertyId, PropertyState } from '@/types';

export interface RaidAssessment {
  propertyId: PropertyId;
  propertyName: string;
  exposure: { source: string; value: number }[];
  protection: { source: string; value: number }[];
  exposureTotal: number;
  protectionTotal: number;
  score: number;
  level: number;
  label: string;
}

/**
 * Scores a Raid at one Property: exposure minus protection, bucketed into a
 * severity level. Raids should hurt without removing a player from the game,
 * which is why consequences scale by level rather than wiping an empire.
 */
export function assessRaid(
  state: GameState,
  playerId: PlayerId,
  property: PropertyState,
  severityModifier = 0,
): RaidAssessment {
  const player = state.players[playerId];
  const def = PROPERTY_BY_ID[property.id];

  const exposure: { source: string; value: number }[] = [];
  const protection: { source: string; value: number }[] = [];

  if (player.heat > 0) exposure.push({ source: 'Player Heat', value: Math.ceil(player.heat / 2) });
  if (player.notoriety > 0) exposure.push({ source: 'Notoriety', value: player.notoriety });

  const propertyHeat = propertyHeatFor(state, property.id);
  if (propertyHeat > 0) exposure.push({ source: 'Property Heat', value: propertyHeat });

  const pressure = policePressure(state, property.id);
  if (pressure > 0) exposure.push({ source: 'Police proximity', value: pressure });

  if (!isLicensed(property)) exposure.push({ source: 'Unlicensed', value: 2 });

  const unregistered = workersAt(state, property).filter((w) => w.status === 'unregistered').length;
  if (unregistered > 0) exposure.push({ source: 'Unregistered Workers', value: unregistered });

  const underworld = upgradesAt(state, property).filter(
    (u) => !u.instance.disabled && u.def.category === 'underworld',
  ).length;
  if (underworld > 0) exposure.push({ source: 'Underworld Upgrades', value: underworld * 2 });

  // --- Protection ---------------------------------------------------------
  const safety = effectiveSafety(state, property);
  if (safety > 0) protection.push({ source: 'Property Safety', value: safety });

  const securityUpgrades = upgradesAt(state, property).filter(
    (u) => !u.instance.disabled && u.def.category === 'security',
  ).length;
  if (securityUpgrades > 0) {
    protection.push({ source: 'Security Upgrades', value: securityUpgrades });
  }

  if (hasMamasanTag(state, property, 'raid_severity_down')) {
    protection.push({ source: 'Busaba', value: 2 });
  }

  if (!isOperating(state, property)) {
    protection.push({ source: 'Closed for the night', value: 4 });
  }

  if (severityModifier !== 0) {
    protection.push({ source: 'Protection cards', value: severityModifier });
  }

  const exposureTotal = exposure.reduce((sum, e) => sum + e.value, 0);
  const protectionTotal = protection.reduce((sum, p) => sum + p.value, 0);
  const score = exposureTotal - protectionTotal;

  const bucket = [...BALANCE.raid.severityBuckets]
    .reverse()
    .find((b) => score >= b.minScore) ?? BALANCE.raid.severityBuckets[0];

  return {
    propertyId: property.id,
    propertyName: def.name,
    exposure,
    protection,
    exposureTotal,
    protectionTotal,
    score,
    level: bucket.level,
    label: bucket.label,
  };
}

/** The Property a Raid lands on: the most exposed one the player operates. */
export function raidTarget(state: GameState, playerId: PlayerId): PropertyState | null {
  const candidates = ownedProperties(state, playerId).filter((p) => isOperating(state, p));
  if (candidates.length === 0) return null;
  return candidates.reduce((worst, property) => {
    const a = assessRaid(state, playerId, property).score;
    const b = assessRaid(state, playerId, worst).score;
    if (a > b) return property;
    if (a === b && property.id < worst.id) return property;
    return worst;
  }, candidates[0]);
}

export interface RaidConsequences {
  dirtySeized: number;
  workersRemoved: number;
  propertiesClosed: number;
  upgradesDisabled: number;
  heatAdded: number;
  notorietyAdded: number;
}

export function raidConsequences(
  state: GameState,
  playerId: PlayerId,
  assessment: RaidAssessment,
): RaidConsequences {
  const level = Math.max(0, Math.min(assessment.level, BALANCE.raid.dirtySeizedPct.length - 1));
  const player = state.players[playerId];
  const property = state.properties[assessment.propertyId];

  let dirtySeized = Math.round((player.dirtyCash * BALANCE.raid.dirtySeizedPct[level]) / 100);

  // Safe Room shelters a fixed sum of Dirty Cash from seizure.
  const safeRooms = countUpgradeTag(state, property, 'safe_room');
  if (safeRooms > 0) {
    dirtySeized = Math.max(0, dirtySeized - safeRooms * BALANCE.raid.safeRoomProtection);
  }

  const workersRemoved: number = Math.max(
    0,
    BALANCE.raid.workersRemoved[level] - countUpgradeTag(state, property, 'raid_worker_shield'),
  );

  return {
    dirtySeized,
    workersRemoved,
    propertiesClosed: BALANCE.raid.propertiesClosed[level],
    upgradesDisabled: BALANCE.raid.upgradesDisabled[level],
    heatAdded: BALANCE.raid.heatAdded[level],
    notorietyAdded: BALANCE.raid.notorietyAdded[level],
  };
}
