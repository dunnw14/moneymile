import { BALANCE } from '@/content/balance';
import { DISTRICTS } from '@/content/districts';
import { MAMASAN_BY_ID } from '@/content/mamasans';
import { UPGRADE_BY_ID } from '@/content/upgrades';
import { WORKER_BY_ID } from '@/content/workers';
import {
  isFreeAction,
  launderYield,
  licenceCost,
  propertyPrice,
  recruitCost,
  upgradePrice,
  validateAction,
  vetCost,
  workerMoveIsFree,
  type GameAction,
} from '@/engine/actions';
import {
  addHeat,
  addNotoriety,
  addPropertyHeat,
  attachMamasan,
  attachWorker,
  clone,
  drawCard,
  emit,
  gainClean,
  nextId,
  payClean,
  payDirty,
  propertyName,
} from '@/engine/core';
import { controlsDistrict } from '@/engine/selectors';
import type { GameState, PlayerId, PropertyId } from '@/types';

export interface ActionResult {
  state: GameState;
  ok: boolean;
  error?: string;
}

/**
 * Executes one Operate-phase Action.
 *
 * Order is always validate -> calculate -> execute -> emit. Nothing here reads
 * a cost that validation did not already confirm the player can pay, so a
 * successful validation always yields a successful execution.
 */
