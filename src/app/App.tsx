import { useCallback, useEffect, useMemo, useState } from 'react';
import { CARD_BY_ID } from '@/content/cards';
import { advancePhase, dispatch, newGame, type Command } from '@/engine';
import { ownedProperties } from '@/engine/selectors';
import { ActionTray } from '@/components/ActionTray';
import { ContextPanel } from '@/components/ContextPanel';
import { Dashboard } from '@/components/Dashboard';
import { Hand, targetOptions } from '@/components/Hand';
import { HexBoard } from '@/components/HexBoard';
import { NightWheel } from '@/components/NightWheel';
import { GameOverModal, HelpModal, ReactionModal, UpkeepModal } from '@/components/Modals';
import { SetupScreen } from '@/components/SetupScreen';
import {
  clearGame,
  downloadGameState,
  hasSnapshot,
  loadGame,
  loadSnapshot,
  saveGame,
  saveSnapshot,
} from '@/state/persistence';
import { formatMoney } from '@/utils/money';
import type { GameAction } from '@/engine/actions';
import type { GameState, PropertyId, UpkeepChoice } from '@/types';

type Drawer = 'dashboard' | 'board' | 'context';

const PHASE_LABEL: Record<string, string> = {
  draw: 'Draw',
  scheme: 'Scheme',
  operate: 'Operate',
  resolve: 'Resolve the Night',
  police: 'Police',
  close: 'Close',
};

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<PropertyId | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer>('board');
  const [canResume, setCanResume] = useState(false);

  useEffect(() => {
    setCanResume(Boolean(loadGame()));
  }, []);

  // Persist after every change so a refresh never loses a game.
  useEffect(() => {
    if (state) saveGame(state);
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const activePlayerId = state ? state.playerOrder[state.activePlayerIndex] : null;

  const send = useCallback(
    (command: Command) => {
      setState((current) => {
        if (!current) return current;
        const actorId =
          command.type === 'RESOLVE_REACTION' && current.pendingReaction
            ? current.pendingReaction.responderId
            : command.type === 'UPKEEP_CHOICE' && current.pendingUpkeep
              ? current.pendingUpkeep.playerId
              : current.playerOrder[current.activePlayerIndex];

        const result = dispatch(current, actorId, command);
        if (!result.ok && result.error) setToast(result.error);
        return result.state;
      });
    },
    [],
  );

  // --- Keyboard shortcuts ---------------------------------------------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!state || state.gameOver) return;
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (event.key === '?') {
        setShowHelp((v) => !v);
      }
      if (event.key === 'Enter' && !state.pendingReaction && !state.pendingUpkeep) {
        if (state.phase !== 'operate') {
          event.preventDefault();
          send({ type: 'ADVANCE_PHASE' });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, send]);

  const targetablePropertyIds = useMemo<PropertyId[]>(() => {
    if (!state || !activePlayerId) return [];
    if (state.phase !== 'operate') return [];
    return ownedProperties(state, activePlayerId).map((p) => p.id);
  }, [state, activePlayerId]);

  // --- Setup ---------------------------------------------------------------
  if (!state) {
    return (
      <SetupScreen
        canResume={canResume}
        onStart={(names, seed, reducedMotion) => {
          const game = newGame({ playerNames: names, seed, reducedMotion });
          setState(game);
          setSelectedPropertyId(null);
        }}
        onResume={() => {
          const saved = loadGame();
          if (saved) setState(saved);
        }}
        onImport={(imported) => setState(imported)}
      />
    );
  }

  const player = state.players[activePlayerId!];
  const rootClass = state.settings.reducedMotion ? 'app reduced-motion' : 'app';

  return (
    <div className={rootClass}>
      {/* ------------------------------------------------- header */}
      <header className="game-header">
        <h1>Money Mile</h1>

        <div className="header-stat">
          <span className="label">Round</span>
          <span className="value mono">{state.round}</span>
        </div>

        <div className="header-stat">
          <span className="label">Turn</span>
          <span className="value" style={{ color: player.colour }}>
            {player.name}
          </span>
        </div>

        <div className="header-stat">
          <span className="label">Phase</span>
          <span className="value">{PHASE_LABEL[state.phase]}</span>
        </div>

        <div className="header-stat">
          <span className="label">Deck</span>
          <span className="value mono">{state.deck.length}</span>
        </div>

        {state.finalRaidTriggered && (
          <div className="badge badge-danger pulse">
            Final Raid — {state.finalRaidTurnsRemaining} Night(s) left
          </div>
        )}

        {state.declaration && (
          <div className="badge badge-gold">
            {state.players[state.declaration.playerId].name} declared victory
          </div>
        )}

        <div className="header-spacer" />

        <button className="btn btn-sm" onClick={() => setShowHelp(true)}>
          Rules (?)
        </button>
        <button className="btn btn-sm" onClick={() => saveSnapshot(state)}>
          Save snapshot
        </button>
        <button
          className="btn btn-sm"
          disabled={!hasSnapshot()}
          onClick={() => {
            const snapshot = loadSnapshot();
            if (snapshot) setState(snapshot);
          }}
        >
          Load snapshot
        </button>
        <button className="btn btn-sm" onClick={() => downloadGameState(state)}>
          Export
        </button>
        <button
          className="btn btn-sm btn-danger"
          onClick={() => {
            if (confirm('Abandon this game and return to setup?')) {
              clearGame();
              setState(null);
            }
          }}
        >
          Quit
        </button>
      </header>

      {/* ------------------------------------------------- drawer tabs (narrow screens) */}
      <div className="drawer-tabs">
        {(['dashboard', 'board', 'context'] as Drawer[]).map((tab) => (
          <button
            key={tab}
            className={drawer === tab ? 'on' : ''}
            onClick={() => setDrawer(tab)}
            aria-pressed={drawer === tab}
          >
            {tab === 'dashboard' ? 'You' : tab === 'board' ? 'Board' : 'Details'}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------- body */}
      <div className="game-body">
        <div className={`column ${drawer === 'dashboard' ? 'drawer-open' : ''}`}>
          <Dashboard
            state={state}
            playerId={activePlayerId!}
            onDeclare={(victoryType) => send({ type: 'DECLARE', victoryType })}
          />

          <div className="panel">
            <div className="panel-title">
              <h3>Current conditions</h3>
            </div>
            {state.environment.length === 0 ? (
              <p className="empty-note">Nothing in force.</p>
            ) : (
              <div className="conditions-strip">
                {state.environment.map((env) => (
                  <span className="condition-tag" key={env.id} title={CARD_BY_ID[env.defId]?.effect}>
                    {CARD_BY_ID[env.defId]?.name ?? env.defId}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">
              <h3>Standings</h3>
            </div>
            <table className="mm">
              <tbody>
                {state.playerOrder.map((id) => (
                  <tr key={id}>
                    <td>
                      <span className="swatch" style={{ background: state.players[id].colour, display: 'inline-block' }} />{' '}
                      {state.players[id].name}
                    </td>
                    <td className="num">H{state.players[id].heat}</td>
                    <td className="num">N{state.players[id].notoriety}</td>
                    <td className="num">{ownedProperties(state, id).length}p</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`column column-board ${drawer === 'board' ? 'drawer-open' : ''}`}>
          <div className="board-wrap">
            <HexBoard
              state={state}
              selectedPropertyId={selectedPropertyId}
              targetablePropertyIds={targetablePropertyIds}
              onSelectProperty={(id) => {
                setSelectedPropertyId(id);
                setDrawer('context');
              }}
            />
          </div>
        </div>

        <div className={`column ${drawer === 'context' ? 'drawer-open' : ''}`}>
          {/* Phase-specific controls */}
          {state.phase === 'draw' && (
            <div className="panel">
              <div className="panel-title">
                <h3>Draw phase</h3>
              </div>
              <p style={{ color: 'var(--ink-dim)' }}>
                {player.name} draws a card. Environment cards resolve immediately for everyone.
              </p>
              <button className="btn btn-primary btn-block" onClick={() => send({ type: 'ADVANCE_PHASE' })}>
                Draw a card
              </button>
            </div>
          )}

          {state.phase === 'scheme' && (
            <Hand
              state={state}
              playerId={activePlayerId!}
              onPlay={(cardId, target) => send({ type: 'PLAY_CARD', cardId, target })}
              onSkip={() => send({ type: 'SKIP_CARD' })}
            />
          )}

          {state.phase === 'operate' && (
            <ActionTray
              state={state}
              playerId={activePlayerId!}
              selectedPropertyId={selectedPropertyId}
              onAction={(action: GameAction) => send({ type: 'ACTION', action })}
              onEndOperate={() => send({ type: 'END_OPERATE' })}
            />
          )}

          {state.phase === 'resolve' && state.pendingNight && (
            <div className="panel">
              <div className="panel-title">
                <h3>The Night</h3>
              </div>
              <NightWheel
                pending={state.pendingNight}
                reducedMotion={state.settings.reducedMotion}
                onSpin={() => send({ type: 'SPIN' })}
                onContinue={() => send({ type: 'ADVANCE_PHASE' })}
              />
            </div>
          )}

          {state.phase === 'police' && (
            <div className="panel">
              <div className="panel-title">
                <h3>Police phase</h3>
              </div>
              <p style={{ color: 'var(--ink-dim)' }}>
                One Police unit moves, drifting toward the hottest Property it can reach, then
                applies pressure to everything nearby.
              </p>
              <button className="btn btn-primary btn-block" onClick={() => send({ type: 'ADVANCE_PHASE' })}>
                Move the Police
              </button>
            </div>
          )}

          {state.phase === 'close' && (
            <div className="panel">
              <div className="panel-title">
                <h3>Close the Night</h3>
              </div>
              <p style={{ color: 'var(--ink-dim)' }}>
                Pay Property upkeep and Empire Overhead, then update Heat and Notoriety.
              </p>
              <ClosePreview state={state} />
              <button className="btn btn-primary btn-block" onClick={() => send({ type: 'ADVANCE_PHASE' })}>
                Pay up and end the turn
              </button>
            </div>
          )}

          <ContextPanel state={state} propertyId={selectedPropertyId} viewerId={activePlayerId!} />

          {/* The hand stays visible outside the Scheme phase, read-only */}
          {state.phase !== 'scheme' && (
            <Hand
              state={state}
              playerId={activePlayerId!}
              onPlay={() => undefined}
              onSkip={() => undefined}
            />
          )}
        </div>
      </div>

      {/* ------------------------------------------------- footer */}
      <footer className="game-footer">
        <div className="header-stat">
          <span className="label">Clean</span>
          <span className="value mono" style={{ color: 'var(--clean)' }}>
            {formatMoney(player.cleanCash)}
          </span>
        </div>
        <div className="header-stat">
          <span className="label">Dirty</span>
          <span className="value mono" style={{ color: 'var(--dirty)' }}>
            {formatMoney(player.dirtyCash)}
          </span>
        </div>
        <div className="header-stat">
          <span className="label">Heat</span>
          <span className="value mono">{player.heat}</span>
        </div>
        <div className="header-stat">
          <span className="label">Actions</span>
          <span className="value mono">{player.actionsRemaining}</span>
        </div>

        <div className="header-spacer" />

        <details style={{ flex: '1 1 320px', minWidth: 260 }}>
          <summary className="label" style={{ cursor: 'pointer' }}>
            Event log ({state.log.length})
          </summary>
          <div className="log">
            {state.log
              .slice(-60)
              .reverse()
              .map((event) => (
                <div className={`log-entry log-${event.type}`} key={event.id}>
                  <span className="rnd">R{event.round}</span>
                  {event.message}
                </div>
              ))}
          </div>
        </details>
      </footer>

      {/* ------------------------------------------------- overlays */}
      {state.pendingReaction && (
        <ReactionModal state={state} onResolve={(cardId) => send({ type: 'RESOLVE_REACTION', cardId })} />
      )}

      {state.pendingUpkeep && (
        <UpkeepModal
          state={state}
          onChoose={(choice: UpkeepChoice) => send({ type: 'UPKEEP_CHOICE', choice })}
        />
      )}

      {state.gameOver && (
        <GameOverModal
          state={state}
          onNewGame={() => {
            clearGame();
            setState(null);
          }}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-panel)',
            border: '1px solid var(--danger-dim)',
            color: 'var(--danger)',
            borderRadius: 8,
            padding: '9px 16px',
            zIndex: 200,
            maxWidth: '90vw',
          }}
        >
          {toast}
        </div>
      )}

      {/* Screen-reader running commentary */}
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
        }}
      >
        {state.log[state.log.length - 1]?.message ?? ''}
      </div>
    </div>
  );
}

/** Shows what the Close phase is about to charge, before it charges it. */
function ClosePreview({ state }: { state: GameState }) {
  const playerId = state.playerOrder[state.activePlayerIndex];
  const owned = ownedProperties(state, playerId);
  const player = state.players[playerId];

  // Mirrors engine/phases.ts empireOverhead.
  const table = [0, 0, 0, 0, 0, 2, 4, 8, 12, 18, 26, 34, 42];
  const overhead =
    owned.length < table.length
      ? table[owned.length]
      : table[table.length - 1] + (owned.length - (table.length - 1)) * 8;

  return (
    <>
      <div className="stat-line">
        <span className="k">Properties</span>
        <span className="v">{owned.length}</span>
      </div>
      <div className="stat-line">
        <span className="k">Empire Overhead</span>
        <span className="v" style={{ color: overhead > 0 ? 'var(--danger)' : undefined }}>
          {formatMoney(overhead)}
        </span>
      </div>
      <div className="stat-line">
        <span className="k">Clean Cash</span>
        <span className="v">{formatMoney(player.cleanCash)}</span>
      </div>
    </>
  );
}

export { advancePhase, targetOptions };
