# Balance

Findings from the headless simulation. Reproduce any of this with:

```bash
npm run simulate -- --games 400 --players 4 --seed sim
```

## Health check

Across **400 four-player games** (seed prefix `sim`):

| Measure | Result | Target | |
|---|---:|---|---|
| Games completed | 400 / 400 | all | ✅ |
| Median game length | 14 rounds | 8–16 | ✅ |
| Mean game length | 14.3 rounds | — | |
| First-player win rate | 23.3% | ≤ 29% | ✅ |
| Most common Property in winning portfolios | 36.3% (Neon Bar) | ≤ 75% | ✅ |
| Most common Mamasan | below threshold | ≤ 70% | ✅ |
| Most common Upgrade | below threshold | ≤ 70% | ✅ |

No game deadlocked, ran away, or hit the 40-round safety limit. Seat balance is
good: 23.3 / 20.5 / 22.8 / 33.5 percent by seat.

## Open problems

Two balance targets are **not** met. Both are real and both are recorded here
rather than papered over.

### 1. Operator dominates; Hustler, Shark and Baron are non-competitive

| Strategy | Win rate | Target band |
|---|---:|---|
| Operator | 79.3% | 18–32% ❌ |
| Fortress | 37.5% | 18–32% ❌ |
| Hybrid | 20.3% | ✅ |
| Shark | 7.9% | 18–32% ❌ |
| Hustler | 3.0% | 18–32% ❌ |
| Baron | 2.2% | 18–32% ❌ |

The two Clean-leaning strategies take 117% of the band between them while the
three risk-leaning ones share 13%.

**Read this with a caveat.** Part of the gap is agent quality rather than game
balance. The agents are weighted heuristics with no lookahead: the Hustler
accumulates Dirty Cash but is not smart about *when* to convert it, and
laundering is deliberately lossy, so it ends up holding a pile that scores zero.
A human Hustler would launder and vet far more deliberately in the late game.

But the direction is almost certainly real, because the scoring rules point that
way: Dirty Cash scores 0%, Underworld Upgrades score 0%, and the best laundering
tier returns only 66.7%. Underground play has to out-earn Clean play by roughly
50% just to break even at scoring, and then it also pays for the Heat and
Notoriety it generates.

Levers, in the order worth trying:

1. Raise Tier 1 laundering retention, or make Cash Businesses meaningfully better
   at it (`BALANCE.laundering`).
2. Score Unlicensed Properties above 25% (`BALANCE.scoring`).
3. Increase the revenue gap between Unregistered and Vetted Workers
   (`src/content/workers.ts`).

### 2. Empire Victory never fires

0% of games, against a 15–40% target.

**Not a bug** — `empireProgress` is unit-tested against a constructed state that
meets every condition, and it correctly reports eligible. The condition is simply
never reached in play: across 400 games the largest winning portfolio was **9
Properties**, and Empire needs 10.

Three things compound:

- **Empire Overhead.** At 10 Properties it is $650k *per turn*, on top of
  per-Property upkeep.
- **A Mamasan in every operating Property** — ten Mamasans, at $100k–$200k each.
- **50% capacity utilisation** across 10 Properties needs roughly 15–20 Workers,
  each of which costs money and, if Unregistered, generates Heat.

The three requirements pull against each other: paying for the Workers to hit
utilisation makes the overhead harder to cover, and closing anything to save
money breaks the "no more than two closed" clause.

Levers:

1. Flatten the overhead curve past 8 Properties
   (`BALANCE.upkeep.overheadByPropertyCount`).
2. Drop the Empire threshold to 9 Properties
   (`BALANCE.victory.empire.minProperties`).
3. Lower the utilisation requirement to 40%.

Option 2 is the smallest change that would test the path, and the simulation
shows 9 is exactly reachable today.

## Note on the numbers

Every threshold quoted here is the spec's own balance target, implemented in
`buildReport` in `src/simulation/runner/index.ts`. The runner flags them
automatically, so re-running after any tuning change immediately shows what
moved.

Nothing in the game has been tuned to make these numbers look better. The
economy is the spec's, transposed to $25k units.
