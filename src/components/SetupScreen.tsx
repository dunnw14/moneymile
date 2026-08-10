import { useState } from 'react';
import { randomSeed } from '@/engine/rng';
import { parseGameState } from '@/state/persistence';
import type { GameState } from '@/types';

interface Props {
  onStart: (names: string[], seed: string, reducedMotion: boolean) => void;
  onResume: () => void;
  onImport: (state: GameState) => void;
  canResume: boolean;
}

const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

export function SetupScreen({ onStart, onResume, onImport, canResume }: Props) {
  const [count, setCount] = useState(4);
  const [names, setNames] = useState(DEFAULT_NAMES);
  const [seed, setSeed] = useState('');
  const [reducedMotion, setReducedMotion] = useState(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseGameState(String(reader.result));
      if (result.ok && result.state) {
        setImportError(null);
        onImport(result.state);
      } else {
        setImportError(result.error ?? 'That file could not be loaded.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="setup">
      <h1>Money Mile</h1>
      <p className="tagline">
        Build a nightlife business empire, and decide how much risk you will carry to grow faster
        than everyone else. 3–4 players, one device.
      </p>

      <div className="panel">
        <div className="field">
          <label className="label" htmlFor="player-count">
            Players
          </label>
          <div className="seg" id="player-count">
            {[3, 4].map((n) => (
              <button
                key={n}
                className={count === n ? 'on' : ''}
                onClick={() => setCount(n)}
                aria-pressed={count === n}
              >
                {n} players
              </button>
            ))}
          </div>
        </div>

        {Array.from({ length: count }).map((_, i) => (
          <div className="field" key={i}>
            <label className="label" htmlFor={`name-${i}`}>
              Player {i + 1}
            </label>
            <input
              id={`name-${i}`}
              type="text"
              value={names[i]}
              maxLength={20}
              onChange={(e) => {
                const next = [...names];
                next[i] = e.target.value;
                setNames(next);
              }}
            />
          </div>
        ))}

        <div className="field">
          <label className="label" htmlFor="seed">
            Seed (optional — the same seed replays the same game)
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              id="seed"
              type="text"
              value={seed}
              placeholder="leave blank for random"
              onChange={(e) => setSeed(e.target.value)}
            />
            <button className="btn" onClick={() => setSeed(randomSeed())}>
              Roll
            </button>
          </div>
        </div>

        <div className="field">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
            <span>Reduced motion</span>
          </label>
        </div>

        <button
          className="btn btn-primary btn-block"
          onClick={() => onStart(names.slice(0, count), seed, reducedMotion)}
        >
          Start game
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h3>Continue</h3>
        </div>
        <button className="btn btn-block" disabled={!canResume} onClick={onResume}>
          {canResume ? 'Resume saved game' : 'No saved game found'}
        </button>

        <div style={{ marginTop: 10 }}>
          <label className="label" htmlFor="import-file">
            Import a game state (.json)
          </label>
          <input id="import-file" type="file" accept="application/json" onChange={handleImport} />
          {importError && (
            <p style={{ color: 'var(--danger)', fontSize: 12.5 }}>{importError}</p>
          )}
        </div>
      </div>

      <p style={{ color: 'var(--ink-faint)', fontSize: 12, textAlign: 'center' }}>
        All Workers in Money Mile are consenting adults. "Unregistered" is a fictional regulatory
        status only.
      </p>
    </div>
  );
}
