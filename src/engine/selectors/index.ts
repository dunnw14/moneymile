import { BALANCE } from '@/content/balance';
import { DISTRICTS } from '@/content/districts';
import { MAMASAN_BY_ID } from '@/content/mamasans';
import { POLICE_BY_ID } from '@/content/police';
import { PROPERTIES, PROPERTY_BY_ID } from '@/content/properties';
import { UPGRADE_BY_ID } from '@/content/upgrades';
import { WORKER_BY_ID } from '@/content/workers';
import { hexDistance } from '@/utils/hex';
import type {
  DistrictId,
  GameState,
  MamasanTag,
  PlayerId,
  PropertyId,
  PropertyState,
  UpgradeTag,
  WorkerState,
} from '@/types';

// ---------------------------------------------------------------------------
// Ownership and lookup
// ---------------------------------------------------------------------------

export function activePlayerId(state: GameState): PlayerId {
  return state.playerOrder[state.activePlayerIndex];
}

export function activePlayer(state: GameState) {
  return state.players[activePlayerId(state)];
}

export function ownedProperties(state: GameState, playerId: PlayerId): PropertyState[] {
  return Object.values(state.properties).filter((p) => p.ownerId === playerId);
}

export function isOpen(state: GameState, property: PropertyState): boolean {
  return property.closedUntilRound === null || property.closedUntilRound <= state.round;
}

export function closedProperties(state: GameState, playerId: PlayerId): PropertyState[] {
  return ownedProperties(state, playerId).filter((p) => !isOpen(state, p));
}

/** A Property operates when it is open and has a Mamasan (or a stand-in effect). */
export function isOperating(state: GameState, property: PropertyState): boolean {
  if (property.ownerId === null) return false;
  if (!isOpen(state, property)) return false;
  if (property.mamasanId !== null) return true;
  return hasUpgradeTag(state, property, 'no_mamasan_needed') || hasModifier(property, 'no_mamasan');
}

export function hasModifier(property: PropertyState, source: string): boolean {
  return property.modifiers.some((m) => m.source === source);
}

export function findWorker(state: GameState, workerId: string): WorkerState | undefined {
  for (const playerId of state.playerOrder) {
    const worker = state.players[playerId].workers.find((w) => w.id === workerId);
    if (worker) return worker;
  }
  return undefined;
}

export function workersAt(state: GameState, property: PropertyState): WorkerState[] {
  if (property.ownerId === null) return [];
  const owner = state.players[property.ownerId];
  return property.workerIds
    .map((id) => owner.workers.find((w) => w.id === id))
    .filter((w): w is WorkerState => Boolean(w));
}

/** Workers that will actually produce revenue tonight. */
export function activeWorkersAt(state: GameState, property: PropertyState): WorkerState[] {
  return workersAt(state, property).filter((w) => !w.conditions.unavailable);
}

// ---------------------------------------------------------------------------
// Upgrades and Mamasans
// ---------------------------------------------------------------------------

export function upgradesAt(state: GameState, property: PropertyState) {
  return property.upgradeIds
    .map((id) => state.upgrades[id])
    .filter(Boolean)
    .map((instance) => ({ instance, def: UPGRADE_BY_ID[instance.defId] }));
}

export function hasUpgradeTag(
  state: GameState,
  property: PropertyState,
  tag: UpgradeTag,
): boolean {
  return upgradesAt(state, property).some((u) => !u.instance.disabled && u.def.tag === tag);
}

export function countUpgradeTag(
  state: GameState,
  property: PropertyState,
  tag: UpgradeTag,
): number {
  return upgradesAt(state, property).filter((u) => !u.instance.disabled && u.def.tag === tag).length;
}

export function mamasanAt(state: GameState, property: PropertyState) {
  if (!property.mamasanId || !property.ownerId) return null;
  const owner = state.players[property.ownerId];
  const mamasan = owner.mamasans.find((m) => m.id === property.mamasanId);
  if (!mamasan) return null;
  return { state: mamasan, def: MAMASAN_BY_ID[mamasan.defId] };
}

export function hasMamasanTag(
  state: GameState,
  property: PropertyState,
  tag: MamasanTag,
): boolean {
  return mamasanAt(state, property)?.def.tag === tag;
}

// ---------------------------------------------------------------------------
// Derived Property stats
// ---------------------------------------------------------------------------

export function effectiveCapacity(state: GameState, property: PropertyState): number {
  const def = PROPERTY_BY_ID[property.id];
  let capacity = def.capacity;
  capacity += countUpgradeTag(state, property, 'capacity_up');
  capacity += countUpgradeTag(state, property, 'hidden_room');
  if (hasMamasanTag(state, property, 'capacity_up')) capacity += 1;
  for (const mod of property.modifiers) capacity += mod.capacityDelta ?? 0;
  if (property.ownerId && controlsDistrict(state, property.ownerId, def.district) && def.district === 'bazaar') {
    // Bazaar control: one Property gains +1 Capacity. Applied to the owner's
    // highest-capacity Bazaar Property for determinism.
    if (bazaarBonusProperty(state, property.ownerId) === property.id) capacity += 1;
  }
  return Math.max(0, capacity);
}

