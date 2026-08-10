import { useEffect, useRef } from 'react';
import { BALANCE } from '@/content/balance';
import { CARD_BY_ID } from '@/content/cards';
import { DISTRICTS } from '@/content/districts';
import { formatMoney } from '@/utils/money';
import { cleanNetWorthBreakdown } from '@/engine/selectors';
import type { GameState, UpkeepChoice } from '@/types';

/** Traps focus inside a modal so keyboard users cannot tab out behind it. */
function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const node = ref.current;
    const previous = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [active]);

  return ref;
}

// ---------------------------------------------------------------------------
// Unpaid upkeep
// ---------------------------------------------------------------------------

export function UpkeepModal({
  state,
  onChoose,
}: {
  state: GameState;
  onChoose: (choice: UpkeepChoice) => void;
}) {
  const ref = useFocusTrap(true);
  const pending = state.pendingUpkeep!;
  const player = state.players[pending.playerId];

  const choices: { id: UpkeepChoice; label: string; detail: string }[] = [
    { id: 'heat', label: 'Take 1 Heat', detail: 'Cheapest now, worse if you are already Hot.' },
    {
      id: 'disable_upgrade',
      label: 'Disable one Upgrade',
      detail: `Repairing it later costs ${formatMoney(BALANCE.property.repairUpgradeCost)} and an Action.`,
    },
    {
      id: 'close_property',
      label: 'Close one Property',
      detail: 'It earns nothing next round, but it also stops attracting attention.',
    },
    {
      id: 'emergency_finance',
      label: `Take ${formatMoney(BALANCE.upkeep.emergencyFinanceDirty)} Dirty emergency finance`,
      detail: '+1 Notoriety, which is permanent. Last resort.',
    },
  ];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Unpaid upkeep">
      <div className="modal" ref={ref} style={{ maxWidth: 480 }}>
        <h2>Unpaid upkeep</h2>
        <p style={{ color: 'var(--ink-dim)' }}>
          {player.name} could not cover the bill. Choose a consequence.
          {pending.remaining > 1 && (
            <strong style={{ color: 'var(--danger)' }}> {pending.remaining} remaining.</strong>
          )}
        </p>
        {choices.map((choice) => (
          <button key={choice.id} className="action-item" onClick={() => onChoose(choice.id)}>
            <strong>{choice.label}</strong>
            <span className="action-reason" style={{ color: 'var(--ink-faint)' }}>
              {choice.detail}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reaction window
// ---------------------------------------------------------------------------

export function ReactionModal({
  state,
  onResolve,
}: {
  state: GameState;
  onResolve: (cardId: string | null) => void;
}) {
  const ref = useFocusTrap(true);
  const pending = state.pendingReaction!;
  const responder = state.players[pending.responderId];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Reaction window">
      <div className="modal" ref={ref} style={{ maxWidth: 560 }}>
        <h2>{responder.name} may react</h2>
        <p style={{ color: 'var(--ink-dim)' }}>{pending.prompt}</p>

        <div className="hand" style={{ marginTop: 10 }}>
          {pending.eligibleCardIds.map((cardId) => {
            const def = CARD_BY_ID[state.cards[cardId].defId];
            return (
              <button key={cardId} className="card playable" onClick={() => onResolve(cardId)}>
                <div className={`card-cat cat-${def.category}`}>{def.category}</div>
                <div className="card-name">{def.name}</div>
                <div className="card-effect">{def.effect}</div>
              </button>
            );
          })}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={() => onResolve(null)}>
            Let it happen
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

export function GameOverModal({
  state,
  onNewGame,
}: {
  state: GameState;
  onNewGame: () => void;
}) {
  const ref = useFocusTrap(true);
  const winner = state.winnerId ? state.players[state.winnerId] : null;

  const typeLabel = {
    clean_wealth: 'Clean Wealth Victory',
    empire: 'Empire Victory',
    final_raid: 'Final Raid',
  }[state.victoryType ?? 'final_raid'];

  const ranked = [...state.playerOrder].sort(
    (a, b) => (state.finalScores?.[b] ?? 0) - (state.finalScores?.[a] ?? 0),
  );

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Game over">
      <div className="modal" ref={ref} style={{ maxWidth: 520 }}>
        <h2>{typeLabel}</h2>
        {winner && (
          <p style={{ fontSize: 17 }}>
            <span className="swatch" style={{ background: winner.colour, display: 'inline-block' }} />{' '}
            <strong style={{ color: winner.colour }}>{winner.name}</strong> wins.
          </p>
        )}

        <h3>Final Clean Net Worth</h3>
        <table className="mm">
          <thead>
            <tr>
              <th>Player</th>
              <th style={{ textAlign: 'right' }}>Clean Cash</th>
              <th style={{ textAlign: 'right' }}>Assets</th>
              <th style={{ textAlign: 'right' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((id) => {
              const breakdown = cleanNetWorthBreakdown(state, id);
              return (
                <tr key={id}>
                  <td style={{ color: state.players[id].colour }}>{state.players[id].name}</td>
                  <td className="num">{formatMoney(breakdown.cleanCash)}</td>
                  <td className="num">
                    {formatMoney(
                      breakdown.licensedProperties +
                        breakdown.unlicensedProperties +
                        breakdown.legalUpgrades,
                    )}
                  </td>
                  <td className="num" style={{ color: 'var(--gold)' }}>
                    {formatMoney(breakdown.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p style={{ color: 'var(--ink-faint)', fontSize: 12, marginTop: 10 }}>
          Dirty Cash and Underworld Upgrades count as zero. Seed: <code>{state.seed}</code>
        </p>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onNewGame}>
            New game
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rules / help
// ---------------------------------------------------------------------------

export function HelpModal({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Rules">
      <div className="modal" ref={ref}>
        <h2>Money Mile — how it works</h2>

        <p>
          Build a nightlife business empire and convert it into something that survives. Every turn
          asks one question: <em>how much risk are you willing to carry to grow faster than
          everyone else?</em>
        </p>

        <h3>The two economies</h3>
        <p>
          <strong style={{ color: 'var(--clean)' }}>Clean</strong> operations cost more up front but
          give reliable income and count fully toward victory.{' '}
          <strong style={{ color: 'var(--dirty)' }}>Dirty</strong> operations are cheaper and earn
          faster, but produce Heat, Notoriety and cash that{' '}
          <strong>counts as zero at scoring</strong> unless you launder it — deliberately
          inefficiently.
        </p>

        <h3>Your turn — one Night</h3>
        <p className="mono" style={{ color: 'var(--gold)' }}>
          Draw → Scheme → Operate → Resolve → Police → Close
        </p>
        <ul style={{ color: 'var(--ink-dim)', paddingLeft: 18 }}>
          <li><strong>Draw</strong> one card. Environment cards resolve immediately for everyone.</li>
          <li><strong>Scheme</strong> — play one card, or hold.</li>
          <li><strong>Operate</strong> — take two Actions.</li>
          <li><strong>Resolve</strong> — spin the Night Wheel and collect.</li>
          <li><strong>Police</strong> — one unit moves and applies pressure.</li>
          <li><strong>Close</strong> — pay upkeep, update Heat and Notoriety.</li>
        </ul>

        <h3>Properties need a Mamasan</h3>
        <p>
          A Property with no Mamasan produces <strong>no revenue at all</strong>, cannot recruit and
          cannot use its abilities. Buying a Property is only half the purchase.
        </p>

        <h3>Heat and Notoriety</h3>
        <p>
          Heat (0–10) is your current exposure and moves both ways. Notoriety (0–5) is permanent and
          acts as a <strong>floor under your Heat</strong> — the more you accumulate, the harder it
          becomes to ever return to a quiet strategy.
        </p>

        <h3>The Night Wheel</h3>
        <p>
          Segment sizes are the real probabilities. Click any outcome to see exactly which sources
          moved it. Risk comes from Heat, Notoriety, Police proximity, Unlicensed Properties,
          Unregistered Workers and Underworld Upgrades; Safety buys it back.
        </p>

        <h3>Winning</h3>
        <ul style={{ color: 'var(--ink-dim)', paddingLeft: 18 }}>
          <li>
            <strong>Clean Wealth</strong> — hit the Clean Net Worth, Clean Cash and lead thresholds,
            then survive one final turn from every opponent.
          </li>
          <li>
            <strong>Empire</strong> — {BALANCE.victory.empire.minProperties}+ Properties, two
            Districts, {BALANCE.victory.empire.minCapacityUtilisationPct}% capacity used, a Mamasan
            everywhere, and at most {BALANCE.victory.empire.maxClosedProperties} closed.
          </li>
          <li>
            <strong>Final Raid</strong> — hidden in the last cards of the deck. When it appears,
            everyone gets one last Night, then a city-wide Raid. Highest surviving Clean Net Worth
            wins.
          </li>
        </ul>

        <h3>Districts</h3>
        <table className="mm">
          <tbody>
            {DISTRICTS.map((d) => (
              <tr key={d.id}>
                <td style={{ color: 'var(--gold)' }}>{d.name}</td>
                <td>{d.bonus}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color: 'var(--ink-faint)', fontSize: 12 }}>
          Control needs {BALANCE.district.controlThreshold} of a District's four Properties.
          Concentration is efficient — and puts everything within reach of one Police unit.
        </p>

        <h3>A note on the setting</h3>
        <p style={{ color: 'var(--ink-dim)' }}>
          All Workers are consenting adults. "Unregistered" is a fictional regulatory status and
          nothing more.
        </p>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
