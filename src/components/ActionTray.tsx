import { useState } from 'react';
import { MAMASANS } from '@/content/mamasans';
import { PROPERTY_BY_ID } from '@/content/properties';
import { UPGRADES } from '@/content/upgrades';
import { WORKER_PROFILES } from '@/content/workers';
import {
  availableLaunderTiers,
  isOpen,
  isOperating,
  ownedProperties,
  upgradesAt,
} from '@/engine/selectors';
import {
  launderYield,
  licenceCost,
  propertyPrice,
  recruitCost,
  upgradePrice,
  validateAction,
  vetCost,
  type GameAction,
} from '@/engine/actions';
import { BALANCE } from '@/content/balance';
import { formatMoney } from '@/utils/money';
import type { GameState, PlayerId, PropertyId } from '@/types';

interface Props {
  state: GameState;
  playerId: PlayerId;
  selectedPropertyId: PropertyId | null;
  onAction: (action: GameAction) => void;
  onEndOperate: () => void;
}

/**
 * The Action tray.
 *
 * Every Action is always listed. Ones that cannot be taken stay visible but
 * disabled, carrying the exact reason — a player should never have to guess why
 * something is unavailable.
 */
export function ActionTray({ state, playerId, selectedPropertyId, onAction, onEndOperate }: Props) {
  const [confirming, setConfirming] = useState<GameAction | null>(null);
  const player = state.players[playerId];
  const owned = ownedProperties(state, playerId);
  const property = selectedPropertyId !== null ? state.properties[selectedPropertyId] : null;

  const run = (action: GameAction) => {
    const validation = validateAction(state, playerId, action);
    if (!validation.ok) return;
    // Costly or irreversible moves get a confirmation with the full preview.
    const cost = (validation.cleanCost ?? 0) + (validation.dirtyCost ?? 0);
    if (cost >= 8 || action.type === 'BUY_PROPERTY') setConfirming(action);
    else onAction(action);
  };

  return (
    <>
      <div className="panel">
        <div className="panel-title">
          <h3>Actions</h3>
          <span className="mono" style={{ fontSize: 12 }}>
            {player.actionsRemaining} left
          </span>
        </div>

        {/* --- Property-scoped actions --------------------------------- */}
        {property === null ? (
          <p className="empty-note">Select a Property to see the Actions available there.</p>
        ) : (
          <>
            <div className="label" style={{ marginBottom: 6 }}>
              {PROPERTY_BY_ID[property.id].name}
            </div>

            {property.ownerId === null && (
              <ActionButton
                state={state}
                playerId={playerId}
                action={{ type: 'BUY_PROPERTY', propertyId: property.id }}
                label="Buy Property"
                cost={propertyPrice(state, playerId, property.id)}
                onRun={run}
              />
            )}

            {property.ownerId === playerId && (
              <>
                {!property.licensed && (
                  <ActionButton
                    state={state}
                    playerId={playerId}
                    action={{ type: 'LICENCE_PROPERTY', propertyId: property.id }}
                    label="Licence Property"
                    cost={licenceCost(state, playerId)}
                    onRun={run}
                  />
                )}

                {!isOpen(state, property) && (
                  <ActionButton
                    state={state}
                    playerId={playerId}
                    action={{ type: 'REOPEN_PROPERTY', propertyId: property.id }}
                    label="Reopen Property"
                    cost={BALANCE.property.reopenCost}
                    onRun={run}
                  />
                )}

                {upgradesAt(state, property)
                  .filter((u) => u.instance.disabled)
                  .map((u) => (
                    <ActionButton
                      key={u.instance.id}
                      state={state}
                      playerId={playerId}
                      action={{ type: 'REPAIR_UPGRADE', upgradeId: u.instance.id }}
                      label={`Repair ${u.def.name}`}
                      cost={BALANCE.property.repairUpgradeCost}
                      onRun={run}
                    />
                  ))}

                <Collapsible title="Hire Mamasan" disabled={property.mamasanId !== null}>
                  {state.mamasanSupply.slice(0, 24).map((defId) => {
                    const def = MAMASANS.find((m) => m.id === defId)!;
                    return (
                      <ActionButton
                        key={defId}
                        state={state}
                        playerId={playerId}
                        action={{ type: 'HIRE_MAMASAN', mamasanDefId: defId, propertyId: property.id }}
                        label={`${def.name} — ${def.ability}`}
                        cost={def.cost}
                        onRun={run}
                      />
                    );
                  })}
                </Collapsible>

                <Collapsible title="Recruit Worker">
                  {WORKER_PROFILES.map((profile) => (
                    <ActionButton
                      key={profile.id}
                      state={state}
                      playerId={playerId}
                      action={{
                        type: 'RECRUIT_WORKER',
                        profileId: profile.id,
                        propertyId: property.id,
                      }}
                      label={`${profile.name} (${profile.status}, earns ${formatMoney(profile.revenue)}) — ${state.workerSupply[profile.id]} left`}
                      cost={recruitCost(state, playerId, profile.id, property.id)}
                      onRun={run}
                    />
                  ))}
                </Collapsible>

                <Collapsible title="Buy Upgrade">
                  {UPGRADES.map((upgrade) => (
                    <ActionButton
                      key={upgrade.id}
                      state={state}
                      playerId={playerId}
                      action={{
                        type: 'BUY_UPGRADE',
                        upgradeDefId: upgrade.id,
                        propertyId: property.id,
                      }}
                      label={`${upgrade.name} — ${upgrade.effect}`}
                      cost={upgradePrice(state, playerId, upgrade.id)}
                      dirty={upgrade.dirtyPurchase}
                      onRun={run}
                    />
                  ))}
                </Collapsible>
              </>
            )}
          </>
        )}

        {/* --- Empire-wide actions ------------------------------------- */}
        <div className="label action-group-title">Empire</div>

        <ActionButton
          state={state}
          playerId={playerId}
          action={{ type: 'REDUCE_HEAT' }}
          label="Reduce Heat"
          cost={BALANCE.heat.reduceHeatActionCost}
          onRun={run}
        />

        {availableLaunderTiers(state, playerId).map((tier) => {
          const { dirty, clean } = launderYield(state, playerId, tier);
          return (
            <ActionButton
              key={tier}
              state={state}
              playerId={playerId}
              action={{ type: 'LAUNDER', tier }}
              label={`Launder Tier ${tier}: ${formatMoney(dirty)} Dirty → ${formatMoney(clean)} Clean`}
              cost={0}
              onRun={run}
            />
          );
        })}

        <Collapsible title="Vet a Worker">
          {player.workers.filter((w) => w.status === 'unregistered').length === 0 ? (
            <p className="empty-note">No Unregistered Workers to vet.</p>
          ) : (
            player.workers
              .filter((w) => w.status === 'unregistered')
              .map((worker) => (
                <ActionButton
                  key={worker.id}
                  state={state}
                  playerId={playerId}
                  action={{ type: 'VET_WORKER', workerId: worker.id }}
                  label={`Vet ${WORKER_PROFILES.find((p) => p.id === worker.profileId)!.name}${
                    worker.propertyId ? ` at ${PROPERTY_BY_ID[worker.propertyId].name}` : ''
                  }`}
                  cost={vetCost(state, playerId, worker.id)}
                  onRun={run}
                />
              ))
          )}
        </Collapsible>

        <Collapsible title="Move a Worker">
          {player.workers.length === 0 ? (
            <p className="empty-note">You have no Workers.</p>
          ) : (
            player.workers.flatMap((worker) =>
              owned
                .filter((p) => p.id !== worker.propertyId && isOperating(state, p))
                .map((target) => (
                  <ActionButton
                    key={`${worker.id}-${target.id}`}
                    state={state}
                    playerId={playerId}
                    action={{
                      type: 'MOVE_WORKER',
                      workerId: worker.id,
                      toPropertyId: target.id,
                    }}
                    label={`${WORKER_PROFILES.find((p) => p.id === worker.profileId)!.name} → ${
                      PROPERTY_BY_ID[target.id].name
                    }`}
                    cost={0}
                    onRun={run}
                  />
                )),
            )
          )}
        </Collapsible>

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 10 }}
          onClick={onEndOperate}
        >
          End Operate → Resolve the Night
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          state={state}
          playerId={playerId}
          action={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            onAction(confirming);
            setConfirming(null);
          }}
        />
      )}
    </>
  );
}

