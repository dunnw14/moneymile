# Architecture

## The one rule

**The engine is a pure, deterministic, serialisable state machine that knows
nothing about React.** The UI reads state and sends commands; it never mutates.

Everything else follows from that. It is what makes the same code run a hot-seat
game in a browser and 10,000 headless games in a CLI.

```
                    ┌───────────────┐
   React UI ──────► │   dispatch()  │ ──────► new GameState
   Simulation ────► └───────────────┘
                            │
              validate → calculate → execute → emit events
```

## Layers

| Layer | Path | Depends on | Rule |
|---|---|---|---|
| Content | `src/content` | nothing | Pure data. No functions with logic. |
| Types | `src/types` | nothing | The shared vocabulary. |
| Engine | `src/engine` | content, types | No React. No `Math.random`. No I/O. |
| Simulation | `src/simulation` | engine | Headless. Node only. |
| UI | `src/components`, `src/app` | engine, content | Reads and dispatches. Never mutates. |
| Persistence | `src/state` | types | Serialises and **validates** on the way back in. |

A dependency pointing the other way is a bug. The UI importing from `content` is
fine (it needs names and costs to render); `engine` importing from `components`
never is.

## Command flow

Everything the player can do goes through one function:

```ts
dispatch(state: GameState, playerId: PlayerId, command: Command): CommandResult
```

`dispatch` refuses commands out of turn, out of phase, or while an interrupt is
open, and returns `{ state, ok, error }`. A rejected command returns the state
unchanged with a player-facing reason — which is exactly what the UI puts under
the disabled button.

Actions specifically follow **validate → calculate → execute → emit**:

- `validateAction` is pure and never mutates. The UI calls it to decide whether a
  button is enabled *and* what to say when it is not.
- Execution never recomputes a cost validation did not already confirm, so a
  successful validation always implies a successful execution.

This is why `ActionTray` can list every Action in the game, greyed out with a
specific reason, without duplicating a single rule.

## Determinism

The engine never calls `Math.random`.

```ts
const { rng, commit } = rngFor(state);
const roll = rng.next();
commit();               // writes the advanced cursor back into state
```

The cursor lives *in* `GameState`. Consequences:

- The same seed plus the same command sequence produces an identical game.
- A saved game resumes on the exact random sequence it left on — a test asserts
  that a game exported to JSON mid-turn and replayed produces a byte-identical
  event log.
- Simulation agents draw from a **separate** stream (`${seed}:agents`) so agent
  noise never perturbs the game's own sequence.

Wheel animation is presentation only. The result is decided by the seeded stream
before anything moves.

## Money

Every monetary value is an integer number of $25,000 units (see
`docs/ASSUMPTIONS.md` §1). Multipliers are integers ×100.

Only `formatMoney` converts to dollars, and only for display. Nothing in the
engine ever holds a fractional amount of money.

## Interrupts

Two things pause the turn loop, and both are plain serialisable data rather than
callbacks — so they survive save/load:

- `pendingUpkeep` — the player owes a choice of consequence for unpaid upkeep.
- `pendingReaction` — someone may answer an in-flight effect with a reaction card.

While either is set, `dispatch` rejects everything except the command that
resolves it.

## Phases

```
draw → scheme → operate → resolve → police → close → (next player)
```

`advancePhase` runs whatever the current phase entails and returns the next
state. The Resolve phase is two steps — compute and display the Wheel, then spin
— so the player sees their odds *before* committing.

The Close phase can suspend on `pendingUpkeep`; `finishClose` is the second half
and runs once the decision is made.

## Calculations are inspectable

The spec requires that players always see why a number is what it is, so
calculations return breakdowns, not just totals:

- `computeWheel` returns `breakdown[]`, attributing each probability shift to the
  source that caused it, plus `riskSources[]`.
- `assessRaid` returns itemised `exposure[]` and `protection[]` lists.
- `cleanNetWorthBreakdown` splits net worth by asset class.
- `computePotentialRevenue` returns a per-Property line with the modifiers that
  applied.

The UI renders these directly. No calculation is duplicated in a component.

## Testing

`src/tests/engine.test.ts` — 67 tests covering content integrity, setup,
determinism, phase transitions, every integrity rule from the spec, the Wheel
(including that it always totals exactly 100), revenue classification, Actions,
laundering, upkeep, districts, Police, Raids, all three victory paths, final
scoring, import validation, and complete-game integration runs.

The simulation doubles as an integration test: a game that deadlocks or corrupts
state shows up immediately as an unfinished game in the report.
