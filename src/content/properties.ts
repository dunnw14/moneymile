import type { PropertyDef } from '@/types';

/**
 * The 24 Properties, laid out on a 6x4 axial hex grid.
 *
 * Districts occupy 2x2 blocks of that grid, so a district's four Properties are
 * always mutually reachable in one or two hexes — which is what makes district
 * concentration efficient *and* dangerous: one Police unit can pressure the
 * whole block.
 *
 *   q ->  0   1   2   3   4   5
 * r=0    [ Laneways ][Waterfront][ Bazaar  ]
 * r=1    [          ][          ][         ]
 * r=2    [ Transit  ][  Uptown  ][Old Qtr  ]
 * r=3    [          ][          ][         ]
 *
 * Costs and upkeep are money units of $25,000.
 * Upgrade slots are not given in the v0.4 spec table; they are derived from cost
 * tier (see docs/ASSUMPTIONS.md).
 */
export const PROPERTIES: PropertyDef[] = [
  // --- Laneways -----------------------------------------------------------
  { id: 1, name: 'Backstreet Rooms', district: 'laneways', cost: 12, capacity: 2, safety: 1, baseHeat: 3, multiplier: 90, upkeep: 2, licence: 'unlicensed', upgradeSlots: 2, archetype: 'underground', hex: { q: 0, r: 0 } },
  { id: 2, name: 'Laneway Karaoke', district: 'laneways', cost: 14, capacity: 3, safety: 1, baseHeat: 3, multiplier: 95, upkeep: 2, licence: 'unlicensed', upgradeSlots: 2, archetype: 'underground', hex: { q: 1, r: 0 } },
  { id: 3, name: 'Neon Bar', district: 'laneways', cost: 18, capacity: 3, safety: 2, baseHeat: 2, multiplier: 105, upkeep: 2, licence: 'licensed', upgradeSlots: 2, archetype: 'neighbourhood', hex: { q: 0, r: 1 } },
  { id: 4, name: 'Golden Lotus', district: 'laneways', cost: 22, capacity: 3, safety: 2, baseHeat: 2, multiplier: 110, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'neighbourhood', hex: { q: 1, r: 1 } },

  // --- Waterfront ---------------------------------------------------------
  { id: 5, name: 'Riverside Lounge', district: 'waterfront', cost: 20, capacity: 2, safety: 3, baseHeat: 1, multiplier: 120, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'boutique', hex: { q: 2, r: 0 } },
  { id: 6, name: 'Harbour Rooms', district: 'waterfront', cost: 26, capacity: 3, safety: 3, baseHeat: 1, multiplier: 120, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'neighbourhood', hex: { q: 3, r: 0 } },
  { id: 7, name: 'Blue Orchid', district: 'waterfront', cost: 30, capacity: 3, safety: 4, baseHeat: 1, multiplier: 130, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'boutique', hex: { q: 2, r: 1 } },
  { id: 8, name: 'Skyline Club', district: 'waterfront', cost: 36, capacity: 4, safety: 3, baseHeat: 2, multiplier: 135, upkeep: 4, licence: 'licensed', upgradeSlots: 4, archetype: 'volume', hex: { q: 3, r: 1 } },

  // --- Bazaar -------------------------------------------------------------
  { id: 9, name: 'Market Hotel', district: 'bazaar', cost: 18, capacity: 4, safety: 2, baseHeat: 2, multiplier: 100, upkeep: 2, licence: 'licensed', upgradeSlots: 2, archetype: 'cash_business', hex: { q: 4, r: 0 } },
  { id: 10, name: 'Night Bazaar', district: 'bazaar', cost: 22, capacity: 5, safety: 1, baseHeat: 3, multiplier: 100, upkeep: 2, licence: 'unlicensed', upgradeSlots: 3, archetype: 'volume', hex: { q: 5, r: 0 } },
  { id: 11, name: 'Lucky Star', district: 'bazaar', cost: 26, capacity: 4, safety: 2, baseHeat: 2, multiplier: 115, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'cash_business', hex: { q: 4, r: 1 } },
  { id: 12, name: 'Grand Palace', district: 'bazaar', cost: 40, capacity: 5, safety: 4, baseHeat: 1, multiplier: 135, upkeep: 4, licence: 'licensed', upgradeSlots: 4, archetype: 'fortified', hex: { q: 5, r: 1 } },

  // --- Transit ------------------------------------------------------------
  { id: 13, name: 'Station Bar', district: 'transit', cost: 14, capacity: 3, safety: 1, baseHeat: 3, multiplier: 95, upkeep: 2, licence: 'unlicensed', upgradeSlots: 2, archetype: 'underground', hex: { q: 0, r: 2 } },
  { id: 14, name: 'Crossroads Club', district: 'transit', cost: 20, capacity: 4, safety: 2, baseHeat: 2, multiplier: 105, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'volume', hex: { q: 1, r: 2 } },
  { id: 15, name: 'Terminal Lounge', district: 'transit', cost: 26, capacity: 4, safety: 3, baseHeat: 1, multiplier: 115, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'neighbourhood', hex: { q: 0, r: 3 } },
  { id: 16, name: 'Midnight Express', district: 'transit', cost: 32, capacity: 5, safety: 2, baseHeat: 2, multiplier: 125, upkeep: 4, licence: 'licensed', upgradeSlots: 3, archetype: 'volume', hex: { q: 1, r: 3 } },

  // --- Uptown -------------------------------------------------------------
  { id: 17, name: 'Velvet Room', district: 'uptown', cost: 24, capacity: 2, safety: 4, baseHeat: 1, multiplier: 135, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'boutique', hex: { q: 2, r: 2 } },
  { id: 18, name: 'Diamond House', district: 'uptown', cost: 32, capacity: 3, safety: 4, baseHeat: 1, multiplier: 140, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'boutique', hex: { q: 3, r: 2 } },
  { id: 19, name: 'Imperial Club', district: 'uptown', cost: 42, capacity: 4, safety: 5, baseHeat: 1, multiplier: 145, upkeep: 4, licence: 'licensed', upgradeSlots: 4, archetype: 'fortified', hex: { q: 2, r: 3 } },
  { id: 20, name: 'Penthouse', district: 'uptown', cost: 48, capacity: 4, safety: 5, baseHeat: 1, multiplier: 155, upkeep: 4, licence: 'licensed', upgradeSlots: 4, archetype: 'fortified', hex: { q: 3, r: 3 } },

  // --- Old Quarter --------------------------------------------------------
  { id: 21, name: 'Old Town Bar', district: 'old_quarter', cost: 12, capacity: 2, safety: 2, baseHeat: 2, multiplier: 90, upkeep: 2, licence: 'unlicensed', upgradeSlots: 2, archetype: 'underground', hex: { q: 4, r: 2 } },
  { id: 22, name: 'Temple Street', district: 'old_quarter', cost: 16, capacity: 3, safety: 2, baseHeat: 2, multiplier: 100, upkeep: 2, licence: 'licensed', upgradeSlots: 2, archetype: 'cash_business', hex: { q: 5, r: 2 } },
  { id: 23, name: 'Moonlight Garden', district: 'old_quarter', cost: 22, capacity: 3, safety: 3, baseHeat: 1, multiplier: 110, upkeep: 2, licence: 'licensed', upgradeSlots: 3, archetype: 'neighbourhood', hex: { q: 4, r: 3 } },
  { id: 24, name: 'Embassy Club', district: 'old_quarter', cost: 34, capacity: 4, safety: 4, baseHeat: 1, multiplier: 130, upkeep: 4, licence: 'licensed', upgradeSlots: 4, archetype: 'fortified', hex: { q: 5, r: 3 } },
];

export const PROPERTY_BY_ID: Record<number, PropertyDef> = Object.fromEntries(
  PROPERTIES.map((p) => [p.id, p]),
);

/** The four Starter Properties dealt out during setup, per the manual. */
export const STARTER_PROPERTY_IDS = [1, 13, 21, 3];