export function executeAction(
  input: GameState,
  playerId: PlayerId,
  action: GameAction,
): ActionResult {
  const validation = validateAction(input, playerId, action);
  if (!validation.ok) {
    return { state: input, ok: false, error: validation.reason ?? 'Action not allowed.' };
  }

  const state = clone(input);
  const player = state.players[playerId];
  const spendsAction = !isFreeAction(state, playerId, action) && validation.costsAction !== false;

  switch (action.type) {
    case 'BUY_PROPERTY': {
      const price = propertyPrice(state, playerId, action.propertyId, action.mamasanDefId);
      const mamasanDef = action.mamasanDefId ? MAMASAN_BY_ID[action.mamasanDefId] : null;
      payClean(state, playerId, price + (mamasanDef?.cost ?? 0));

      const property = state.properties[action.propertyId];
      property.ownerId = playerId;
      player.turnEffects.propertyDiscount = 0;

      let message = `${player.name} buys ${propertyName(action.propertyId)} for ${price}.`;

      if (mamasanDef) {
        state.mamasanSupply = state.mamasanSupply.filter((id) => id !== mamasanDef.id);
        const mamasanId = nextId(state, 'm');
        player.mamasans.push({
          id: mamasanId,
          defId: mamasanDef.id,
          ownerId: playerId,
          propertyId: null,
        });
        attachMamasan(state, mamasanId, action.propertyId);
        message += ` ${mamasanDef.name} takes over the room.`;
      } else {
        message += ' It will remain inactive until a Mamasan is assigned.';
      }

      emit(state, 'buy_property', message, playerId);
      awardDistrictSweep(state, playerId, action.propertyId);
      break;
    }

    case 'RECRUIT_WORKER': {
      const profile = WORKER_BY_ID[action.profileId];
      const cost = recruitCost(state, playerId, action.profileId, action.propertyId);
      const payingDirty = profile.status === 'unregistered' && player.cleanCash < cost;
      if (payingDirty) payDirty(state, playerId, cost);
      else payClean(state, playerId, cost);

      state.workerSupply[action.profileId] -= 1;
      const workerId = nextId(state, 'w');
      player.workers.push({
        id: workerId,
        profileId: action.profileId,
        status: profile.status,
        ownerId: playerId,
        propertyId: null,
        stability: profile.stability,
        conditions: {},
        producingNights: 0,
      });
      attachWorker(state, workerId, action.propertyId);
      player.stats.recruitsThisRound += 1;

      if (profile.status === 'unregistered') {
        const property = state.properties[action.propertyId];
        const chabaExempt =
          property.mamasanId !== null &&
          player.mamasans.find((m) => m.id === property.mamasanId)?.defId === 'chaba' &&
          property.workerIds.filter((id) => {
            const w = player.workers.find((x) => x.id === id);
            return w?.status === 'unregistered';
          }).length === 1;
        if (!chabaExempt) addPropertyHeat(state, action.propertyId, profile.heat);
      }

      emit(
        state,
        'recruit',
        `${player.name} recruits a ${profile.name} at ${propertyName(action.propertyId)} for ${cost}.`,
        playerId,
      );

      // Recruitment Drive: the second recruit this turn is free of Action cost.
      if (player.turnEffects.recruitTwoWithOneAction) {
        player.turnEffects.recruitTwoWithOneAction = false;
        emit(state, 'recruit', 'Recruitment Drive covers this recruit.', playerId);
        state.players[playerId].actionsRemaining += 1;
      }
      break;
    }

    case 'MOVE_WORKER': {
      const free = workerMoveIsFree(state, playerId, action.workerId, action.toPropertyId);
      if (free) player.stats.freeWorkerMovesUsed += 1;

      if (action.toPropertyId === null) {
        const worker = player.workers.find((w) => w.id === action.workerId)!;
        worker.propertyId = null;
        for (const property of Object.values(state.properties)) {
          property.workerIds = property.workerIds.filter((id) => id !== action.workerId);
        }
      } else {
        attachWorker(state, action.workerId, action.toPropertyId);
      }

      const worker = player.workers.find((w) => w.id === action.workerId)!;
      emit(
        state,
        'move_worker',
        `${player.name} moves a ${WORKER_BY_ID[worker.profileId].name}${
          action.toPropertyId ? ` to ${propertyName(action.toPropertyId)}` : ' off duty'
        }${free ? ' (free)' : ''}.`,
        playerId,
      );
      break;
    }

    case 'HIRE_MAMASAN': {
      const def = MAMASAN_BY_ID[action.mamasanDefId];
      payClean(state, playerId, def.cost);
      state.mamasanSupply = state.mamasanSupply.filter((id) => id !== def.id);
      const mamasanId = nextId(state, 'm');
      player.mamasans.push({
        id: mamasanId,
        defId: def.id,
        ownerId: playerId,
        propertyId: null,
      });
      attachMamasan(state, mamasanId, action.propertyId);
      if (player.turnEffects.freeMamasanAction) player.turnEffects.freeMamasanAction = false;
      emit(
        state,
        'hire_mamasan',
        `${player.name} hires ${def.name} for ${propertyName(action.propertyId)}.`,
        playerId,
      );
      break;
    }

    case 'MOVE_MAMASAN': {
      attachMamasan(state, action.mamasanId, action.toPropertyId);
      if (player.turnEffects.freeMamasanAction) player.turnEffects.freeMamasanAction = false;
      const mamasan = player.mamasans.find((m) => m.id === action.mamasanId)!;
      emit(
        state,
        'move_mamasan',
        `${player.name} moves ${MAMASAN_BY_ID[mamasan.defId].name} to ${propertyName(action.toPropertyId)}.`,
        playerId,
      );
      break;
    }

    case 'BUY_UPGRADE': {
      const def = UPGRADE_BY_ID[action.upgradeDefId];
      const cost = upgradePrice(state, playerId, action.upgradeDefId);
      if (def.dirtyPurchase) payDirty(state, playerId, cost);
      else payClean(state, playerId, cost);
      if (def.category !== 'underworld') player.turnEffects.upgradeDiscount = 0;

      state.upgradeSupply[action.upgradeDefId] -= 1;
      const upgradeId = nextId(state, 'u');
      state.upgrades[upgradeId] = {
        id: upgradeId,
        defId: def.id,
        propertyId: action.propertyId,
        disabled: false,
      };
      state.properties[action.propertyId].upgradeIds.push(upgradeId);

      emit(
        state,
        'buy_upgrade',
        `${player.name} installs ${def.name} at ${propertyName(action.propertyId)}.`,
        playerId,
      );

      if (def.tag === 'hidden_room') addPropertyHeat(state, action.propertyId, 1);
      if (def.tag === 'offshore_books') {
        addNotoriety(state, playerId, 1, 'Offshore Books');
      }
      break;
    }

    case 'LICENCE_PROPERTY': {
      const cost = licenceCost(state, playerId);
      payClean(state, playerId, cost);
      state.properties[action.propertyId].licensed = true;
      player.turnEffects.licenceDiscount = 0;
      addHeat(state, playerId, -BALANCE.licensing.heatRemovedOnLicence);
      emit(
        state,
        'licence',
        `${player.name} licences ${propertyName(action.propertyId)}.`,
        playerId,
      );
      break;
    }

    case 'VET_WORKER': {
      const cost = vetCost(state, playerId, action.workerId);
      payClean(state, playerId, cost);
      const worker = player.workers.find((w) => w.id === action.workerId)!;
      const profile = WORKER_BY_ID[worker.profileId];

      worker.status = 'vetted';
      worker.stability = Math.min(
        BALANCE.vetting.stabilityMax,
        worker.stability + BALANCE.vetting.stabilityGain,
      );

      emit(
        state,
        'vet',
        `${player.name} vets a ${profile.name}. They now generate Clean Cash; Notoriety is unaffected.`,
        playerId,
      );
      break;
    }

    case 'LAUNDER': {
      const { dirty, clean } = launderYield(state, playerId, action.tier);
      payDirty(state, playerId, dirty);
      gainClean(state, playerId, clean);
      player.stats.launderTiersUsedThisTurn.push(action.tier);
      emit(
        state,
        'launder',
        `${player.name} launders ${dirty} Dirty into ${clean} Clean at Tier ${action.tier}.`,
        playerId,
      );
      break;
    }

    case 'REDUCE_HEAT': {
      payClean(state, playerId, BALANCE.heat.reduceHeatActionCost);
      let amount = BALANCE.heat.reduceHeatActionAmount;
      if (
        controlsDistrict(state, playerId, 'old_quarter') &&
        player.stats.heatReductionActionsThisTurn === 0
      ) {
        amount += 1;
      }
      const before = player.heat;
      addHeat(state, playerId, -amount);
      player.stats.heatReductionActionsThisTurn += 1;
      emit(
        state,
        'reduce_heat',
        `${player.name} reduces Heat ${before} → ${player.heat}.`,
        playerId,
      );
      break;
    }

    case 'REPAIR_UPGRADE': {
      payClean(state, playerId, BALANCE.property.repairUpgradeCost);
      state.upgrades[action.upgradeId].disabled = false;
      emit(
        state,
        'repair',
        `${player.name} repairs ${UPGRADE_BY_ID[state.upgrades[action.upgradeId].defId].name}.`,
        playerId,
      );
      break;
    }

    case 'REOPEN_PROPERTY': {
      payClean(state, playerId, BALANCE.property.reopenCost);
      state.properties[action.propertyId].closedUntilRound = null;
      emit(
        state,
        'reopen',
        `${player.name} reopens ${propertyName(action.propertyId)}.`,
        playerId,
      );
      break;
    }
  }

  if (spendsAction) {
    state.players[playerId].actionsRemaining = Math.max(
      0,
      state.players[playerId].actionsRemaining - 1,
    );
  }

  return { state, ok: true };
}

/** Owning all four Properties in a District grants an immediate bonus card draw. */
function awardDistrictSweep(state: GameState, playerId: PlayerId, propertyId: PropertyId): void {
  const district = DISTRICTS.find((d) => d.properties.includes(propertyId));
  if (!district) return;

  const ownsAll = district.properties.every((id) => state.properties[id].ownerId === playerId);
  if (!ownsAll) return;

  for (let i = 0; i < BALANCE.district.sweepBonusCardDraw; i++) {
    drawCard(state, playerId);
  }
  emit(
    state,
    'district_sweep',
    `${state.players[playerId].name} controls every Property in the ${district.name} and draws a bonus card.`,
    playerId,
  );
}
