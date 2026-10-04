import { MAMASAN_BY_ID } from '@/content/mamasans';
export type Owner = 'you' | 'alex';
export const businesses = [
  { name: MAMASAN_BY_ID['anong'].name, icon: '👩', price: 600, income: 140, perk: 'Reliable anchor · full pay on quiet nights', kind: 'cafe', personality: 'Warm and practical. Remembers every regular.', quote: 'Let me take care of the regulars.', role: 'Reliable Operator', friend: 2 },
  { name: MAMASAN_BY_ID['mali'].name, icon: '👩', price: 800, income: 190, perk: 'Quick learner · training costs only $200', kind: 'arcade', personality: 'Quiet confidence. Keeps the reception desk calm.', quote: 'A calm shop brings people back.', role: 'Experienced Host', friend: 5 },
  { name: MAMASAN_BY_ID['dao'].name, icon: '👩', price: 500, income: 100, perk: 'Team player · +$60 per teammate', kind: 'food', personality: 'Talkative and generous. Brings the team together.', quote: 'A good team makes a good shift.', role: 'Crowd Favourite', friend: 0 },
  { name: MAMASAN_BY_ID['nok'].name, icon: '👩', price: 1200, income: 240, perk: 'Spotlight magnet · triple pay on busy nights', kind: 'music', personality: 'Ambitious and polished. Loves a fully booked evening.', quote: 'My appointment book is filling up.', role: 'VIP Specialist', friend: 7 },
  { name: MAMASAN_BY_ID['pim'].name, icon: '👩', price: 700, income: 160, perk: 'Reliable anchor · full pay on quiet nights', kind: 'cafe', personality: 'Patient, meticulous, fiercely dependable.', quote: 'Fresh towels. Clear rooms. Ready to go.', role: 'Local Regular', friend: 6 },
  { name: MAMASAN_BY_ID['lek'].name, icon: '👩', price: 950, income: 220, perk: 'Quick learner · training costs only $200', kind: 'arcade', personality: 'Restless and resourceful. Always learning a new technique.', quote: 'Show me the technique. I will learn it.', role: 'Mobile Host', friend: 1 },
  { name: MAMASAN_BY_ID['kanya'].name, icon: '👩', price: 550, income: 120, perk: 'Team player · +$60 per teammate', kind: 'food', personality: 'Independent and driven. Wants the busiest appointment book.', quote: 'Give me the bookings. I can handle them.', role: 'High Earner', friend: 4 },
  { name: MAMASAN_BY_ID['suda'].name, icon: '👩', price: 1400, income: 280, perk: 'Spotlight magnet · triple pay on busy nights', kind: 'music', personality: 'Charismatic and bold. Makes every client feel welcome.', quote: 'They will remember this shop.', role: 'Underground Star', friend: 3 },
];
export type Venue = { owner: Owner | null; level: number; risky: boolean; soldRound: number };
export type Game = { round: number; cash: Record<Owner, number>; venues: Venue[]; log: string[]; die: number | null; done: boolean };
export const freshGame = (): Game => ({ round: 1, cash: { you: 1500, alex: 1500 }, venues: businesses.map(() => ({ owner: null, level: 0, risky: false, soldRound: 0 })), log: ['Welcome to Golden Lotus Massage. Hire your first therapist, plan her bookings, then roll the evening.'], die: null, done: false });
export const upgradeCost = (i: number) => businesses[i].kind === 'arcade' ? 200 : 350;
export const assetValue = (g: Game, i: number) => businesses[i].price + g.venues[i].level * upgradeCost(i);
export const netWorth = (g: Game, who: Owner) => g.cash[who] + g.venues.reduce((n, v, i) => n + (v.owner === who ? assetValue(g, i) : 0), 0);
export function earnings(g: Game, i: number, die: number): number {
  const v = g.venues[i], b = businesses[i];
  if (!v.owner) return 0;
  let base = b.income + v.level * 80;
  if (b.kind === 'food') base += 60 * g.venues.filter((other, j) => j !== i && other.owner === v.owner).length;
  if (g.venues[b.friend].owner === v.owner) base += 50;
  if (v.risky && die === 1) return -Math.ceil(base * 0.75);
  const multiplier = die === 2 ? (b.kind === 'cafe' ? 1 : 0.5) : die >= 5 ? (b.kind === 'music' ? 3 : 1.5) : 1;
  return Math.round(base * multiplier * (v.risky ? 1.5 : 1));
}
export function act(g: Game, who: Owner, i: number, action: 'buy' | 'upgrade' | 'sell' | 'risk'): Game {
  if (g.done || !businesses[i]) return g;
  const v = g.venues[i];
  if (action === 'buy' ? v.owner !== null || v.soldRound === g.round || g.cash[who] < businesses[i].price : v.owner !== who) return g;
  if (action === 'upgrade' && (v.level >= 2 || g.cash[who] < upgradeCost(i))) return g;
  const next: Game = { ...g, cash: { ...g.cash }, venues: g.venues.map(x => ({ ...x })), log: [...g.log] };
  const target = next.venues[i];
  const name = who === 'you' ? 'You' : 'Alex';
  if (action === 'buy') { next.cash[who] -= businesses[i].price; target.owner = who; next.log.push(`${name} recruited ${businesses[i].name}. “${businesses[i].quote}”`); }
  if (action === 'upgrade') { next.cash[who] -= upgradeCost(i); target.level++; next.log.push(`${name} trained ${businesses[i].name}.`); }
  if (action === 'sell') { next.cash[who] += Math.floor(assetValue(g, i) * 0.75); target.owner = null; target.level = 0; target.risky = false; target.soldRound = g.round; next.log.push(`${name} ended ${businesses[i].name}’s contract, recovering 75% of the investment.`); }
  if (action === 'risk') target.risky = !target.risky;
  return next;
}
export function rollNight(g: Game, die: number): Game {
  if (g.done || !Number.isInteger(die) || die < 1 || die > 6) return g;
  let next = g;
  // The rival chooses before the shared roll, with no access to its result.
  for (let move = 0; move < 8; move++) {
    const options = businesses.flatMap<{ i: number; action: 'buy' | 'upgrade'; score: number }>((b, i) => {
      const v = next.venues[i];
      if (!v.owner && v.soldRound !== next.round && b.price <= next.cash.alex) return [{ i, action: 'buy' as const, score: b.income / b.price }];
      if (v.owner === 'alex' && v.level < 2 && upgradeCost(i) <= next.cash.alex) return [{ i, action: 'upgrade' as const, score: 80 / upgradeCost(i) }];
      return [];
    }).sort((a, b) => b.score - a.score || a.i - b.i);
    if (!options.length) break;
    next = act(next, 'alex', options[0].i, options[0].action);
  }
  next = { ...next, cash: { ...next.cash }, venues: next.venues.map(v => ({ ...v })), log: [...next.log], die };
  const behind = netWorth(next, 'alex') < netWorth(next, 'you');
  next.venues.forEach(v => { if (v.owner === 'alex') v.risky = behind; });
  const totals = { you: 0, alex: 0 };
  next.venues.forEach((v, i) => { if (v.owner) { const pay = earnings(next, i, die); totals[v.owner] += pay; if (v.owner === "you") next.log.push(`${businesses[i].name}: ${pay < 0 ? "lost" : "earned"} ${Math.abs(pay)}. “${pay < 0 ? "That one is on me. Let me make it up to you." : businesses[i].quote}”`); } });
  next.cash.you = Math.max(0, next.cash.you + totals.you);
  next.cash.alex = Math.max(0, next.cash.alex + totals.alex);
  next.log.push(`Round ${g.round}: rolled ${die}. You ${totals.you < 0 ? 'lost' : 'earned'} $${Math.abs(totals.you)}; Alex ${totals.alex < 0 ? 'lost' : 'earned'} $${Math.abs(totals.alex)}.`);
  next.done = g.round === 10;
  next.round = next.done ? 10 : g.round + 1;
  return next;
}
