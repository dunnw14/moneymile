import { DISTRICTS } from '@/content/districts';
import { POLICE_BY_ID } from '@/content/police';
import { PROPERTIES, PROPERTY_BY_ID } from '@/content/properties';
import { propertyHeatFor } from '@/engine/calculations/heat';
import {
  effectiveCapacity,
  isOpen,
  isOperating,
  isLicensed,
  policePressure,
} from '@/engine/selectors';
import { hexCorners, hexToPixel } from '@/utils/hex';
import { formatMoney } from '@/utils/money';
import type { GameState, Hex, PropertyId } from '@/types';

const SIZE = 52;
const PAD = 48;

/**
 * Districts occupy 2x2 blocks of the hex grid. A small pixel gap between blocks
 * is inserted at *render time only* — the engine's adjacency still uses true
 * axial coordinates — so district identity is readable and their labels have
 * somewhere to sit.
 */
const BLOCK_GAP_X = 24;
// Tall enough that a district label clears the bottom of the block above it.
const BLOCK_GAP_Y = 52;

function renderPos(hex: Hex): { x: number; y: number } {
  const base = hexToPixel(hex, SIZE);
  return {
    x: base.x + Math.floor(hex.q / 2) * BLOCK_GAP_X,
    y: base.y + Math.floor(hex.r / 2) * BLOCK_GAP_Y,
  };
}

interface Props {
  state: GameState;
  selectedPropertyId: PropertyId | null;
  targetablePropertyIds: PropertyId[];
  onSelectProperty: (id: PropertyId) => void;
}

/**
 * The board.
 *
 * Each hex carries only what is readable at a glance — name, owner, occupancy,
 * licence, Heat, and a Police warning. Everything else lives in the context
 * panel once a Property is selected.
 *
 * Rendering is two-pass: every polygon is drawn first, then every label. Drawing
 * them per-hex meant a later hex's fill painted over an earlier hex's text.
 */
