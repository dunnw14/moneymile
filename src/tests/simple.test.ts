import { describe, expect, it } from 'vitest';
import { act, earnings, freshGame, netWorth, rollNight } from '../simple/game';
describe('solo game', () => {
  it('rewards friendships and team players across the whole roster', () => {
    let g = act(freshGame(), 'you', 0, 'buy');
    g = act(g, 'you', 2, 'buy');
    expect(earnings(g, 0, 3)).toBe(190);
    expect(earnings(g, 2, 3)).toBe(210);
    const independent = act(act(freshGame(), 'you', 2, 'buy'), 'you', 5, 'buy');
    expect(earnings(independent, 2, 3)).toBe(160);
  });
  it('preserves net worth on purchases and upgrades and rejects illegal moves', () => {
    const start = freshGame();
    const bought = act(start, 'you', 1, 'buy');
    expect(start.venues[1].owner).toBeNull();
    expect(netWorth(bought, 'you')).toBe(1500);
    const upgraded = act(bought, 'you', 1, 'upgrade');
    expect(netWorth(upgraded, 'you')).toBe(1500);
    expect(act(upgraded, 'alex', 1, 'sell')).toBe(upgraded);
    expect(act(upgraded, 'you', 7, 'buy')).toBe(upgraded);
  });
  it('applies business perks and the all-in inspection loss', () => {
    let g = act(freshGame(), 'you', 0, 'buy');
    expect(earnings(g, 0, 2)).toBe(140);
    g = act(g, 'you', 0, 'risk');
    expect(earnings(g, 0, 1)).toBe(-105);
    expect(earnings(g, 0, 3)).toBe(210);
    const music = act(freshGame(), 'you', 3, 'buy');
    expect(earnings(music, 3, 5)).toBe(720);
    let food = act(freshGame(), 'you', 2, 'buy');
    food = act(food, 'you', 1, 'buy');
    expect(earnings(food, 2, 3)).toBe(160);
  });
  it('sells at a discount and prevents same-round repurchase', () => {
    let g = act(freshGame(), 'you', 0, 'buy');
    g = act(g, 'you', 0, 'sell');
    expect(g.cash.you).toBe(1350);
    expect(act(g, 'you', 0, 'buy')).toBe(g);
    g = rollNight(g, 3);
    expect(act(g, 'you', 0, 'buy').venues[0].owner).toBe('you');
  });
  it('uses the same result for both sides and ends after exactly ten rolls', () => {
    let g = act(freshGame(), 'you', 0, 'buy');
    const next = rollNight(g, 3);
    expect(next.cash.you).toBe(1040);
    expect(next.venues.some(v => v.owner === 'alex')).toBe(true);
    expect(next.die).toBe(3);
    for (let i = 0; i < 10; i++) g = rollNight(g, 3);
    expect(g.done).toBe(true);
    expect(g.round).toBe(10);
    expect(rollNight(g, 6)).toBe(g);
    expect(act(g, 'you', 0, 'risk')).toBe(g);
  });
});
