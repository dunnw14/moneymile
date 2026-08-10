# Assumptions

Where the v0.4 spec was silent, ambiguous, or contradicted itself, this is what
was decided and why. Each one is configurable — the point is that none of these
choices is welded into the architecture.

---

## 1. The money unit is $25,000, not $50,000

**The spec says:** "Represent monetary values as integer units of $50,000… 1
money unit = $50,000."

**The problem:** the spec's own catalogues do not fit that grid. Worker costs
include $125k, $175k and $225k; Worker revenue includes $125k and $175k; and
several bonuses are "+$25k". At $50k per unit those are 2.5, 3.5 and 4.5 units —
non-integers, which defeats the entire stated purpose of the rule.

**Decision:** the base unit is **$25,000**, the true greatest common divisor of
every value in the spec. This preserves the intent (exact integer arithmetic, no
floating-point drift) while actually representing the published numbers.

Set in `BALANCE.MONEY_UNIT`. All display goes through `formatMoney`.

---

## 2. Card copy counts reduced to reach the stated 72-card deck

**The spec says:** a 72-card Night Deck, 18 cards per category.

**The problem:** the card catalogue's own `copies` column sums to **77** —
Opportunity 19, Dirty Trick 19, Protection 19, Environment 20.

**Decision:** every card *design* in the spec is kept; four duplicate copies were
dropped to reach 72 and 18-per-category:

| Category | Card reduced | From | To |
|---|---|---:|---:|
| Opportunity | Packed House | 2 | 1 |
| Dirty Trick | Noise Complaint | 2 | 1 |
| Protection | Trusted Doorman | 2 | 1 |
| Environment | Tourist Season | 2 | 1 |
| Environment | City Crackdown | 2 | 1 |

Reducing copies loses less than cutting whole card designs would. `copies` lives
in `src/content/cards.ts`; restoring the spec's literal numbers is a one-line
change per card, and a test asserts the deck totals.

---

## 3. Upgrade Slots derived from cost tier

**The spec says:** Properties have "Upgrade Slots", but the Property catalogue
has no column for them.

**Decision:** derived from price tier — cheap Properties get 2 slots, mid-range
3, premium 4. This keeps expensive Properties meaningfully better without making
slots a second hidden stat to balance. Values are explicit per Property in
`src/content/properties.ts`, so any one can be tuned individually.

---

## 4. The hex layout

**The spec says:** a 24-Property hex board with six districts, and gives Police
"marked starting hexes" — but no coordinates for anything.

**Decision:** a 6×4 axial grid where each district occupies a 2×2 block. This
makes the spec's own strategic claim true: district concentration is efficient
*and* leaves everything in one block exposed to a single Police unit.

Police start spread across Waterfront, Transit and Bazaar.

At render time only, a pixel gap separates district blocks so their labels have
somewhere to sit. Adjacency is always computed on the true axial coordinates.

---

## 5. One Police unit moves per turn

**The spec says:** "Move the eligible Police unit" — without defining eligible.

**Decision:** the three units cycle, one per turn, in a fixed order
(`turnCounter % 3`). Each moves toward the highest-Heat Property in reach, and
wanders deterministically via the seeded RNG when nothing nearby is interesting.

The alternative — all three moving every turn — made Police pressure
overwhelming in early simulation runs.

---

## 6. Heat is recomputed, not accumulated

**The spec gives** a formula for Player Heat from structural sources
(Unlicensed Properties, Unregistered Workers, Upgrades…) but also lists card
effects and Actions that add and remove Heat.

**Decision:** during the Close phase, structural Heat acts as a **floor** under
the running value rather than replacing it. So a Reduce Heat Action or a
Protection card genuinely lowers Heat, but cannot take a player below what their
empire structurally generates. `max(carried, structural)`, then `max(that,
Notoriety)`.

Without this, either Heat reduction would do nothing, or the structural formula
would be decorative.

---

## 7. Raid severity thresholds

**The spec says** Raid severity "compares exposure against protection" and lists
what feeds each side, but gives no arithmetic.

**Decision:** `score = exposure − protection`, bucketed into five levels
(Contained / Minor / Serious / Major / Catastrophic). Consequences scale by
level, tuned so that a Raid hurts without removing a player from meaningful
participation — the spec is explicit about that requirement.

All thresholds and consequence tables are in `BALANCE.raid`.

---

## 8. Effective Risk on the Night Wheel

**The spec gives** the conversion rule (each risk point past 2 shifts Normal into
Trouble and Raid; past 6 also shifts Quiet into Big) but not how risk points are
counted.

**Decision:** Heat contributes `floor(heat / 2)`, Notoriety contributes its full
value, Police proximity `ceil(pressure / 2)`, plus one per Unlicensed operating
Property, one per two active Unregistered Workers, and one per Underworld
Upgrade. Average Safety across operating Properties buys points back.

Risk is attributed **per source**, so the UI can show exactly which source moved
which probability — the spec requires players always be able to see why their
Wheel changed.

---

## 9. Unpaid upkeep is a real decision

**The spec says** the player chooses which consequence to take.

**Decision:** the Close phase pauses on a `pendingUpkeep` state and waits. It is
not auto-resolved, because auto-resolving would silently discard a genuine
strategic choice. Simulation agents answer it with a heuristic.

---

## 10. Reaction windows

**The spec says** reaction cards may be played outside their owner's turn, but
does not say how the window opens or what can answer what.

**Decision:** a `pendingReaction` state parks the in-flight effect and names the
responder plus the cards that could answer it. If the responder holds no eligible
card, the window never opens and the effect lands immediately — so hot-seat play
is not interrupted for nothing.

Answerable effects: poaching (Staff Loyalty, Counteroffer), Noise Complaint and
Licence Challenge (Community Support), Opportunity plays (Fake Booking), and
Raids (Tip-Off, Good Lawyer).

Because the state is plain data with no callbacks, a reaction window survives
save/load.

---

## 11. Public Holiday and Power Failure pick targets automatically

Both cards ask each player to choose something ("choose a Property to guarantee
a Big Night", "a random District"). Stopping a hot-seat game to poll all four
players during someone else's Draw phase would be disruptive, so:

- **Public Holiday** picks each player's highest-multiplier Property.
- **Power Failure** and **Festival District** pick a District from the seeded RNG.

---

## 12. Closed and seized assets score zero

**The spec says** "seized or closed assets may count for less or nothing."

**Decision:** nothing. A closed Property contributes no value at final scoring,
which makes voluntary closure a genuine trade rather than a free defensive move.

---

## 13. Poaching resolves against Worker Stability

**The spec** describes poaching but not its resolution.

**Decision:** the attacker pays the cost, then a d6 is rolled against the
Worker's Stability — the Worker resists on a roll at or under it. So Stability is
what it is described as: resistance to being taken. Vetted Workers, having higher
Stability, are correspondingly harder to poach, matching the spec's claim.

---

## 14. Game length safety limit

Simulations abandon a game after 40 rounds (`BALANCE.simulation.maxRounds`) and
resolve it as a Final Raid. This is a guard so a batch of 10,000 games always
terminates; in practice it is never reached — the median game is 14 rounds, and
across 400 games none hit the limit.
