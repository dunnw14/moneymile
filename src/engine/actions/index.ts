import { BALANCE } from '@/content/balance';
import { MAMASAN_BY_ID } from '@/content/mamasans';
import { PROPERTY_BY_ID } from '@/content/properties';
import { UPGRADE_BY_ID } from '@/content/upgrades';
import { WORKER_BY_ID } from '@/content/workers';
import {
  launderingBlocked,
  propertyPriceAdjustment,
  vettingCostAdjustment,
} from '@/engine/calculations/environment';
import {
  availableLaunderTiers,
  controlsDistrict,
  effectiveCapacity,
  effectiveUpgradeSlots,
  hasMamasanTag,
  hasUpgradeTag,
  isLicensed,
  isOpen,
  isOperating,
  ownedProperties,
  upgradesAt,
} from '@/engine/selectors';
import { formatMoney } from '@/utils/money';
import type { GameState, MoneyUnits, PlayerId, PropertyId } from '@/types';

export type GameAction =
  | { type: 'BUY_PROPERTY'; propertyId: PropertyId; mamasanDefId?: string }
  | { type: 'RECRUIT_WORKER'; profileId: string; propertyId: PropertyId }
  | { type: 'MOVE_WORKER'; workerId: string; toPropertyId: PropertyId | null }
  | { type: 'HIRE_MAMASAN'; mamasanDefId: string; propertyId: PropertyId }
  | { type: 'MOVE_MAMASAN'; mamasanId: string; toPropertyId: PropertyId }
  | { type: 'BUY_UPGRADE'; upgradeDefId: string; propertyId: PropertyId }
  | { type: 'LICENCE_PROPERTY'; propertyId: PropertyId }
  | { type: 'VET_WORKER'; workerId: string }
  | { type: 'LAUNDER'; tier: number }
  | { type: 'REDUCE_HEAT' }
  | { type: 'REPAIR_UPGRADE'; upgradeId: string }
  | { type: 'REOPEN_PROPERTY'; propertyId: PropertyId };

export type ActionKind = GameAction['type'];

export interface Validation {
  ok: boolean;
  /** Player-facing explanation, phrased the way the spec's Action UX asks for. */
  reason?: string;
  /** Clean Cash cost, for the confirmation preview. */
  cleanCost?: MoneyUnits;
  dirtyCost?: MoneyUnits;
  costsAction?: boolean;
  heatDelta?: number;
  notorietyDelta?: number;
}

const OK: Validation = { ok: true, costsAction: true };

/**
 * Pure validation. Never mutates. The UI calls this to decide whether a button
 * is enabled *and* what to say when it is not.
 */
export function validateAction(
  state: GameState,
  playerId: PlayerId,
  action: GameAction,
): Validation {
  if (state.gameOver) return { ok: false, reason: 'The game is over.' };
  if (state.phase !== 'operate') {
    return { ok: false, reason: 'Actions can only be taken during the Operate phase.' };
  }
  if (state.playerOrder[state.activePlayerIndex] !== playerId) {
    return { ok: false, reason: 'It is not your turn.' };
  }

  const player = state.players[playerId];
  const free = isFreeAction(state, playerId, action);
  if (player.actionsRemaining <= 0 && !free) {
    return { ok: false, reason: 'No Actions remaining this turn.' };
  }

  switch (action.type) {
    case 'BUY_PROPERTY':
      return validateBuyProperty(state, playerId, action.propertyId, action.mamasanDefId);
    case 'RECRUIT_WORKER':
      return validateRecruit(state, playerId, action.profileId, action.propertyId);
    case 'MOVE_WORKER':
      return validateMoveWorker(state, playerId, action.workerId, action.toPropertyId);
    case 'HIRE_MAMASAN':
      return validateHireMamasan(state, playerId, action.mamasanDefId, action.propertyId);
    case 'MOVE_MAMASAN':
      return validateMoveMamasan(state, playerId, action.mamasanId, action.toPropertyId);
    case 'BUY_UPGRADE':
      return validateBuyUpgrade(state, playerId, action.upgradeDefId, action.propertyId);
    case 'LICENCE_PROPERTY':
      return validateLicence(state, playerId, action.propertyId);
    case 'VET_WORKER':
      return validateVet(state, playerId, action.workerId);
    case 'LAUNDER':
      return validateLaunder(state, playerId, action.tier);
    case 'REDUCE_HEAT':
      return validateReduceHeat(state, playerId);
    case 'REPAIR_UPGRADE':
      return validateRepair(state, playerId, action.upgradeId);
    case 'REOPEN_PROPERTY':
      return validateReopen(state, playerId, action.propertyId);
    default:
      return { ok: false, reason: 'Unknown Action.' };
  }
}

