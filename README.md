# Money Mile

A 3–4 player hot-seat economic strategy game about building and legitimising a
nightlife business empire. Runs entirely in the browser — no backend, no
accounts, no install.

**▶ Play: https://dunnw14.github.io/moneymile/**

Everything is on one device: players pass the laptop or tablet round, one Night
each. Games save automatically and can be exported to a file.

---

## The idea

There are two economies.

**Clean** operations cost more to establish but give reliable income and count
fully toward victory. **Dirty** operations are cheaper and earn faster, but
generate Heat, permanent Notoriety, and cash that **scores zero** unless it is
laundered — deliberately inefficiently.

The player who makes the most money does not necessarily win. Victory is about
converting growth into something that survives Police pressure, rival attacks
and the Final Raid.

Every turn asks the same question: *how much risk are you willing to carry to
grow faster than everyone else?*

## Running it locally

```bash
npm install
npm run dev          # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Run the engine test suite (67 tests) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run simulate` | Headless balance simulation (see below) |

Node 22 or newer.

## Simulation

The engine runs headlessly with no React dependency, so thousands of games can
be played to check balance.

```bash
npm run simulate -- --games 10000 --players 4
npm run simulate -- --games 500 --players 3 --agents operator,hustler,shark
```

| Flag | Default | Meaning |
|---|---|---|
| `--games` | 500 | Number of games |
| `--players` | 4 | 3 or 4 |
| `--agents` | all six strategies | Comma-separated agent pool |
| `--seed` | `sim` | Seed prefix — reruns are reproducible |
| `--out` | `simulation-output/report` | Output path, without extension |
| `--verbose` | off | Progress to stderr |

Agents: `operator`, `hustler`, `shark`, `fortress`, `baron`, `hybrid`, `random`.

Writes a JSON report and a CSV, and prints a summary that flags any balance
target from the spec that has been breached. Current findings are recorded in
[`docs/BALANCE.md`](docs/BALANCE.md).

## How it is put together

```
src/
  content/      Every Property, Mamasan, Worker, Upgrade, Card, District, Police
                unit and balance constant. Pure data — no logic.
  engine/       The rules. Deterministic, serialisable, no React import.
    actions/      validate -> calculate -> execute for each Operate Action
    calculations/ revenue, Night Wheel, Heat, Raids, victory, environment
    effects/      card and environment effects
    selectors/    derived reads (capacity, safety, net worth, districts…)
    rng/          seeded RNG
    phases.ts     the six-phase turn loop
    core.ts       state primitives that enforce the integrity rules
  simulation/   headless agents and the balance runner
  components/   React UI
  state/        localStorage persistence, import validation
  types/        the shared type vocabulary
```

Three rules hold the design together:

**The engine never imports React, and the UI never mutates state.** Every
command goes through `dispatch(state, playerId, command)` and returns a new
state. That is what lets the same engine run 10,000 headless games.

**Determinism is total.** The engine never calls `Math.random`. All randomness
comes from a seeded stream whose cursor lives inside the game state, so the same
seed and the same actions always produce the same game — and a saved game
resumes on the exact same random sequence it left on.

**Money is integers.** Every monetary value is a whole number of $25,000 units.
Only the display layer converts to dollars.

Further reading:

- [`docs/RULES.md`](docs/RULES.md) — the player manual
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the engine works
- [`docs/BALANCE.md`](docs/BALANCE.md) — simulation results and open questions
- [`docs/ASSUMPTIONS.md`](docs/ASSUMPTIONS.md) — where the spec was ambiguous or
  self-contradictory, and what was decided

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which typechecks,
runs the tests, builds, and publishes to GitHub Pages. The build fails the
deploy if either the typecheck or the tests fail.

The production build sets `base: '/moneymile/'`. If you fork this under a
different repository name, set `MM_BASE` accordingly.

## Content note

Money Mile is fiction about running licensed and unlicensed nightlife
businesses. All Workers are consenting adults, and "Unregistered" refers only to
a fictional regulatory status. There are no minors, no coercion, no ownership of
people, no immigration mechanics and no sexualised art anywhere in the game.
Characters are represented abstractly.
