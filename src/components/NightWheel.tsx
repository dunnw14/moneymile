import { useState } from 'react';
import { explainOutcome } from '@/engine/calculations/wheel';
import { formatMoney } from '@/utils/money';
import type { NightOutcome, PendingNight } from '@/types';

const OUTCOMES: { id: NightOutcome; label: string; colour: string }[] = [
  { id: 'big', label: 'Big Night', colour: '#f0b45e' },
  { id: 'normal', label: 'Normal', colour: '#5ec8f0' },
  { id: 'quiet', label: 'Quiet', colour: '#6a6885' },
  { id: 'trouble', label: 'Trouble', colour: '#f0905e' },
  { id: 'raid', label: 'Raid', colour: '#f0605e' },
];

const RADIUS = 74;

interface Props {
  pending: PendingNight;
  onSpin: () => void;
  onContinue: () => void;
  reducedMotion: boolean;
}

/**
 * The Night Wheel.
 *
 * Segment sizes are the real probabilities, and every one of them can be
 * expanded into the list of contributions that produced it — the player should
 * never have to guess why their odds changed.
 */
export function NightWheel({ pending, onSpin, onContinue, reducedMotion }: Props) {
  const [expanded, setExpanded] = useState<NightOutcome | null>(null);
  const { wheel, potential, outcome, spun } = pending;

  let angle = -90;
  const segments = OUTCOMES.map((entry) => {
    const pct = wheel.probabilities[entry.id];
    const sweep = (pct / 100) * 360;
    const path = arcPath(0, 0, RADIUS, angle, angle + sweep);
    const mid = angle + sweep / 2;
    angle += sweep;
    return { ...entry, pct, path, mid };
  });

  return (
    <div>
      {spun && outcome && (
        <div className={`outcome-banner outcome-${outcome}`}>
          <h2>{OUTCOMES.find((o) => o.id === outcome)!.label}</h2>
          <div className="mono">
            {formatMoney(pending.realisedClean)} Clean · {formatMoney(pending.realisedDirty)} Dirty
          </div>
        </div>
      )}

      <div className="wheel-layout">
        <svg
          className="wheel-svg"
          width={RADIUS * 2 + 8}
          height={RADIUS * 2 + 8}
          viewBox={`${-RADIUS - 4} ${-RADIUS - 4} ${RADIUS * 2 + 8} ${RADIUS * 2 + 8}`}
          role="img"
          aria-label={`Night Wheel: ${segments.map((s) => `${s.label} ${s.pct}%`).join(', ')}`}
        >
          {segments.map((segment) =>
            segment.pct > 0 ? (
              <path
                key={segment.id}
                d={segment.path}
                fill={segment.colour}
                opacity={outcome && outcome !== segment.id ? 0.22 : 0.85}
                stroke="var(--bg)"
                strokeWidth={1.5}
                className={!spun && segment.id === 'raid' && segment.pct >= 10 && !reducedMotion ? 'pulse' : ''}
              />
            ) : null,
          )}
          <circle r={RADIUS * 0.42} fill="var(--bg-panel)" stroke="var(--line-strong)" />
          <text
            textAnchor="middle"
            y={-3}
            fontSize={11}
            fill="var(--ink-dim)"
            style={{ letterSpacing: '0.1em' }}
          >
            RISK
          </text>
          <text
            textAnchor="middle"
            y={15}
            fontSize={19}
            fontWeight={700}
            fill={wheel.effectiveRisk >= 7 ? 'var(--danger)' : 'var(--gold)'}
          >
            {wheel.effectiveRisk}
          </text>
        </svg>

        <div className="wheel-legend">
          {segments.map((segment) => (
            <div key={segment.id}>
              <button
                className="wheel-row"
                onClick={() => setExpanded(expanded === segment.id ? null : segment.id)}
                aria-expanded={expanded === segment.id}
              >
                <span className="dot" style={{ background: segment.colour }} />
                <span>{segment.label}</span>
                <span className="pct">{segment.pct}%</span>
              </button>

              {expanded === segment.id && (
                <div className="breakdown">
                  {explainOutcome(wheel, segment.id).map((line, i) => (
                    <div className="breakdown-row" key={i}>
                      <span>{line.source}</span>
                      <span>
                        {line.delta > 0 ? '+' : ''}
                        {line.delta}%
                      </span>
                    </div>
                  ))}
                  {explainOutcome(wheel, segment.id).length === 0 && (
                    <div className="empty-note">No modifiers affect this outcome.</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panel-title">
          <h3>{spun ? 'Realised revenue' : 'Potential revenue'}</h3>
        </div>
        <div className="stat-line">
          <span className="k">Clean</span>
          <span className="v" style={{ color: 'var(--clean)' }}>
            {formatMoney(spun ? pending.realisedClean : potential.clean)}
          </span>
        </div>
        <div className="stat-line">
          <span className="k">Dirty</span>
          <span className="v" style={{ color: 'var(--dirty)' }}>
            {formatMoney(spun ? pending.realisedDirty : potential.dirty)}
          </span>
        </div>
        {spun && (
          <div className="stat-line">
            <span className="k">Was potentially</span>
            <span className="v" style={{ color: 'var(--ink-faint)' }}>
              {formatMoney(potential.clean)} / {formatMoney(potential.dirty)}
            </span>
          </div>
        )}

        {(spun ? pending.realisedLines : potential.lines).length > 0 && (
          <div className="scroll-x" style={{ marginTop: 8 }}>
            <table className="mm">
              <thead>
                <tr>
                  <th>Property</th>
                  <th style={{ textAlign: 'right' }}>Clean</th>
                  <th style={{ textAlign: 'right' }}>Dirty</th>
                </tr>
              </thead>
              <tbody>
                {(spun ? pending.realisedLines : potential.lines).map((line) => (
                  <tr key={line.propertyId}>
                    <td>
                      {line.propertyName}
                      {line.notes.length > 0 && (
                        <div style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
                          {line.notes.join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="num">{formatMoney(line.clean)}</td>
                    <td className="num">{formatMoney(line.dirty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pending.consequences.length > 0 && (
        <div className="panel">
          <div className="panel-title">
            <h3>Consequences</h3>
          </div>
          {pending.consequences.map((line, i) => (
            <div key={i} style={{ color: 'var(--danger)', fontSize: 12.5, padding: '2px 0' }}>
              {line}
            </div>
          ))}
        </div>
      )}

      {!spun ? (
        <button className="btn btn-primary btn-block" onClick={onSpin}>
          Spin the Night
        </button>
      ) : (
        <button className="btn btn-primary btn-block" onClick={onContinue}>
          Continue to Police Phase
        </button>
      )}
    </div>
  );
}

/** SVG pie slice. A full 100% segment is drawn as a circle to avoid a zero-length arc. */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 359.999) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  }
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
