import type { WorkerProfileDef } from '@/types';

/**
 * 12 Worker profiles, four copies of each = the 48 Workers in the box.
 *
 * Workers represent consenting adults operating in a fictional nightlife
 * economy. "Unregistered" is a regulatory status only.
 *
 * Costs and revenue are money units of $25,000 (see docs/ASSUMPTIONS.md).
 */
export const WORKER_PROFILES: WorkerProfileDef[] = [
  { id: 'local_regular', name: 'Local Regular', status: 'vetted', cost: 6, revenue: 4, stability: 4, heat: 0, special: 'None', tag: 'none' },
  { id: 'experienced_host', name: 'Experienced Host', status: 'vetted', cost: 8, revenue: 5, stability: 4, heat: 0, special: '+$25k at a Boutique or Uptown Property', tag: 'boutique_uptown_bonus' },
  { id: 'vip_specialist', name: 'VIP Specialist', status: 'vetted', cost: 10, revenue: 6, stability: 3, heat: 0, special: '+$50k during a Big Night', tag: 'big_night_bonus' },
  { id: 'crowd_favourite', name: 'Crowd Favourite', status: 'vetted', cost: 9, revenue: 5, stability: 3, heat: 0, special: 'Another Worker here earns +$25k', tag: 'buddy_bonus' },
  { id: 'reliable_operator', name: 'Reliable Operator', status: 'vetted', cost: 7, revenue: 4, stability: 5, heat: 0, special: 'Immune to Environment Unavailable effects', tag: 'environment_immune' },
  { id: 'mobile_host', name: 'Mobile Host', status: 'vetted', cost: 7, revenue: 4, stability: 3, heat: 0, special: 'First movement each round is free', tag: 'free_move' },
  { id: 'new_arrival', name: 'New Arrival', status: 'unregistered', cost: 4, revenue: 6, stability: 1, heat: 1, special: 'Poaching costs $50k less', tag: 'cheap_poach' },
  { id: 'high_earner', name: 'High Earner', status: 'unregistered', cost: 6, revenue: 7, stability: 2, heat: 1, special: 'None', tag: 'none' },
  { id: 'party_starter', name: 'Party Starter', status: 'unregistered', cost: 6, revenue: 6, stability: 2, heat: 1, special: '+$50k on a Big Night; $0 on a Quiet Night', tag: 'party_starter' },
  { id: 'independent', name: 'Independent', status: 'unregistered', cost: 5, revenue: 6, stability: 3, heat: 1, special: 'Poaching costs the attacker +$50k', tag: 'poach_tax' },
  { id: 'traveller', name: 'Traveller', status: 'unregistered', cost: 4, revenue: 5, stability: 1, heat: 1, special: 'Holiday cards can make this Worker Unavailable', tag: 'holiday_vulnerable' },
  { id: 'underground_star', name: 'Underground Star', status: 'unregistered', cost: 9, revenue: 8, stability: 2, heat: 2, special: 'Adds 1 Notoriety after three producing Nights', tag: 'notoriety_after_three' },
];

export const WORKER_BY_ID = Object.fromEntries(WORKER_PROFILES.map((w) => [w.id, w])) as Record<
  string,
  WorkerProfileDef
>;

export const COPIES_PER_WORKER_PROFILE = 4;
