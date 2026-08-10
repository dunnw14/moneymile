import { CARD_BY_ID } from '@/content/cards';
import { DISTRICTS } from '@/content/districts';
import { PROPERTY_BY_ID } from '@/content/properties';
import { WORKER_BY_ID } from '@/content/workers';
import { canPlayCard, rivalProperties, rivalWorkers } from '@/engine/effects/cards';
import { ownedProperties, isOperating } from '@/engine/selectors';
import type { CardTarget } from '@/engine/effects/cards';
import type { CardDef, GameState, PlayerId } from '@/types';
import { useState } from 'react';

interface Props {
  state: GameState;
  playerId: PlayerId;
  onPlay: (cardId: string, target: CardTarget) => void;
  onSkip: () => void;
}

export function Hand({ state, playerId, onPlay, onSkip }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const player = state.players[playerId];

  const selectedDef = selected ? CARD_BY_ID[state.cards[selected].defId] : null;
  const needsTarget = selectedDef ? targetOptions(state, playerId, selectedDef).length > 0 : false;

  return (
    <div className="panel">
      <div className="panel-title">
        <h3>Hand ({player.hand.length})</h3>
        {state.phase === 'scheme' && (
          <button className="btn btn-sm" onClick={onSkip}>
            Hold cards
          </button>
        )}
      </div>

      {player.hand.length === 0 ? (
        <p className="empty-note">No cards in hand.</p>
      ) : (
        <div className="hand">
          {player.hand.map((cardId) => {
            const def = CARD_BY_ID[state.cards[cardId].defId];
            const check = canPlayCard(state, playerId, cardId);
            return (
              <button
                key={cardId}
                className={`card ${check.ok ? 'playable' : 'muted'} ${selected === cardId ? 'selected' : ''}`}
                onClick={() => setSelected(selected === cardId ? null : cardId)}
                aria-label={`${def.name}. ${def.effect}. ${check.ok ? 'Playable' : check.reason}`}
              >
                <div className={`card-cat cat-${def.category}`}>
                  {def.category.replace('_', ' ')}
                </div>
                <div className="card-name">{def.name}</div>
                <div className="card-flavour">{def.flavour}</div>
                <div className="card-effect">{def.effect}</div>
                <div className="card-meta">
                  {def.timing} · {def.duration}
                </div>
                {!check.ok && <div className="action-reason">{check.reason}</div>}
              </button>
            );
          })}
        </div>
      )}

      {selected && selectedDef && canPlayCard(state, playerId, selected).ok && (
        <div style={{ marginTop: 10 }}>
          {needsTarget ? (
            <>
              <div className="label" style={{ marginBottom: 5 }}>
                Choose a target
              </div>
              {targetOptions(state, playerId, selectedDef).map((option) => (
                <button
                  key={option.key}
                  className="action-item"
                  onClick={() => {
                    onPlay(selected, option.target);
                    setSelected(null);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </>
          ) : (
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                onPlay(selected, {});
                setSelected(null);
              }}
            >
              Play {selectedDef.name}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface TargetOption {
  key: string;
  label: string;
  target: CardTarget;
}

/** Valid targets for a card, in the form the player picks from. */
export function targetOptions(
  state: GameState,
  playerId: PlayerId,
  def: CardDef,
): TargetOption[] {
  switch (def.target) {
    case 'own_property':
      return ownedProperties(state, playerId)
        .filter((p) => isOperating(state, p))
        .map((p) => ({
          key: `p${p.id}`,
          label: PROPERTY_BY_ID[p.id].name,
          target: { propertyId: p.id },
        }));

    case 'own_worker':
      return state.players[playerId].workers
        .filter((w) => w.propertyId !== null)
        .map((w) => ({
          key: w.id,
          label: `${WORKER_BY_ID[w.profileId].name} at ${PROPERTY_BY_ID[w.propertyId!].name}`,
          target: { workerId: w.id },
        }));

    case 'rival_property':
    case 'any_property':
      return rivalProperties(state, playerId).map((p) => ({
        key: `p${p.id}`,
        label: `${PROPERTY_BY_ID[p.id].name} (${state.players[p.ownerId!].name})`,
        target: { propertyId: p.id },
      }));

    case 'rival_worker':
      return rivalWorkers(state, playerId).map((entry) => ({
        key: entry.workerId,
        label: `${
          WORKER_BY_ID[
            state.players[entry.ownerId].workers.find((w) => w.id === entry.workerId)!.profileId
          ].name
        } (${state.players[entry.ownerId].name})`,
        target: { workerId: entry.workerId },
      }));

    case 'rival_player':
      return state.playerOrder
        .filter((id) => id !== playerId)
        .map((id) => ({
          key: id,
          label: state.players[id].name,
          target: { playerId: id, district: DISTRICTS[0].id },
        }));

    case 'district':
      return DISTRICTS.map((d) => ({
        key: d.id,
        label: d.name,
        target: { district: d.id },
      }));

    case 'police':
      return state.police.flatMap((unit) =>
        rivalProperties(state, playerId).map((p) => ({
          key: `${unit.id}-${p.id}`,
          label: `Send ${unit.id.replace('_', ' ')} toward ${PROPERTY_BY_ID[p.id].name}`,
          target: { policeId: unit.id, propertyId: p.id },
        })),
      );

    default:
      return [];
  }
}
