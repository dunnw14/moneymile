# Massage Monopoly: guided pitch demo

The default app now launches the authored ten-chapter rivalry in src/demo/DemoApp.tsx. Run npm run dev and open the Local URL printed by Vite (usually http://localhost:5173/).

The opening deals Siriporn (45), Golden Lotus, a separate $1,800 recruitment budget and $600 operating cash. You and Alex alternate picks from six adult staff cards, with a maximum of three recruits each. Locking your team opens a dedicated curtain reveal of the board, then a full turn: assign staff, choose an approach and spin, collect income, draw a strategy card, play it, allocate cash, and end the turn. Waterfront placement adds $25 per worker. Training costs $150 and adds $50 to all future nights. Jade Garden can be bought for $500. Cards rotate deterministically through VIP Booking, Bad Review and Tip-Off; their effects apply immediately. Later chapters adapt to the drafted team and transfer recruited staff away from Alex. Each chapter offers two choices and introduces one idea: risk, investment versus attack, location synergy, exploiting an opening, momentum, police recovery, retaliation, anticipating patrols, defending a lead, and converting a lucky card. Alex reacts after each move. The first board reveal uses curtains; payouts rain cash; police temporarily close Golden Lotus and deduct money.

This is a pitch sequence, not a balanced competitive simulation. Outcomes are authored and shown before selection. All 1,024 choice routes end in victory, while cash, attention, recruits and property vary. Attention is narrative feedback rather than a random enforcement calculation. Progress is saved separately in localStorage; Restart begins again. The About this demo panel explains these constraints in the app.

The previous freeform prototype and original engine remain in the repository for future development. Their rules are retained below as historical reference and do not describe the current default demo.

---

# Massage Monopoly prototype

## Roster and draft economics

12 adult characters make a contested pool: if both captains draft three, six remain for later rounds. One recruitment per side per round makes every denial meaningful, while the two-investment limit leaves training and territory as alternatives after the roster is exhausted. This is a design hypothesis, not a claim that balance has been proven by playtesting.

Each captain starts with $1,800 in cash and three randomly scattered properties worth $1,000 each. Contracts cost $350–$1,800 and count toward empire value, so starting net worth is equal before earnings. A premium recruit uses the full budget and earns strongly alone; cheaper recruits offer more occupied rooms, friendship combinations and a cash reserve. Draft picks alternate, are final, and stop at three or when no recruit is affordable. Either captain can field fewer than three.

Four traits each use the discrete bell-shaped histogram [1, 3, 4, 3, 1] across ratings 1–5. Age and ethnicity do not modify gameplay. Every character has an explicit earning advantage and an economic drawback. Ages range from 23 to 56; Chinese, Filipino, Thai, Japanese, Korean and Indian characters appear twice each.

Attractiveness increases bookings. Friendliness improves quiet-night earnings and shared-room synergy. Aggression increases Party Quarter earnings and busy-night probability but raises enforcement exposure. Sneakiness reduces inspection probability. Staff retainers depend on contract price. Rooms, operating reserves and training costs prevent hiring from being automatically optimal.

## Territory and consequences

The board contains 19 axial hexes within radius two. Six non-overlapping starting properties are shuffled from a seed stored implicitly in the resulting game state; ownership remains fixed across refreshes. Equal asset values preserve starting wealth, but geographic advantages intentionally vary. The map stays hidden until the draft ends, then a red curtain reveals the honeycomb.

Green premium, blue waterfront, purple party and red backstreet districts have visible advantages and drawbacks. Three owned properties in one district yield a 10% booking bonus. Patrols pressure their hex and adjacent hexes. A shared demand sample and police sample correlate events across the city; the second night is intentionally forced to police for demonstration.

Police remove at most one asset per side per strike. In the backstreets, a property may be seized; elsewhere a staff contract is lost. The final shop cannot be seized. Displaced staff return to reception. The cash forecast includes operating and expected inspection losses, but excludes future asset value loss; the UI states this limitation. The affected board is shown during the result. Selling a non-final property for $850 provides a recovery path.

## Strategy and opponent

Twelve original-game card designs have explicitly adapted effects. Cards change cash, hire prices, training costs, property prices, staff allegiance, property availability or police exposure. Rival-targeted changes apply immediately, before the computer's investment decisions. Cards require legal targets; the player may discard instead of playing. Police protection and insurance provide defensive and recovery choices.

Each side gets two investments and one recruitment per round. Training raises base bookings by $65, up to twice. Alex's turn exposes the card, recruit/train, buy/train, placement and patrol decisions sequentially. Same price, room and action limits apply to both sides. The UI supports native drag/drop, touch pointer placement and a click-to-confirm fallback.

## Art

Portraits were generated with built-in ImageGen. `public/images/cast-portraits-v2.png` is a four-column, three-row portrait atlas with distinct backgrounds. The full generation prompt is saved beside it. The original cast names are used; ages, ethnicities, personalities and gameplay ratings are prototype additions.