/** Some card effects make a specific Action free for the turn. */
export function isFreeAction(state: GameState, playerId: PlayerId, action: GameAction): boolean {
  const player = state.players[playerId];
  if (
    player.turnEffects.freeMamasanAction &&
    (action.type === 'HIRE_MAMASAN' || action.type === 'MOVE_MAMASAN')
  ) {
    return true;
  }
  if (action.type === 'MOVE_WORKER') {
    return workerMoveIsFree(state, playerId, action.workerId, action.toPropertyId);
  }
  return false;
}

export function workerMoveIsFree(
  state: GameState,
  playerId: PlayerId,
  workerId: string,
  toPropertyId: PropertyId | null,
): boolean {
  const player = state.players[playerId];
  const worker = player.workers.find((w) => w.id === workerId);
  if (!worker) return false;

  // Transit district control: first Worker movement each turn is free.
  if (
    player.stats.freeWorkerMovesUsed === 0 &&
    controlsDistrict(state, playerId, 'transit')
  ) {
    return true;
  }

  // Mobile Host: first movement each round is free.
  if (WORKER_BY_ID[worker.profileId].tag === 'free_move' && player.stats.freeWorkerMovesUsed === 0) {
    return true;
  }

  // Staff Transport / Lek: free movement into a specific Property.
  if (toPropertyId !== null) {
    const target = state.properties[toPropertyId];
    if (target && player.stats.freeWorkerMovesUsed === 0) {
      if (hasUpgradeTag(state, target, 'free_worker_move')) return true;
      if (hasMamasanTag(state, target, 'free_worker_move_in')) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

export function propertyPrice(
  state: GameState,
  playerId: PlayerId,
  propertyId: PropertyId,
  mamasanDefId?: string,
): MoneyUnits {
  const def = PROPERTY_BY_ID[propertyId];
  const player = state.players[playerId];
  let price = def.cost + propertyPriceAdjustment(state);
  price -= player.turnEffects.propertyDiscount;
  if (mamasanDefId && MAMASAN_BY_ID[mamasanDefId]?.tag === 'purchase_discount') {
    price -= 2; // Dao: -$50k
  }
  return Math.max(0, price);
}

function validateBuyProperty(
  state: GameState,
  playerId: PlayerId,
  propertyId: PropertyId,
  mamasanDefId?: string,
): Validation {
  const property = state.properties[propertyId];
  if (!property) return { ok: false, reason: 'No such Property.' };
  if (property.ownerId !== null) {
    return { ok: false, reason: 'Cannot buy Property: it is already owned.' };
  }

  const price = propertyPrice(state, playerId, propertyId, mamasanDefId);
  const mamasanCost = mamasanDefId ? MAMASAN_BY_ID[mamasanDefId].cost : 0;
  const total = price + mamasanCost;
  const player = state.players[playerId];

  if (player.cleanCash < total) {
    return {
      ok: false,
      reason: `Cannot buy Property: requires ${formatMoney(total)} Clean Cash, you have ${formatMoney(player.cleanCash)}.`,
      cleanCost: total,
    };
  }

  if (mamasanDefId && !state.mamasanSupply.includes(mamasanDefId)) {
    return { ok: false, reason: 'That Mamasan is no longer available.' };
  }

  return { ...OK, cleanCost: total };
}

export function recruitCost(
  state: GameState,
  playerId: PlayerId,
  profileId: string,
  propertyId: PropertyId,
): MoneyUnits {
  const profile = WORKER_BY_ID[profileId];
  const property = state.properties[propertyId];
  const player = state.players[playerId];
  let cost = profile.cost;

  if (hasUpgradeTag(state, property, 'recruit_discount')) cost -= 2; // Recruitment Desk
  if (hasMamasanTag(state, property, 'recruit_discount') && player.stats.recruitsThisRound === 0) {
    cost -= 2; // Anong
  }
  if (
    profile.status === 'unregistered' &&
    controlsDistrict(state, playerId, 'laneways') &&
    player.stats.recruitsThisRound === 0
  ) {
    cost -= 2; // Laneways control
  }

  return Math.max(0, cost);
}

function validateRecruit(
  state: GameState,
  playerId: PlayerId,
  profileId: string,
  propertyId: PropertyId,
): Validation {
  const profile = WORKER_BY_ID[profileId];
  if (!profile) return { ok: false, reason: 'No such Worker profile.' };
  if ((state.workerSupply[profileId] ?? 0) <= 0) {
    return { ok: false, reason: `Cannot recruit: no ${profile.name} remains in the supply.` };
  }

  const property = state.properties[propertyId];
  if (!property || property.ownerId !== playerId) {
    return { ok: false, reason: 'Cannot recruit: you do not own that Property.' };
  }
  if (!isOperating(state, property)) {
    return { ok: false, reason: 'Cannot recruit: the Property is not operating (no Mamasan or closed).' };
  }
  if (property.workerIds.length >= effectiveCapacity(state, property)) {
    return { ok: false, reason: 'Cannot recruit: the Property is at Worker Capacity.' };
  }

  const cost = recruitCost(state, playerId, profileId, propertyId);
  const player = state.players[playerId];
  const payingDirty = profile.status === 'unregistered' && player.cleanCash < cost;

  if (payingDirty ? player.dirtyCash < cost : player.cleanCash < cost) {
    return {
      ok: false,
      reason: `Cannot recruit ${profile.name}: requires ${formatMoney(cost)}.`,
      cleanCost: cost,
    };
  }

  return {
    ...OK,
    cleanCost: payingDirty ? 0 : cost,
    dirtyCost: payingDirty ? cost : 0,
    heatDelta: profile.heat,
  };
}

function validateMoveWorker(
  state: GameState,
  playerId: PlayerId,
  workerId: string,
  toPropertyId: PropertyId | null,
): Validation {
  const player = state.players[playerId];
  const worker = player.workers.find((w) => w.id === workerId);
  if (!worker) return { ok: false, reason: 'No such Worker.' };
  if (worker.propertyId === toPropertyId) {
    return { ok: false, reason: 'The Worker is already there.' };
  }

  if (toPropertyId !== null) {
    const target = state.properties[toPropertyId];
    if (!target || target.ownerId !== playerId) {
      return { ok: false, reason: 'Cannot move Worker: you do not own that Property.' };
    }
    if (!isOpen(state, target)) {
      return { ok: false, reason: 'Cannot move Worker: that Property is closed.' };
    }
    if (target.workerIds.length >= effectiveCapacity(state, target)) {
      return { ok: false, reason: 'Cannot move Worker: the Property is at Worker Capacity.' };
    }
    if (districtBlocked(state, PROPERTY_BY_ID[toPropertyId].district)) {
      return { ok: false, reason: 'Cannot move Worker: a Street Blockade is in force in that District.' };
    }
  }

  if (worker.propertyId !== null && districtBlocked(state, PROPERTY_BY_ID[worker.propertyId].district)) {
    return { ok: false, reason: 'Cannot move Worker: a Street Blockade is in force in that District.' };
  }

  return { ...OK, costsAction: !workerMoveIsFree(state, playerId, workerId, toPropertyId) };
}

function districtBlocked(state: GameState, district: string): boolean {
  return state.environment.some(
    (env) => env.defId === 'street_blockade' && env.data?.district === district,
  );
}

function validateHireMamasan(
  state: GameState,
  playerId: PlayerId,
  mamasanDefId: string,
  propertyId: PropertyId,
): Validation {
  const def = MAMASAN_BY_ID[mamasanDefId];
  if (!def) return { ok: false, reason: 'No such Mamasan.' };
  if (!state.mamasanSupply.includes(mamasanDefId)) {
    return { ok: false, reason: `Cannot hire ${def.name}: already hired by someone.` };
  }

  const property = state.properties[propertyId];
  if (!property || property.ownerId !== playerId) {
    return { ok: false, reason: 'Cannot hire Mamasan: you do not own that Property.' };
  }
  if (property.mamasanId !== null) {
    return { ok: false, reason: 'Cannot hire Mamasan: that Property already has one.' };
  }

  const player = state.players[playerId];
  if (player.cleanCash < def.cost) {
    return {
      ok: false,
      reason: `Cannot hire ${def.name}: requires ${formatMoney(def.cost)} Clean Cash.`,
      cleanCost: def.cost,
    };
  }

  return { ...OK, cleanCost: def.cost, costsAction: !player.turnEffects.freeMamasanAction };
}

function validateMoveMamasan(
  state: GameState,
  playerId: PlayerId,
  mamasanId: string,
  toPropertyId: PropertyId,
): Validation {
  const player = state.players[playerId];
  const mamasan = player.mamasans.find((m) => m.id === mamasanId);
  if (!mamasan) return { ok: false, reason: 'No such Mamasan.' };

  const target = state.properties[toPropertyId];
  if (!target || target.ownerId !== playerId) {
    return { ok: false, reason: 'Cannot move Mamasan: you do not own that Property.' };
  }
  if (target.mamasanId !== null && target.mamasanId !== mamasanId) {
    return { ok: false, reason: 'Cannot move Mamasan: that Property already has one.' };
  }
  if (mamasan.propertyId === toPropertyId) {
    return { ok: false, reason: 'The Mamasan is already there.' };
  }

  return { ...OK, costsAction: !player.turnEffects.freeMamasanAction };
}

export function upgradePrice(
  state: GameState,
  playerId: PlayerId,
  upgradeDefId: string,
): MoneyUnits {
  const def = UPGRADE_BY_ID[upgradeDefId];
  const player = state.players[playerId];
  let cost = def.cost;
  if (def.category !== 'underworld') cost -= player.turnEffects.upgradeDiscount;
  return Math.max(0, cost);
}

function validateBuyUpgrade(
  state: GameState,
  playerId: PlayerId,
  upgradeDefId: string,
  propertyId: PropertyId,
): Validation {
  const def = UPGRADE_BY_ID[upgradeDefId];
  if (!def) return { ok: false, reason: 'No such Upgrade.' };
  if ((state.upgradeSupply[upgradeDefId] ?? 0) <= 0) {
    return { ok: false, reason: `Cannot buy ${def.name}: none remain in the supply.` };
  }

  const property = state.properties[propertyId];
  if (!property || property.ownerId !== playerId) {
    return { ok: false, reason: 'Cannot buy Upgrade: you do not own that Property.' };
  }
  if (property.upgradeIds.length >= effectiveUpgradeSlots(state, property)) {
    return { ok: false, reason: 'Cannot buy Upgrade: no Upgrade Slot available.' };
  }

  const cost = upgradePrice(state, playerId, upgradeDefId);
  const player = state.players[playerId];

  if (def.dirtyPurchase) {
    if (player.dirtyCash < cost) {
      return {
        ok: false,
        reason: `Cannot buy ${def.name}: requires ${formatMoney(cost)} Dirty Cash.`,
        dirtyCost: cost,
      };
    }
    return { ...OK, dirtyCost: cost, heatDelta: 1 };
  }

  if (player.cleanCash < cost) {
    return {
      ok: false,
      reason: `Cannot buy ${def.name}: requires ${formatMoney(cost)} Clean Cash.`,
      cleanCost: cost,
    };
  }

  return {
    ...OK,
    cleanCost: cost,
    notorietyDelta: def.tag === 'offshore_books' ? 1 : 0,
  };
}

export function licenceCost(state: GameState, playerId: PlayerId): MoneyUnits {
  const player = state.players[playerId];
  return Math.max(0, BALANCE.licensing.cost - player.turnEffects.licenceDiscount);
}

function validateLicence(
  state: GameState,
  playerId: PlayerId,
  propertyId: PropertyId,
): Validation {
  const property = state.properties[propertyId];
  if (!property || property.ownerId !== playerId) {
    return { ok: false, reason: 'Cannot licence: you do not own that Property.' };
  }
  if (property.licensed) {
    return { ok: false, reason: 'Cannot licence: that Property is already Licensed.' };
  }

  const cost = licenceCost(state, playerId);
  const player = state.players[playerId];
  if (player.cleanCash < cost) {
    return {
      ok: false,
      reason: `Cannot licence Property: requires ${formatMoney(cost)} Clean Cash.`,
      cleanCost: cost,
    };
  }

  return { ...OK, cleanCost: cost, heatDelta: -BALANCE.licensing.heatRemovedOnLicence };
}

export function vetCost(state: GameState, playerId: PlayerId, workerId: string): MoneyUnits {
  const player = state.players[playerId];
  const worker = player.workers.find((w) => w.id === workerId);
  let cost = BALANCE.vetting.cost + vettingCostAdjustment(state);
  if (worker?.propertyId) {
    const property = state.properties[worker.propertyId];
    if (hasMamasanTag(state, property, 'vet_discount')) cost -= 2; // Nida
  }
  return Math.max(0, cost);
}

function validateVet(state: GameState, playerId: PlayerId, workerId: string): Validation {
  const player = state.players[playerId];
  const worker = player.workers.find((w) => w.id === workerId);
  if (!worker) return { ok: false, reason: 'No such Worker.' };
  if (worker.status === 'vetted') {
    return { ok: false, reason: 'Cannot Vet Worker: they are already Vetted.' };
  }

  const cost = vetCost(state, playerId, workerId);
  if (player.cleanCash < cost) {
    return {
      ok: false,
      reason: `Cannot Vet Worker: requires ${formatMoney(cost)} Clean Cash.`,
      cleanCost: cost,
    };
  }

  return { ...OK, cleanCost: cost };
}

export function launderYield(
  state: GameState,
  playerId: PlayerId,
  tier: number,
): { dirty: MoneyUnits; clean: MoneyUnits } {
  const config = BALANCE.laundering.tiers.find((t) => t.tier === tier);
  if (!config) return { dirty: 0, clean: 0 };

  let clean = config.clean;
  const properties = ownedProperties(state, playerId).filter((p) => isOperating(state, p));

  if (tier === 1 && properties.some((p) => hasMamasanTag(state, p, 'launder_bonus'))) {
    clean += 2; // Kanya: +$50k on the first tier
  }
  if (properties.some((p) => hasUpgradeTag(state, p, 'offshore_books'))) {
    clean += 2; // Offshore Books: one tier returns +$50k
  }

  return { dirty: config.dirty, clean };
}

function validateLaunder(state: GameState, playerId: PlayerId, tier: number): Validation {
  if (launderingBlocked(state)) {
    return { ok: false, reason: 'Cannot launder: a Banking Freeze is in force.' };
  }

  const available = availableLaunderTiers(state, playerId);
  if (!available.includes(tier)) {
    return {
      ok: false,
      reason: `Cannot launder at Tier ${tier}: requires a Cash Business or Underworld infrastructure.`,
    };
  }

  const player = state.players[playerId];
  if (player.stats.launderTiersUsedThisTurn.includes(tier)) {
    return { ok: false, reason: `Cannot launder: Tier ${tier} has already been used this turn.` };
  }

  const { dirty, clean } = launderYield(state, playerId, tier);
  if (player.dirtyCash < dirty) {
    return {
      ok: false,
      reason: `Cannot launder: requires ${formatMoney(dirty)} Dirty Cash.`,
      dirtyCost: dirty,
    };
  }

  return { ...OK, dirtyCost: dirty, cleanCost: -clean };
}

function validateReduceHeat(state: GameState, playerId: PlayerId): Validation {
  const player = state.players[playerId];
  if (player.heat <= player.notoriety) {
    return {
      ok: false,
      reason: `Cannot reduce Heat: it is already at your Notoriety floor (${player.notoriety}).`,
    };
  }
  if (player.cleanCash < BALANCE.heat.reduceHeatActionCost) {
    return {
      ok: false,
      reason: `Cannot reduce Heat: requires ${formatMoney(BALANCE.heat.reduceHeatActionCost)} Clean Cash.`,
      cleanCost: BALANCE.heat.reduceHeatActionCost,
    };
  }

  let amount = BALANCE.heat.reduceHeatActionAmount;
  if (controlsDistrict(state, playerId, 'old_quarter') && player.stats.heatReductionActionsThisTurn === 0) {
    amount += 1;
  }

  return { ...OK, cleanCost: BALANCE.heat.reduceHeatActionCost, heatDelta: -amount };
}

function validateRepair(state: GameState, playerId: PlayerId, upgradeId: string): Validation {
  const upgrade = state.upgrades[upgradeId];
  if (!upgrade) return { ok: false, reason: 'No such Upgrade.' };
  const property = state.properties[upgrade.propertyId];
  if (property.ownerId !== playerId) {
    return { ok: false, reason: 'Cannot repair: you do not own that Property.' };
  }
  if (!upgrade.disabled) {
    return { ok: false, reason: 'Cannot repair: that Upgrade is not disabled.' };
  }

  const player = state.players[playerId];
  if (player.cleanCash < BALANCE.property.repairUpgradeCost) {
    return {
      ok: false,
      reason: `Cannot repair Upgrade: requires ${formatMoney(BALANCE.property.repairUpgradeCost)} Clean Cash.`,
      cleanCost: BALANCE.property.repairUpgradeCost,
    };
  }

  return { ...OK, cleanCost: BALANCE.property.repairUpgradeCost };
}

function validateReopen(
  state: GameState,
  playerId: PlayerId,
  propertyId: PropertyId,
): Validation {
  const property = state.properties[propertyId];
  if (!property || property.ownerId !== playerId) {
    return { ok: false, reason: 'Cannot reopen: you do not own that Property.' };
  }
  if (isOpen(state, property)) {
    return { ok: false, reason: 'Cannot reopen: that Property is not closed.' };
  }

  const player = state.players[playerId];
  if (player.cleanCash < BALANCE.property.reopenCost) {
    return {
      ok: false,
      reason: `Cannot reopen Property: requires ${formatMoney(BALANCE.property.reopenCost)} Clean Cash.`,
      cleanCost: BALANCE.property.reopenCost,
    };
  }

  return { ...OK, cleanCost: BALANCE.property.reopenCost };
}

/** Every Action the player could take right now, with reasons for the disabled ones. */
export function enumerateActions(
  state: GameState,
  playerId: PlayerId,
): { action: GameAction; validation: Validation }[] {
  const results: { action: GameAction; validation: Validation }[] = [];
  const player = state.players[playerId];
  const owned = ownedProperties(state, playerId);

  for (const property of Object.values(state.properties)) {
    if (property.ownerId === null) {
      results.push({
        action: { type: 'BUY_PROPERTY', propertyId: property.id },
        validation: validateAction(state, playerId, { type: 'BUY_PROPERTY', propertyId: property.id }),
      });
    }
  }

  for (const property of owned) {
    for (const profile of Object.keys(state.workerSupply)) {
      const action: GameAction = {
        type: 'RECRUIT_WORKER',
        profileId: profile,
        propertyId: property.id,
      };
      results.push({ action, validation: validateAction(state, playerId, action) });
    }

    for (const upgradeId of Object.keys(state.upgradeSupply)) {
      const action: GameAction = {
        type: 'BUY_UPGRADE',
        upgradeDefId: upgradeId,
        propertyId: property.id,
      };
      results.push({ action, validation: validateAction(state, playerId, action) });
    }

    if (!property.licensed) {
      const action: GameAction = { type: 'LICENCE_PROPERTY', propertyId: property.id };
      results.push({ action, validation: validateAction(state, playerId, action) });
    }

    if (!isOpen(state, property)) {
      const action: GameAction = { type: 'REOPEN_PROPERTY', propertyId: property.id };
      results.push({ action, validation: validateAction(state, playerId, action) });
    }

    for (const { instance } of upgradesAt(state, property)) {
      if (instance.disabled) {
        const action: GameAction = { type: 'REPAIR_UPGRADE', upgradeId: instance.id };
        results.push({ action, validation: validateAction(state, playerId, action) });
      }
    }

    if (property.mamasanId === null) {
      for (const mamasanDefId of state.mamasanSupply) {
        const action: GameAction = {
          type: 'HIRE_MAMASAN',
          mamasanDefId,
          propertyId: property.id,
        };
        results.push({ action, validation: validateAction(state, playerId, action) });
      }
    }
  }

  for (const worker of player.workers) {
    if (worker.status === 'unregistered') {
      const action: GameAction = { type: 'VET_WORKER', workerId: worker.id };
      results.push({ action, validation: validateAction(state, playerId, action) });
    }
    for (const property of owned) {
      if (worker.propertyId === property.id) continue;
      const action: GameAction = {
        type: 'MOVE_WORKER',
        workerId: worker.id,
        toPropertyId: property.id,
      };
      results.push({ action, validation: validateAction(state, playerId, action) });
    }
  }

  for (const tier of availableLaunderTiers(state, playerId)) {
    const action: GameAction = { type: 'LAUNDER', tier };
    results.push({ action, validation: validateAction(state, playerId, action) });
  }

  results.push({
    action: { type: 'REDUCE_HEAT' },
    validation: validateAction(state, playerId, { type: 'REDUCE_HEAT' }),
  });

  return results;
}

export function legalActions(state: GameState, playerId: PlayerId): GameAction[] {
  return enumerateActions(state, playerId)
    .filter((entry) => entry.validation.ok)
    .map((entry) => entry.action);
}

export { isLicensed };
