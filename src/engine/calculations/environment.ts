import { PROPERTY_BY_ID } from '@/content/properties';
import { isLicensed } from '@/engine/selectors';
import type { DistrictId, GameState, NightOutcome, PropertyState } from '@/types';

/**
 * Environment cards live in a shared "Current Conditions" area and modify
 * revenue for every player. They are resolved here rather than inside the
 * revenue function so the list stays readable and testable.
 */
export function environmentRevenueMultiplier(
  state: GameState,
  property: PropertyState,
  outcome: NightOutcome | null,
): { multiplier: number; notes: string[] } {
  const def = PROPERTY_BY_ID[property.id];
  let multiplier = 100;
  const notes: string[] = [];

  const apply = (pct: number, note: string) => {
    multiplier = Math.round((multiplier * pct) / 100);
    notes.push(note);
  };

  for (const env of state.environment) {
    switch (env.defId) {
      case 'tourist_season':
        apply(115, 'Tourist Season +15%');
        break;
      case 'recession':
        apply(80, 'Recession -20%');
        break;
      case 'songkran':
        if (outcome === 'big') apply(110, 'Songkran +10% on Big Night');
        break;
      case 'chinese_new_year':
        if (def.district === 'bazaar' || def.district === 'uptown') {
          apply(130, 'Chinese New Year +30%');
        }
        break;
      case 'election_night':
        if (isLicensed(property)) apply(120, 'Election Night +20% (Licensed)');
        break;
      case 'monsoon':
        if (def.district === 'waterfront') apply(75, 'Monsoon -25% (Waterfront)');
        if (def.district === 'transit') apply(115, 'Monsoon +15% (Transit)');
        break;
      case 'festival_district': {
        const district = env.data?.district as DistrictId | undefined;
        if (district && def.district === district) apply(140, 'Festival District +40%');
        break;
      }
      default:
        break;
    }
  }

  return { multiplier, notes };
}

/** Power Failure suppresses Upgrade effects in one District for the round. */
export function upgradesSuppressed(state: GameState, property: PropertyState): boolean {
  const def = PROPERTY_BY_ID[property.id];
  return state.environment.some(
    (env) => env.defId === 'power_failure' && env.data?.district === def.district,
  );
}

export function launderingBlocked(state: GameState): boolean {
  return state.environment.some((env) => env.defId === 'banking_freeze');
}

export function upkeepWaived(state: GameState): boolean {
  return state.environment.some((env) => env.defId === 'rental_slump');
}

export function propertyPriceAdjustment(state: GameState): number {
  let delta = 0;
  for (const env of state.environment) {
    if (env.defId === 'recession') delta -= 4; // -$100k
    if (env.defId === 'property_boom') delta += 4; // +$100k
  }
  return delta;
}

export function vettingCostAdjustment(state: GameState): number {
  let delta = 0;
  for (const env of state.environment) {
    if (env.defId === 'new_regulations') delta += 2; // +$50k
    if (env.defId === 'amnesty_program') delta -= 2; // -$50k
  }
  return delta;
}

export function extraPoliceMovement(state: GameState): number {
  return state.environment.some((env) => env.defId === 'city_crackdown') ? 1 : 0;
}

export function extraRaidChance(state: GameState): number {
  return state.environment.some((env) => env.defId === 'city_crackdown') ? 3 : 0;
}