function ActionButton({
  state,
  playerId,
  action,
  label,
  cost,
  dirty,
  onRun,
}: {
  state: GameState;
  playerId: PlayerId;
  action: GameAction;
  label: string;
  cost: number;
  dirty?: boolean;
  onRun: (a: GameAction) => void;
}) {
  const validation = validateAction(state, playerId, action);
  return (
    <button
      className="action-item"
      disabled={!validation.ok}
      onClick={() => onRun(action)}
      title={validation.reason}
    >
      {cost > 0 && (
        <span className="cost" style={{ color: dirty ? 'var(--dirty)' : 'var(--gold)' }}>
          {formatMoney(cost)}
        </span>
      )}
      {label}
      {!validation.ok && <span className="action-reason">{validation.reason}</span>}
    </button>
  );
}

function Collapsible({
  title,
  children,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (disabled) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="btn btn-sm btn-block"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ textAlign: 'left' }}
      >
        {open ? '▾' : '▸'} {title}
      </button>
      {open && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

/** Full cost preview before anything expensive or irreversible. */
function ConfirmDialog({
  state,
  playerId,
  action,
  onCancel,
  onConfirm,
}: {
  state: GameState;
  playerId: PlayerId;
  action: GameAction;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const player = state.players[playerId];
  const validation = validateAction(state, playerId, action);
  const cleanCost = validation.cleanCost ?? 0;
  const dirtyCost = validation.dirtyCost ?? 0;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Confirm action">
      <div className="modal" style={{ maxWidth: 420 }}>
        <h2>Confirm</h2>
        <p style={{ color: 'var(--ink-dim)' }}>{describeAction(action)}</p>

        <div className="stat-line">
          <span className="k">Clean Cash now</span>
          <span className="v">{formatMoney(player.cleanCash)}</span>
        </div>
        {cleanCost !== 0 && (
          <>
            <div className="stat-line">
              <span className="k">Cost</span>
              <span className="v" style={{ color: 'var(--gold)' }}>
                {formatMoney(cleanCost)}
              </span>
            </div>
            <div className="stat-line">
              <span className="k">Clean Cash after</span>
              <span className="v">{formatMoney(player.cleanCash - cleanCost)}</span>
            </div>
          </>
        )}
        {dirtyCost !== 0 && (
          <div className="stat-line">
            <span className="k">Dirty Cash after</span>
            <span className="v" style={{ color: 'var(--dirty)' }}>
              {formatMoney(player.dirtyCash - dirtyCost)}
            </span>
          </div>
        )}
        <div className="stat-line">
          <span className="k">Actions after</span>
          <span className="v">
            {validation.costsAction === false ? player.actionsRemaining : player.actionsRemaining - 1}
          </span>
        </div>
        {validation.heatDelta ? (
          <div className="stat-line">
            <span className="k">Heat</span>
            <span className="v" style={{ color: validation.heatDelta > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {validation.heatDelta > 0 ? '+' : ''}
              {validation.heatDelta}
            </span>
          </div>
        ) : null}
        {validation.notorietyDelta ? (
          <div className="stat-line">
            <span className="k">Notoriety</span>
            <span className="v" style={{ color: 'var(--dirty)' }}>
              +{validation.notorietyDelta} (permanent)
            </span>
          </div>
        ) : null}

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onConfirm}>
            Confirm
          </button>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function describeAction(action: GameAction): string {
  switch (action.type) {
    case 'BUY_PROPERTY':
      return `Buy ${PROPERTY_BY_ID[action.propertyId].name}.`;
    case 'RECRUIT_WORKER':
      return `Recruit a ${WORKER_PROFILES.find((p) => p.id === action.profileId)?.name} at ${
        PROPERTY_BY_ID[action.propertyId].name
      }.`;
    case 'BUY_UPGRADE':
      return `Install ${UPGRADES.find((u) => u.id === action.upgradeDefId)?.name} at ${
        PROPERTY_BY_ID[action.propertyId].name
      }.`;
    case 'HIRE_MAMASAN':
      return `Hire ${MAMASANS.find((m) => m.id === action.mamasanDefId)?.name}.`;
    case 'LICENCE_PROPERTY':
      return `Licence ${PROPERTY_BY_ID[action.propertyId].name}.`;
    case 'VET_WORKER':
      return 'Vet this Worker. They will generate Clean Cash; existing Notoriety is not removed.';
    case 'LAUNDER':
      return `Launder Dirty Cash at Tier ${action.tier}.`;
    default:
      return 'Take this Action.';
  }
}