function bazaarBonusProperty(state: GameState, playerId: PlayerId): PropertyId | null {
  const candidates = ownedProperties(state, playerId)
    .filter((p) => PROPERTY_BY_ID[p.id].district === 'bazaar')
    .sort((a, b) => {
      const diff = PROPERTY_BY_ID[b.id].capacity - PROPERTY_BY_ID[a.id].capacity;
      return diff !== 0 ? diff : a.id - b.id;
    });
  return candidates[0]?.id ?? null;
}

export function effectiveSafety(state: GameState, property: PropertyState): number {
  const def = PROPERTY_BY_ID[property.id];
  let safety = def.safety;
  safety += countUpgradeTag(state, property, 'safety_up_1');
  safety += countUpgradeTag(state, property, 'safety_up_2') * 2;
  if (hasMamasanTag(state, property, 'safety_up')) safety += 1;
  for (const mod of property.modifiers) safety += mod.safetyDelta ?? 0;
  if (
    property.ownerId &&
    def.district === 'uptown' &&
    isLicensed(property) &&
    controlsDistrict(state, property.ownerId, 'uptown')
  ) {
    safety += 1;
  }
  return Math.max(0, safety);
}

export function isLicensed(property: PropertyState): boolean {
  if (property.modifiers.some((m) => m.licenceSuspended)) return false;
  return property.licensed;
}

export function effectiveUpgradeSlots(state: GameState, property: PropertyState): number {
  const def = PROPERTY_BY_ID[property.id];
  void state;
  return def.upgradeSlots;
}

export function effectiveBaseHeat(state: GameState, property: PropertyState): number {
  const def = PROPERTY_BY_ID[property.id];
  let heat = def.baseHeat;
  if (hasMamasanTag(state, property, 'base_heat_down')) heat -= 1;
  heat += countUpgradeTag(state, property, 'hidden_room');
  return Math.max(0, heat);
}

export function effectiveUpkeep(state: GameState, property: PropertyState): number {
  const def = PROPERTY_BY_ID[property.id];
  let upkeep = def.upkeep;
  upkeep += countUpgradeTag(state, property, 'safety_up_2') * 2; // Private Security
  if (hasMamasanTag(state, property, 'upkeep_down')) upkeep -= 2;
  if (
    hasMamasanTag(state, property, 'waive_upkeep_large_empire') &&
    property.ownerId &&
    ownedProperties(state, property.ownerId).length >= 4
  ) {
    return 0;
  }
  if (!isOperating(state, property)) {
    upkeep = Math.floor(upkeep / BALANCE.upkeep.closedPropertyUpkeepDivisor);
  }
  return Math.max(0, upkeep);
}

// ---------------------------------------------------------------------------
// Districts
// ---------------------------------------------------------------------------

export function districtOwnership(state: GameState, district: DistrictId): Record<PlayerId, number> {
  const counts: Record<PlayerId, number> = {};
  const def = DISTRICTS.find((d) => d.id === district)!;
  for (const propertyId of def.properties) {
    const owner = state.properties[propertyId].ownerId;
    if (owner) counts[owner] = (counts[owner] ?? 0) + 1;
  }
  return counts;
}

export function controlsDistrict(
  state: GameState,
  playerId: PlayerId,
  district: DistrictId,
): boolean {
  return (districtOwnership(state, district)[playerId] ?? 0) >= BALANCE.district.controlThreshold;
}

export function controlledDistricts(state: GameState, playerId: PlayerId): DistrictId[] {
  return DISTRICTS.filter((d) => controlsDistrict(state, playerId, d.id)).map((d) => d.id);
}

// ---------------------------------------------------------------------------
// Police
// ---------------------------------------------------------------------------

/** Enforcement pressure a single Property is under, per the proximity table. */
export function policePressure(state: GameState, propertyId: PropertyId): number {
  const hex = PROPERTY_BY_ID[propertyId].hex;
  let pressure = 0;
  for (const unit of state.police) {
    const distance = hexDistance(unit.hex, hex);
    if (distance === 0) pressure += BALANCE.police.pressureSameHex;
    else if (distance === 1) pressure += BALANCE.police.pressureAdjacent;
    else if (distance === 2 && unit.id === 'financial_crimes') {
      pressure += BALANCE.police.pressureTwoHexFcu;
    }
  }
  return pressure;
}

export function policePressureDetail(state: GameState, propertyId: PropertyId) {
  const hex = PROPERTY_BY_ID[propertyId].hex;
  return state.police
    .map((unit) => {
      const distance = hexDistance(unit.hex, hex);
      let pressure = 0;
      if (distance === 0) pressure = BALANCE.police.pressureSameHex;
      else if (distance === 1) pressure = BALANCE.police.pressureAdjacent;
      else if (distance === 2 && unit.id === 'financial_crimes') {
        pressure = BALANCE.police.pressureTwoHexFcu;
      }
      return { unit: POLICE_BY_ID[unit.id], distance, pressure };
    })
    .filter((entry) => entry.pressure > 0);
}