export function HexBoard({
  state,
  selectedPropertyId,
  targetablePropertyIds,
  onSelectProperty,
}: Props) {
  const cells = PROPERTIES.map((def) => ({ def, ...renderPos(def.hex) }));

  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const minX = Math.min(...xs) - SIZE - PAD;
  const maxX = Math.max(...xs) + SIZE + PAD;
  const minY = Math.min(...ys) - SIZE - PAD;
  const maxY = Math.max(...ys) + SIZE + PAD;
  const width = maxX - minX;
  const height = maxY - minY;

  const activePlayerId = state.playerOrder[state.activePlayerIndex];

  const classesFor = (def: (typeof PROPERTIES)[number]) => {
    const property = state.properties[def.id];
    const pressure = policePressure(state, def.id);
    const canBuy =
      property.ownerId === null &&
      state.phase === 'operate' &&
      state.players[activePlayerId].cleanCash >= def.cost;

    const classes = ['hex-cell'];
    if (selectedPropertyId === def.id) classes.push('selected');
    if (targetablePropertyIds.includes(def.id)) classes.push('targetable');
    if (canBuy) classes.push('purchasable');
    if (pressure >= 3 && property.ownerId) classes.push('danger');
    if (!isOpen(state, property)) classes.push('closed');
    return { classes: classes.join(' '), canBuy };
  };

  return (
    <svg
      className="board-svg"
      viewBox={`${minX} ${minY} ${width} ${height}`}
      width={width}
      height={height}
      role="group"
      aria-label="Money Mile city board"
    >
      {/* ---------------------------------------- pass 1: shapes */}
      {cells.map(({ def, x, y }) => {
        const { classes, canBuy } = classesFor(def);
        const property = state.properties[def.id];
        const owner = property.ownerId ? state.players[property.ownerId] : null;

        const description = [
          def.name,
          owner ? `owned by ${owner.name}` : 'unowned',
          isLicensed(property) ? 'Licensed' : 'Unlicensed',
          `${property.workerIds.length} of ${effectiveCapacity(state, property)} Workers`,
          `Property Heat ${propertyHeatFor(state, def.id)}`,
          isOperating(state, property)
            ? 'operating'
            : isOpen(state, property)
              ? 'no Mamasan'
              : 'closed',
          policePressure(state, def.id) > 0
            ? `under Police pressure ${policePressure(state, def.id)}`
            : '',
        ]
          .filter(Boolean)
          .join(', ');

        return (
          <g
            key={def.id}
            className={classes}
            transform={`translate(${x},${y})`}
            onClick={() => onSelectProperty(def.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectProperty(def.id);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={description}
          >
            <polygon className="hex-shape" points={hexCorners(0, 0, SIZE)} />
            {canBuy && (
              <polygon
                className="pulse"
                points={hexCorners(0, 0, SIZE - 5)}
                fill="none"
                stroke="var(--success)"
                strokeWidth={1}
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      {/* ---------------------------------------- district labels (over the shapes) */}
      {DISTRICTS.map((district) => {
        const pts = district.properties.map((id) => renderPos(PROPERTY_BY_ID[id].hex));
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const top = Math.min(...pts.map((p) => p.y));
        return (
          <text
            key={district.id}
            className="district-label"
            x={cx}
            y={top - SIZE - 12}
            textAnchor="middle"
          >
            {district.name}
          </text>
        );
      })}

      {/* ---------------------------------------- pass 2: contents */}
      {cells.map(({ def, x, y }) => {
        const property = state.properties[def.id];
        const owner = property.ownerId ? state.players[property.ownerId] : null;
        const heat = propertyHeatFor(state, def.id);
        const open = isOpen(state, property);
        const operating = isOperating(state, property);
        const capacity = effectiveCapacity(state, property);

        return (
          <g key={`c-${def.id}`} transform={`translate(${x},${y})`} pointerEvents="none">
            {/* Owner band */}
            {owner && (
              <rect
                x={-28}
                y={-38}
                width={56}
                height={4}
                rx={2}
                fill={owner.colour}
                opacity={open ? 1 : 0.4}
              />
            )}

            <text className="hex-name" y={-17}>
              {truncate(def.name, 16)}
            </text>

            <text className="hex-meta" y={-1}>
              {isLicensed(property) ? 'LIC' : 'UNL'} · {property.workerIds.length}/{capacity}
            </text>

            {/* Heat pips */}
            {heat > 0 && (
              <g transform="translate(0,11)">
                {Array.from({ length: Math.min(heat, 6) }).map((_, i) => (
                  <circle
                    key={i}
                    cx={(i - (Math.min(heat, 6) - 1) / 2) * 7}
                    cy={0}
                    r={2.4}
                    fill="var(--danger)"
                    opacity={0.55 + i * 0.07}
                  />
                ))}
              </g>
            )}

            {/* Mamasan marker */}
            {property.mamasanId && <circle cx={-34} cy={9} r={5} fill="var(--gold)" opacity={0.9} />}

            {/* Upgrade slots — bottom-right, clear of the price line */}
            <g transform="translate(31,31)">
              {Array.from({ length: def.upgradeSlots }).map((_, i) => (
                <rect
                  key={i}
                  x={-i * 6}
                  y={-3}
                  width={4}
                  height={6}
                  rx={1}
                  fill={i < property.upgradeIds.length ? 'var(--cyan)' : 'none'}
                  stroke="var(--line-strong)"
                  strokeWidth={1}
                />
              ))}
            </g>

            {property.ownerId === null && (
              <text className="hex-price" y={26}>
                {formatMoney(def.cost)}
              </text>
            )}

            {!open && (
              <text className="hex-meta" y={26} fill="var(--danger)">
                CLOSED
              </text>
            )}

            {open && property.ownerId !== null && !operating && (
              <text className="hex-meta" y={26} fill="var(--gold)">
                NO MAMASAN
              </text>
            )}
          </g>
        );
      })}

      {/* ---------------------------------------- police */}
      {state.police.map((unit, index) => {
        const { x, y } = renderPos(unit.hex);
        const def = POLICE_BY_ID[unit.id];
        const colour =
          unit.id === 'local_patrol'
            ? 'var(--cyan)'
            : unit.id === 'vice_squad'
              ? 'var(--danger)'
              : 'var(--gold)';
        // Offset so co-located units stay individually readable.
        const dx = (index - 1) * 16;

        return (
          <g
            key={unit.id}
            className="police-token"
            transform={`translate(${x + dx},${y - 38})`}
            role="img"
            aria-label={`${def.name} at hex ${unit.hex.q},${unit.hex.r}. ${def.specialty}`}
          >
            <title>
              {def.name} — {def.specialty}
            </title>
            <circle r={11} fill="var(--bg)" stroke={colour} strokeWidth={2} />
            <text
              y={4}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
              fill={colour}
              pointerEvents="none"
            >
              {unit.id === 'local_patrol' ? 'P' : unit.id === 'vice_squad' ? 'V' : 'F'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
