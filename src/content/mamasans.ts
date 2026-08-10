import type { MamasanDef } from '@/types';

/** All 24 Mamasans. Costs are money units ($25k each). */
export const MAMASANS: MamasanDef[] = [
  { id: 'anong', name: 'Anong', cost: 4, ability: 'First Worker recruited here each round costs $50k less', tag: 'recruit_discount' },
  { id: 'mali', name: 'Mali', cost: 4, ability: 'Reduce Base Property Heat by 1', tag: 'base_heat_down' },
  { id: 'dao', name: 'Dao', cost: 6, ability: 'If assigned when purchasing, reduce Property cost by $50k', tag: 'purchase_discount' },
  { id: 'nok', name: 'Nok', cost: 6, ability: 'Big Night Property revenue +10%', tag: 'big_night_bonus' },
  { id: 'pim', name: 'Pim', cost: 6, ability: 'Property Safety +1', tag: 'safety_up' },
  { id: 'lek', name: 'Lek', cost: 4, ability: 'First Worker moved into this Property each turn is free', tag: 'free_worker_move_in' },
  { id: 'kanya', name: 'Kanya', cost: 8, ability: 'First laundering tier returns +$50k Clean', tag: 'launder_bonus' },
  { id: 'suda', name: 'Suda', cost: 6, ability: 'One adjacent friendly Property earns +5%', tag: 'adjacent_bonus' },
  { id: 'araya', name: 'Araya', cost: 8, ability: 'First Vetted Worker here earns +$50k', tag: 'vetted_bonus' },
  { id: 'chaba', name: 'Chaba', cost: 4, ability: 'First Unregistered Worker here adds no Property Heat', tag: 'first_unregistered_no_heat' },
  { id: 'nida', name: 'Nida', cost: 6, ability: 'Vetting a Worker here costs $50k less', tag: 'vet_discount' },
  { id: 'siriporn', name: 'Siriporn', cost: 8, ability: 'Ignore first Disrupted status here each round', tag: 'ignore_disrupted' },
  { id: 'mayuree', name: 'Mayuree', cost: 6, ability: 'Draw two cards and keep one', tag: 'draw_two_keep_one' },
  { id: 'busaba', name: 'Busaba', cost: 8, ability: 'Reduce Raid severity here by one', tag: 'raid_severity_down' },
  { id: 'lalita', name: 'Lalita', cost: 4, ability: 'Reduce Property upkeep by $50k', tag: 'upkeep_down' },
  { id: 'kulap', name: 'Kulap', cost: 6, ability: 'Property Capacity +1', tag: 'capacity_up' },
  { id: 'patcha', name: 'Patcha', cost: 8, ability: 'Property revenue +10% if all Workers are Vetted', tag: 'all_vetted_bonus' },
  { id: 'jintana', name: 'Jintana', cost: 6, ability: 'Police bribe costs $50k less', tag: 'bribe_discount' },
  { id: 'ratree', name: 'Ratree', cost: 4, ability: 'Quiet Night multiplier improves by 0.10', tag: 'quiet_night_up' },
  { id: 'orathai', name: 'Orathai', cost: 8, ability: "If owner has 4+ Properties, waive this Property's upkeep", tag: 'waive_upkeep_large_empire' },
  { id: 'duangjai', name: 'Duangjai', cost: 6, ability: 'Poaching a Worker here costs the attacker +$100k', tag: 'poach_tax' },
  { id: 'wilai', name: 'Wilai', cost: 4, ability: 'Remove 1 Property Heat after a Normal Night', tag: 'heat_down_after_normal' },
  { id: 'pailin', name: 'Pailin', cost: 8, ability: 'Property Revenue Multiplier +0.10', tag: 'multiplier_up' },
  { id: 'napha', name: 'Napha', cost: 6, ability: 'Property reopens one round sooner', tag: 'reopen_sooner' },
];

export const MAMASAN_BY_ID = Object.fromEntries(MAMASANS.map((m) => [m.id, m])) as Record<
  string,
  MamasanDef
>;

/** The $100k Mamasans, one of which each player receives during setup. */
export const STARTER_MAMASAN_IDS = MAMASANS.filter((m) => m.cost === 4).map((m) => m.id);
