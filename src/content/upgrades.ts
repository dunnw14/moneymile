import type { UpgradeDef } from '@/types';

/** 16 Upgrade types, three copies of each = the 48 Upgrade tiles in the box. */
export const UPGRADES: UpgradeDef[] = [
  // Revenue
  { id: 'vip_room', name: 'VIP Room', category: 'revenue', cost: 10, dirtyPurchase: false, effect: 'Property Revenue Multiplier +0.15', tag: 'multiplier_up' },
  { id: 'premium_bar', name: 'Premium Bar', category: 'revenue', cost: 8, dirtyPurchase: false, effect: '+$25k per active Worker', tag: 'per_worker_bonus' },
  { id: 'event_space', name: 'Event Space', category: 'revenue', cost: 10, dirtyPurchase: false, effect: 'Big Night multiplier +0.25', tag: 'big_night_up' },
  { id: 'marketing_office', name: 'Marketing Office', category: 'revenue', cost: 6, dirtyPurchase: false, effect: 'Once per round, treat Quiet as Normal for this Property', tag: 'quiet_as_normal' },

  // Security
  { id: 'cameras', name: 'Cameras', category: 'security', cost: 6, dirtyPurchase: false, effect: 'Safety +1', tag: 'safety_up_1' },
  { id: 'reinforced_doors', name: 'Reinforced Doors', category: 'security', cost: 8, dirtyPurchase: false, effect: 'Reduce Worker removals from a Raid by one', tag: 'raid_worker_shield' },
  { id: 'safe_room', name: 'Safe Room', category: 'security', cost: 10, dirtyPurchase: false, effect: 'Protect $300k Dirty Cash during a Raid', tag: 'safe_room' },
  { id: 'private_security', name: 'Private Security', category: 'security', cost: 12, dirtyPurchase: false, effect: 'Safety +2; upkeep +$50k', tag: 'safety_up_2' },

  // Operations
  { id: 'extra_rooms', name: 'Extra Rooms', category: 'operations', cost: 8, dirtyPurchase: false, effect: 'Capacity +1', tag: 'capacity_up' },
  { id: 'staff_transport', name: 'Staff Transport', category: 'operations', cost: 6, dirtyPurchase: false, effect: 'One free Worker movement per turn', tag: 'free_worker_move' },
  { id: 'management_office', name: 'Management Office', category: 'operations', cost: 10, dirtyPurchase: false, effect: 'Operate without a Mamasan for one Night per round', tag: 'no_mamasan_needed' },
  { id: 'recruitment_desk', name: 'Recruitment Desk', category: 'operations', cost: 8, dirtyPurchase: false, effect: 'Workers recruited here cost $50k less', tag: 'recruit_discount' },

  // Underworld
  { id: 'hidden_room', name: 'Hidden Room', category: 'underworld', cost: 6, dirtyPurchase: true, effect: 'Capacity +1; Property Heat +1', tag: 'hidden_room' },
  { id: 'cash_front', name: 'Cash Front', category: 'underworld', cost: 10, dirtyPurchase: false, effect: 'Unlock laundering Tier 2', tag: 'launder_tier_2' },
  { id: 'offshore_books', name: 'Offshore Books', category: 'underworld', cost: 14, dirtyPurchase: false, effect: 'One laundering tier returns +$50k; Notoriety +1', tag: 'offshore_books' },
  { id: 'police_contact', name: 'Police Contact', category: 'underworld', cost: 12, dirtyPurchase: false, effect: 'Pay $100k Dirty to move a Police unit one hex', tag: 'police_contact' },
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<
  string,
  UpgradeDef
>;

export const COPIES_PER_UPGRADE = 3;

/** Upgrades that count for nothing at final scoring and add Final Raid exposure. */
export const UNDERWORLD_UPGRADE_IDS = UPGRADES.filter((u) => u.category === 'underworld').map(
  (u) => u.id,
);
