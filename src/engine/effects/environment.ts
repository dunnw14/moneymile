import { DISTRICTS } from '@/content/districts';
import { POLICE_BY_ID } from '@/content/police';
import { PROPERTY_BY_ID } from '@/content/properties';
import { WORKER_BY_ID } from '@/content/workers';
import { addHeat, addPropertyHeat, emit, rngFor } from '@/engine/core';
import { isLicensed } from '@/engine/selectors';
import type { ActiveEnvironment, GameState } from '@/types';

/**
 * Environment cards resolve the moment they are drawn and then sit in the
 * shared "Current Conditions" area for the rest of the round. Most of them are
 * read passively by the calculation layer; the ones with an immediate kick are
 * applied here.
 */
export function applyEnvironmentCard(state: GameState, defId: string): void {
  const expiresAtRound = state.round + 1;
  const entry: ActiveEnvironment = { id: `env-${state.nextEventId}`, defId, expiresAtRound };

  switch (defId) {
    case 'police_rotation': {
      for (const unit of state.police) {
        unit.hex = { ...POLICE_BY_ID[unit.id].start };
      }
      emit(state, 'environment', 'Police units return to their starting hexes.');
      return; // immediate only; nothing persists
    }

    case 'economic_reset': {
      const removed = state.environment.length;
      state.environment = [];
      emit(state, 'environment', `Economic Reset clears ${removed} persistent condition(s).`);
      return;
    }

    case 'media_investigation': {
      const highest = state.playerOrder.reduce((best, id) =>
        state.players[id].notoriety > state.players[best].notoriety ? id : best,
      );
      if (state.players[highest].notoriety > 0) {
        addHeat(state, highest, 2);
        emit(
          state,
          'environment',
          `Media Investigation puts 2 Heat on ${state.players[highest].name}.`,
          highest,
        );
      }
      return;
    }

    case 'songkran': {
      for (const playerId of state.playerOrder) {
        for (const worker of state.players[playerId].workers) {
          const profile = WORKER_BY_ID[worker.profileId];
          if (profile.tag === 'holiday_vulnerable') worker.conditions.unavailable = 1;
        }
      }
      break;
    }

    case 'election_night': {
      for (const property of Object.values(state.properties)) {
        if (property.ownerId && !isLicensed(property)) addPropertyHeat(state, property.id, 1);
      }
      break;
    }

    case 'power_failure':
    case 'festival_district': {
      const { rng, commit } = rngFor(state);
      const district = rng.pick(DISTRICTS).id;
      commit();
      entry.data = { district };
      if (defId === 'festival_district') {
        for (const propertyId of DISTRICTS.find((d) => d.id === district)!.properties) {
          if (state.properties[propertyId].ownerId) addPropertyHeat(state, propertyId, 1);
        }
      }
      emit(
        state,
        'environment',
        `${defId === 'power_failure' ? 'Power Failure' : 'Festival District'} hits the ${
          DISTRICTS.find((d) => d.id === district)!.name
        }.`,
      );
      break;
    }

    case 'public_holiday': {
      // Each player picks a Property to guarantee a Big Night. The engine picks
      // the highest-potential Property so hot-seat play is not interrupted.
      for (const playerId of state.playerOrder) {
        const owned = Object.values(state.properties)
          .filter((p) => p.ownerId === playerId)
          .sort((a, b) => PROPERTY_BY_ID[b.id].multiplier - PROPERTY_BY_ID[a.id].multiplier);
        if (owned[0]) {
          state.players[playerId].turnEffects.guaranteedBigProperty = owned[0].id;
        }
      }
      break;
    }

    default:
      break;
  }

  state.environment.push(entry);
}
