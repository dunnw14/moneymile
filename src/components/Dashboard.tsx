import { BALANCE } from '@/content/balance';
import { cleanNetWorthBreakdown } from '@/engine/selectors';
import {
  capacityUtilisationPct,
  controlledDistricts,
  ownedProperties,
  totalWorkerCapacity,
  assignedWorkerCount,
} from '@/engine/selectors';
import { cleanWealthProgress, empireProgress } from '@/engine/calculations/victory';
import { formatMoney } from '@/utils/money';
import type { GameState, PlayerId } from '@/types';

interface Props {
  state: GameState;
  playerId: PlayerId;
  onDeclare: (type: 'clean_wealth' | 'empire') => void;
}

export function Dashboard({ state, playerId, onDeclare }: Props) {
  const player = state.players[playerId];
  const netWorth = cleanNetWorthBreakdown(state, playerId);
  const owned = ownedProperties(state, playerId);
  const capacity = totalWorkerCapacity(state, playerId);
  const assigned = assignedWorkerCount(state, playerId);
  const districts = controlledDistricts(state, playerId);

  const cleanWealth = cleanWealthProgress(state, playerId);
  const empire = empireProgress(state, playerId);
  const canDeclare = state.declaration === null && !state.gameOver;

  return (
    <>
      <div className="panel">
        <div className="dash-name">
          <span className="swatch" style={{ background: player.colour }} />
          {player.name}
        </div>

        <div className="cash-row">
          <div className="cash-box cash-clean">
            <div className="label">Clean</div>
            <div className="amount">{formatMoney(player.cleanCash)}</div>
          </div>
          <div className="cash-box cash-dirty">
            <div className="label">Dirty</div>
            <div className="amount">{formatMoney(player.dirtyCash)}</div>
          </div>
        </div>

        <Meter
          label="Heat"
          value={player.heat}
          max={BALANCE.heat.max}
          floor={player.notoriety}
          state={heatState(player.heat)}
        />
        <Meter label="Notoriety" value={player.notoriety} max={BALANCE.notoriety.max} floor={0} state="" />

        <div className="stat-line">
          <span className="k">Clean Net Worth</span>
          <span className="v" style={{ color: 'var(--gold)' }}>
            {formatMoney(netWorth.total)}
          </span>
        </div>
        <div className="stat-line">
          <span className="k">Actions left</span>
          <span className="v">{player.actionsRemaining}</span>
        </div>
        <div className="stat-line">
          <span className="k">Properties</span>
          <span className="v">{owned.length}</span>
        </div>
        <div className="stat-line">
          <span className="k">Districts</span>
          <span className="v">{districts.length}</span>
        </div>
        <div className="stat-line">
          <span className="k">Capacity used</span>
          <span className="v">
            {assigned}/{capacity} ({capacityUtilisationPct(state, playerId)}%)
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h3>Net worth breakdown</h3>
        </div>
        <div className="stat-line">
          <span className="k">Clean Cash</span>
          <span className="v">{formatMoney(netWorth.cleanCash)}</span>
        </div>
        <div className="stat-line">
          <span className="k">Licensed Properties (75%)</span>
          <span className="v">{formatMoney(netWorth.licensedProperties)}</span>
        </div>
        <div className="stat-line">
          <span className="k">Unlicensed Properties (25%)</span>
          <span className="v">{formatMoney(netWorth.unlicensedProperties)}</span>
        </div>
        <div className="stat-line">
          <span className="k">Legal Upgrades (50%)</span>
          <span className="v">{formatMoney(netWorth.legalUpgrades)}</span>
        </div>
        <div className="stat-line">
          <span className="k">Dirty Cash</span>
          <span className="v" style={{ color: 'var(--ink-faint)' }}>
            counts as zero
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h3>Victory progress</h3>
        </div>

        <VictoryBlock title="Clean Wealth" progress={cleanWealth} />
        {cleanWealth.eligible && canDeclare && (
          <button className="btn btn-primary btn-block btn-sm" onClick={() => onDeclare('clean_wealth')}>
            Declare Clean Wealth Victory
          </button>
        )}

        <div style={{ height: 10 }} />

        <VictoryBlock title="Empire" progress={empire} />
        {empire.eligible && canDeclare && (
          <button className="btn btn-primary btn-block btn-sm" onClick={() => onDeclare('empire')}>
            Declare Empire Victory
          </button>
        )}
      </div>
    </>
  );
}

function VictoryBlock({
  title,
  progress,
}: {
  title: string;
  progress: ReturnType<typeof cleanWealthProgress>;
}) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 4 }}>
        {title}
        {progress.eligible ? ' — available' : ''}
      </div>
      {progress.requirements.map((req) => (
        <div className={`vp-req ${req.met ? 'met' : ''}`} key={req.label}>
          <span className="k">
            {req.met ? '✓' : '·'} {req.label}
          </span>
          <span className="v">
            {req.current} / {req.required}
          </span>
        </div>
      ))}
    </div>
  );
}

function heatState(heat: number): string {
  if (heat >= 9) return 'Burning';
  if (heat >= 6) return 'Hot';
  if (heat >= 3) return 'Warm';
  return 'Cold';
}

function Meter({
  label,
  value,
  max,
  floor,
  state,
}: {
  label: string;
  value: number;
  max: number;
  floor: number;
  state: string;
}) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="label">{label}</span>
        <span className="mono" style={{ fontSize: 12 }}>
          {value}/{max} {state && <span style={{ color: 'var(--ink-faint)' }}>{state}</span>}
        </span>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label} ${value} of ${max}`}
      >
        {Array.from({ length: max }).map((_, i) => {
          const on = i < value;
          const isFloor = i < floor;
          const hot = on && i >= 5;
          return (
            <div
              key={i}
              className={`meter-pip ${on ? 'on' : ''} ${hot ? 'hot' : ''} ${isFloor ? 'floor' : ''}`}
            />
          );
        })}
      </div>
    </div>
  );
}