/** The worst pressure any of a player's operating Properties is under. */
export function maxPolicePressure(state: GameState, playerId: PlayerId): number {
  const properties = ownedProperties(state, playerId).filter((p) => isOperating(state, p));
  return properties.reduce((max, p) => Math.max(max, policePressure(state, p.id)), 0);
}

export function propertyAtHex(state: GameState, q: number, r: number): PropertyState | null {
  const def = PROPERTIES.find((p) => p.hex.q === q && p.hex.r === r);
  return def ? state.properties[def.id] : null;
}

// ---------------------------------------------------------------------------
// Empire measurements
// ---------------------------------------------------------------------------

export function totalWorkerCapacity(state: GameState, playerId: PlayerId): number {
  return ownedProperties(state, playerId)
    .filter((p) => isOperating(state, p))
    .reduce((sum, p) => sum + effectiveCapacity(state, p), 0);
}

export function assignedWorkerCount(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  return player.workers.filter((w) => {
    if (w.propertyId === null) return false;
    const property = state.properties[w.propertyId];
    return isOperating(state, property);
  }).length;
}

export function capacityUtilisationPct(state: GameState, playerId: PlayerId): number {
  const capacity = totalWorkerCapacity(state, playerId);
  if (capacity === 0) return 0;
  return Math.round((assignedWorkerCount(state, playerId) / capacity) * 100);
}

export function activeUnregisteredWorkers(state: GameState, playerId: PlayerId): number {
  const player = state.players[playerId];
  return player.workers.filter(
    (w) => w.status === 'unregistered' && w.propertyId !== null && !w.conditions.unavailable,
  ).length;
}

export function unlicensedOperatingProperties(state: GameState, playerId: PlayerId): number {
  return ownedProperties(state, playerId).filter(
    (p) => isOperating(state, p) && !isLicensed(p),
  ).length;
}

export function underworldUpgradeCount(state: GameState, playerId: PlayerId): number {
  return ownedProperties(state, playerId).reduce(
    (sum, p) =>
      sum +
      upgradesAt(state, p).filter((u) => !u.instance.disabled && u.def.category === 'underworld')
        .length,
    0,
  );
}

// ---------------------------------------------------------------------------
// Clean Net Worth
// ---------------------------------------------------------------------------

export interface NetWorthBreakdown {
  cleanCash: number;
  licensedProperties: number;
  unlicensedProperties: number;
  legalUpgrades: number;
  total: number;
}

export function cleanNetWorth(state: GameState, playerId: PlayerId): number {
  return cleanNetWorthBreakdown(state, playerId).total;
}

export function cleanNetWorthBreakdown(state: GameState, playerId: PlayerId): NetWorthBreakdown {
  const player = state.players[playerId];
  const scoring = BALANCE.scoring;

  let licensedValue = 0;
  let unlicensedValue = 0;
  let upgradeValue = 0;

  for (const property of ownedProperties(state, playerId)) {
    const def = PROPERTY_BY_ID[property.id];

    if (!isOpen(state, property)) {
      // Closed assets score nothing.
      continue;
    }

    if (isLicensed(property)) {
      licensedValue += Math.round((def.cost * scoring.licensedPropertyPct) / 100);
    } else {
      unlicensedValue += Math.round((def.cost * scoring.unlicensedPropertyPct) / 100);
    }

    for (const { instance, def: upgradeDef } of upgradesAt(state, property)) {
      if (instance.disabled) continue;
      if (upgradeDef.category === 'underworld') continue; // scores zero
      upgradeValue += Math.round((upgradeDef.cost * scoring.legalUpgradePct) / 100);
    }
  }

  const cleanCash = Math.round((player.cleanCash * scoring.cleanCashPct) / 100);

  return {
    cleanCash,
    licensedProperties: licensedValue,
    unlicensedProperties: unlicensedValue,
    legalUpgrades: upgradeValue,
    total: cleanCash + licensedValue + unlicensedValue + upgradeValue,
  };
}

// ---------------------------------------------------------------------------
// Laundering
// ---------------------------------------------------------------------------

export function availableLaunderTiers(state: GameState, playerId: PlayerId): number[] {
  let maxTier: number = BALANCE.laundering.baseTiersAvailable;
  for (const property of ownedProperties(state, playerId)) {
    if (!isOperating(state, property)) continue;
    if (hasUpgradeTag(state, property, 'launder_tier_2')) maxTier = Math.max(maxTier, 2);
    if (PROPERTY_BY_ID[property.id].archetype === 'cash_business') maxTier = Math.max(maxTier, 2);
    if (hasUpgradeTag(state, property, 'offshore_books')) maxTier = Math.max(maxTier, 4);
  }
  return BALANCE.laundering.tiers.filter((t) => t.tier <= maxTier).map((t) => t.tier);
}

export function hasEnvironment(state: GameState, defId: string): boolean {
  return state.environment.some((e) => e.defId === defId);
}

export function workerProfile(worker: WorkerState) {
  return WORKER_BY_ID[worker.profileId];
}
