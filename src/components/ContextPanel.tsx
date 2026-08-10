import { MAMASAN_BY_ID } from '@/content/mamasans';
import { PROPERTY_BY_ID } from '@/content/properties';
import { UPGRADE_BY_ID } from '@/content/upgrades';
import { WORKER_BY_ID } from '@/content/workers';
import { propertyHeatFor } from '@/engine/calculations/heat';
import { assessRaid } from '@/engine/calculations/raid';
import { computePropertyRevenue } from '@/engine/calculations/revenue';
import {
  effectiveCapacity,
  effectiveSafety,
  effectiveUpkeep,
  isLicensed,
  isOpen,
  isOperating,
  mamasanAt,
  policePressureDetail,
  upgradesAt,
  workersAt,
} from '@/engine/selectors';
import { formatMoney } from '@/utils/money';
import type { GameState, PlayerId, PropertyId, WorkerState } from '@/types';

interface Props {
  state: GameState;
  propertyId: PropertyId | null;
  viewerId: PlayerId;
}

export function ContextPanel({ state, propertyId, viewerId }: Props) {
  if (propertyId === null) {
    return (
      <div className="panel">
        <div className="panel-title">
          <h3>Details</h3>
        </div>
        <p className="empty-note">
          Select a Property on the board to inspect its stats, Workers, Mamasan and Raid exposure.
        </p>
      </div>
    );
  }

  const def = PROPERTY_BY_ID[propertyId];
  const property = state.properties[propertyId];
  const owner = property.ownerId ? state.players[property.ownerId] : null;
  const mamasan = mamasanAt(state, property);
  const workers = workersAt(state, property);
  const upgrades = upgradesAt(state, property);
  const pressure = policePressureDetail(state, propertyId);
  const revenue = computePropertyRevenue(state, property, null);
  const operating = isOperating(state, property);

  return (
    <div className="panel">
      <div className="panel-title">
        <h3>{def.name}</h3>
        <span className={`badge ${isLicensed(property) ? 'badge-clean' : 'badge-gold'}`}>
          {isLicensed(property) ? 'Licensed' : 'Unlicensed'}
        </span>
      </div>

      <div style={{ marginBottom: 10, color: 'var(--ink-dim)', fontSize: 12.5 }}>
        {capitalise(def.district.replace('_', ' '))} · {capitalise(def.archetype.replace('_', ' '))}
        {owner ? (
          <>
            {' · '}
            <span style={{ color: owner.colour }}>{owner.name}</span>
          </>
        ) : (
          ' · unowned'
        )}
      </div>

      {!isOpen(state, property) && (
        <div className="badge badge-danger" style={{ marginBottom: 8 }}>
          Closed until round {property.closedUntilRound}
        </div>
      )}

      {owner && isOpen(state, property) && !operating && (
        <div
          style={{
            background: 'rgba(240,180,94,0.1)',
            border: '1px solid var(--gold-dim)',
            borderRadius: 6,
            padding: '6px 9px',
            marginBottom: 8,
            fontSize: 12,
            color: 'var(--gold)',
          }}
        >
          Property will remain inactive until a Mamasan is assigned.
        </div>
      )}

      <div className="stat-line">
        <span className="k">Cost</span>
        <span className="v">{formatMoney(def.cost)}</span>
      </div>
      <div className="stat-line">
        <span className="k">Capacity</span>
        <span className="v">
          {property.workerIds.length}/{effectiveCapacity(state, property)}
        </span>
      </div>
      <div className="stat-line">
        <span className="k">Safety</span>
        <span className="v">{effectiveSafety(state, property)}</span>
      </div>
      <div className="stat-line">
        <span className="k">Property Heat</span>
        <span className="v" style={{ color: propertyHeatFor(state, propertyId) >= 4 ? 'var(--danger)' : undefined }}>
          {propertyHeatFor(state, propertyId)}
        </span>
      </div>
      <div className="stat-line">
        <span className="k">Revenue Multiplier</span>
        <span className="v">{(def.multiplier / 100).toFixed(2)}</span>
      </div>
      <div className="stat-line">
        <span className="k">Upkeep</span>
        <span className="v">{formatMoney(effectiveUpkeep(state, property))}</span>
      </div>
      {operating && (
        <div className="stat-line">
          <span className="k">Potential tonight</span>
          <span className="v">
            <span style={{ color: 'var(--clean)' }}>{formatMoney(revenue.clean)}</span>
            {' / '}
            <span style={{ color: 'var(--dirty)' }}>{formatMoney(revenue.dirty)}</span>
          </span>
        </div>
      )}

      {/* Mamasan */}
      <div className="label action-group-title">Mamasan</div>
      {mamasan ? (
        <div style={{ fontSize: 12.5 }}>
          <strong style={{ color: 'var(--gold)' }}>{mamasan.def.name}</strong>
          <div style={{ color: 'var(--ink-dim)' }}>{mamasan.def.ability}</div>
        </div>
      ) : (
        <p className="empty-note">None assigned.</p>
      )}

      {/* Workers */}
      <div className="label action-group-title">Workers ({workers.length})</div>
      {workers.length === 0 ? (
        <p className="empty-note">No Workers assigned.</p>
      ) : (
        <div>
          {workers.map((worker) => (
            <WorkerChip key={worker.id} worker={worker} />
          ))}
        </div>
      )}

      {/* Upgrades */}
      <div className="label action-group-title">
        Upgrades ({property.upgradeIds.length}/{def.upgradeSlots})
      </div>
      {upgrades.length === 0 ? (
        <p className="empty-note">No Upgrades installed.</p>
      ) : (
        upgrades.map(({ instance, def: upgradeDef }) => (
          <div key={instance.id} style={{ fontSize: 12.5, padding: '2px 0' }}>
            <span className={`badge badge-${instance.disabled ? 'danger' : 'dim'}`}>
              {upgradeDef.category}
            </span>{' '}
            {upgradeDef.name}
            {instance.disabled && <span style={{ color: 'var(--danger)' }}> — disabled</span>}
            <div style={{ color: 'var(--ink-faint)', fontSize: 11.5 }}>{upgradeDef.effect}</div>
          </div>
        ))
      )}

      {/* Modifiers */}
      {property.modifiers.length > 0 && (
        <>
          <div className="label action-group-title">Active effects</div>
          <div className="conditions-strip">
            {property.modifiers.map((mod) => (
              <span className="condition-tag" key={mod.id}>
                {mod.source}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Police */}
      {pressure.length > 0 && (
        <>
          <div className="label action-group-title">Police pressure</div>
          {pressure.map((entry) => (
            <div key={entry.unit.id} className="stat-line">
              <span className="k">
                {entry.unit.name} ({entry.distance === 0 ? 'same hex' : `${entry.distance} hex`})
              </span>
              <span className="v" style={{ color: 'var(--danger)' }}>
                +{entry.pressure}
              </span>
            </div>
          ))}
        </>
      )}

      {/* Raid exposure — only for the viewer's own Properties */}
      {owner?.id === viewerId && operating && (
        <>
          <div className="label action-group-title">If a Raid landed here</div>
          <RaidPreview state={state} propertyId={propertyId} playerId={viewerId} />
        </>
      )}
    </div>
  );
}

function RaidPreview({
  state,
  propertyId,
  playerId,
}: {
  state: GameState;
  propertyId: PropertyId;
  playerId: PlayerId;
}) {
  const assessment = assessRaid(state, playerId, state.properties[propertyId]);
  return (
    <div>
      <div className="stat-line">
        <span className="k">Severity</span>
        <span className="v" style={{ color: assessment.level >= 3 ? 'var(--danger)' : 'var(--gold)' }}>
          {assessment.label}
        </span>
      </div>
      <div className="breakdown">
        {assessment.exposure.map((entry) => (
          <div className="breakdown-row" key={`e-${entry.source}`}>
            <span style={{ color: 'var(--danger)' }}>{entry.source}</span>
            <span>+{entry.value}</span>
          </div>
        ))}
        {assessment.protection.map((entry) => (
          <div className="breakdown-row" key={`p-${entry.source}`}>
            <span style={{ color: 'var(--cyan)' }}>{entry.source}</span>
            <span>-{entry.value}</span>
          </div>
        ))}
        <div className="breakdown-row" style={{ borderTop: '1px solid var(--line)', marginTop: 3, paddingTop: 3 }}>
          <span>Score</span>
          <span>{assessment.score}</span>
        </div>
      </div>
    </div>
  );
}

function WorkerChip({ worker }: { worker: WorkerState }) {
  const profile = WORKER_BY_ID[worker.profileId];
  const conditions: string[] = [];
  if (worker.conditions.hot) conditions.push('Hot');
  if (worker.conditions.protected) conditions.push('Protected');
  if (worker.conditions.unavailable) conditions.push('Unavailable');
  if (worker.conditions.disrupted) conditions.push('Disrupted');

  const impaired = Boolean(worker.conditions.unavailable || worker.conditions.disrupted);

  return (
    <span
      className={`worker-chip ${worker.status} ${impaired ? 'impaired' : ''}`}
      title={`${profile.name} — ${profile.special}`}
    >
      <span aria-hidden="true">{worker.status === 'vetted' ? '✓' : '!'}</span>
      {profile.name}
      <span className="mono" style={{ color: 'var(--ink-faint)' }}>
        {formatMoney(profile.revenue)}
      </span>
      {conditions.map((c) => (
        <span key={c} className="badge badge-dim" style={{ marginLeft: 2 }}>
          {c}
        </span>
      ))}
    </span>
  );
}

export function MamasanName(defId: string): string {
  return MAMASAN_BY_ID[defId]?.name ?? defId;
}

export function UpgradeName(defId: string): string {
  return UPGRADE_BY_ID[defId]?.name ?? defId;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
