/**
 * Money Mile — core type vocabulary.
 *
 * MONEY: every monetary value in the engine is an integer number of *money
 * units*, where 1 unit = $50,000. This keeps the economy free of floating point
 * drift. Only `formatMoney` converts back to dollars for display.
 */

export type MoneyUnits = number;

export type PlayerId = string;
export type PropertyId = number; // 1..24
export type WorkerId = string;
export type MamasanId = string;
export type UpgradeInstanceId = string;
export type CardInstanceId = string;

export type DistrictId =
  | 'laneways'
  | 'waterfront'
  | 'bazaar'
  | 'transit'
  | 'uptown'
  | 'old_quarter';

export type LicenceStatus = 'licensed' | 'unlicensed';
export type WorkerStatusKind = 'vetted' | 'unregistered';

export type UpgradeCategory = 'revenue' | 'security' | 'operations' | 'underworld';
export type CardCategory = 'opportunity' | 'dirty_trick' | 'protection' | 'environment';

export type PoliceUnitId = 'local_patrol' | 'vice_squad' | 'financial_crimes';

export type Phase = 'draw' | 'scheme' | 'operate' | 'resolve' | 'police' | 'close';

export type NightOutcome = 'big' | 'normal' | 'quiet' | 'trouble' | 'raid';

export type VictoryType = 'clean_wealth' | 'empire' | 'final_raid';

/** Axial hex coordinate. */
export interface Hex {
  q: number;
  r: number;
}

// ---------------------------------------------------------------------------
// Content definitions (static; loaded from src/content)
// ---------------------------------------------------------------------------

export interface PropertyDef {
  id: PropertyId;
  name: string;
  district: DistrictId;
  cost: MoneyUnits;
  capacity: number;
  safety: number;
  baseHeat: number;
  /** Revenue multiplier ×100, kept integral (e.g. 0.90 -> 90). */
  multiplier: number;
  upkeep: MoneyUnits;
  licence: LicenceStatus;
  upgradeSlots: number;
  archetype: PropertyArchetype;
  hex: Hex;
}

export type PropertyArchetype =
  | 'underground'
  | 'neighbourhood'
  | 'cash_business'
  | 'boutique'
  | 'volume'
  | 'fortified';

export interface MamasanDef {
  id: string;
  name: string;
  cost: MoneyUnits;
  ability: string;
  /** Machine-readable tag consumed by the calculation layer. */
  tag: MamasanTag;
}

export type MamasanTag =
  | 'recruit_discount'
  | 'base_heat_down'
  | 'purchase_discount'
  | 'big_night_bonus'
  | 'safety_up'
  | 'free_worker_move_in'
  | 'launder_bonus'
  | 'adjacent_bonus'
  | 'vetted_bonus'
  | 'first_unregistered_no_heat'
  | 'vet_discount'
  | 'ignore_disrupted'
  | 'draw_two_keep_one'
  | 'raid_severity_down'
  | 'upkeep_down'
  | 'capacity_up'
  | 'all_vetted_bonus'
  | 'bribe_discount'
  | 'quiet_night_up'
  | 'waive_upkeep_large_empire'
  | 'poach_tax'
  | 'heat_down_after_normal'
  | 'multiplier_up'
  | 'reopen_sooner';

export interface WorkerProfileDef {
  id: string;
  name: string;
  status: WorkerStatusKind;
  cost: MoneyUnits;
  revenue: MoneyUnits;
  stability: number;
  heat: number;
  special: string;
  tag: WorkerTag;
}

export type WorkerTag =
  | 'none'
  | 'boutique_uptown_bonus'
  | 'big_night_bonus'
  | 'buddy_bonus'
  | 'environment_immune'
  | 'free_move'
  | 'cheap_poach'
  | 'party_starter'
  | 'poach_tax'
  | 'holiday_vulnerable'
  | 'notoriety_after_three';

export interface UpgradeDef {
  id: string;
  name: string;
  category: UpgradeCategory;
  cost: MoneyUnits;
  /** Underworld upgrades may be bought with Dirty Cash. */
  dirtyPurchase: boolean;
  effect: string;
  tag: UpgradeTag;
}

export type UpgradeTag =
  | 'multiplier_up'
  | 'per_worker_bonus'
  | 'big_night_up'
  | 'quiet_as_normal'
  | 'safety_up_1'
  | 'raid_worker_shield'
  | 'safe_room'
  | 'safety_up_2'
  | 'capacity_up'
  | 'free_worker_move'
  | 'no_mamasan_needed'
  | 'recruit_discount'
  | 'hidden_room'
  | 'launder_tier_2'
  | 'offshore_books'
  | 'police_contact';

export interface DistrictDef {
  id: DistrictId;
  name: string;
  bonus: string;
  properties: PropertyId[];
}

export interface PoliceDef {
  id: PoliceUnitId;
  name: string;
  movement: number;
  range: number;
  specialty: string;
  start: Hex;
}

export interface CardDef {
  id: string;
  name: string;
  category: CardCategory;
  copies: number;
  flavour: string;
  effect: string;
  timing: CardTiming;
  target: CardTargetType;
  duration: string;
}

export type CardTiming = 'scheme' | 'immediate' | 'reaction';

export type CardTargetType =
  | 'none'
  | 'self'
  | 'own_property'
  | 'own_worker'
  | 'any_property'
  | 'rival_property'
  | 'rival_worker'
  | 'rival_player'
  | 'district'
  | 'police'
  | 'board';

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

export interface WorkerConditions {
  hot?: number; // rounds remaining
  protected?: number;
  unavailable?: number;
  disrupted?: number;
}

export interface WorkerState {
  id: WorkerId;
  profileId: string;
  status: WorkerStatusKind;
  ownerId: PlayerId;
  propertyId: PropertyId | null;
  stability: number;
  conditions: WorkerConditions;
  producingNights: number;
}

export interface MamasanState {
  id: MamasanId;
  defId: string;
  ownerId: PlayerId;
  propertyId: PropertyId | null;
}

export interface UpgradeInstanceState {
  id: UpgradeInstanceId;
  defId: string;
  propertyId: PropertyId;
  disabled: boolean;
}

export interface PropertyState {
  id: PropertyId;
  ownerId: PlayerId | null;
  licensed: boolean;
  heat: number;
  /** null when open; otherwise the round at which it reopens. */
  closedUntilRound: number | null;
  mamasanId: MamasanId | null;
  workerIds: WorkerId[];
  upgradeIds: UpgradeInstanceId[];
  /** Temporary per-property modifiers created by cards. */
  modifiers: PropertyModifier[];
}

export interface PropertyModifier {
  id: string;
  source: string;
  /** Multiplier ×100 applied to potential revenue. */
  multiplier?: number;
  heatDelta?: number;
  capacityDelta?: number;
  safetyDelta?: number;
  forceOutcome?: NightOutcome;
  treatNormalAsBig?: boolean;
  guaranteeAtLeastNormal?: boolean;
  immuneToDirtyTricks?: boolean;
  licenceSuspended?: boolean;
  expiresAtRound: number;
}

export interface PoliceUnitState {
  id: PoliceUnitId;
  hex: Hex;
  /** Extra movement granted by environment effects, cleared each round. */
  bonusMovement: number;
}

export interface CardInstance {
  instanceId: CardInstanceId;
  defId: string;
}

export interface ActiveEnvironment {
  id: string;
  defId: string;
  expiresAtRound: number | null; // null = persists until Economic Reset
  data?: Record<string, unknown>;
}

export interface PlayerStats {
  consecutiveHighHeatTurns: number;
  consecutiveHighUnregisteredRounds: number;
  aggressiveCardsThisRound: number;
  launderTiersUsedThisTurn: number[];
  freeWorkerMovesUsed: number;
  bigNightsThisRound: number;
  heatReductionActionsThisTurn: number;
  recruitsThisRound: number;
}

/**
 * Turn- and round-scoped one-shot effects created by cards. Kept as plain data
 * so a saved game restores mid-turn exactly as it was.
 */
export interface TurnEffects {
  propertyDiscount: MoneyUnits;
  upgradeDiscount: MoneyUnits;
  licenceDiscount: MoneyUnits;
  freeMamasanAction: boolean;
  recruitTwoWithOneAction: boolean;
  raidSeverityModifier: number;
  cancelNextRaid: boolean;
  protectedDirty: MoneyUnits;
  protectedCash: MoneyUnits;
  guaranteedBigProperty: PropertyId | null;
  immuneToFinancialCrimes: boolean;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  colour: string;
  cleanCash: MoneyUnits;
  dirtyCash: MoneyUnits;
  heat: number;
  notoriety: number;
  actionsRemaining: number;
  cardPlayedThisTurn: boolean;
  hand: CardInstanceId[];
  workers: WorkerState[];
  mamasans: MamasanState[];
  stats: PlayerStats;
  turnEffects: TurnEffects;
}

/**
 * Unpaid upkeep is a *choice*, not an automatic penalty, so it becomes a
 * pending decision rather than something the engine silently resolves.
 */
export interface PendingUpkeep {
  playerId: PlayerId;
  /** How many $50k chunks still need a consequence chosen. */
  remaining: number;
}

export type UpkeepChoice = 'heat' | 'disable_upgrade' | 'close_property' | 'emergency_finance';

/**
 * A reaction window. Reaction cards may be played outside their owner's turn,
 * so the engine parks the in-flight effect here and waits.
 */
export interface PendingReaction {
  responderId: PlayerId;
  kind: 'poach' | 'card_play' | 'raid' | 'noise_or_licence';
  prompt: string;
  eligibleCardIds: CardInstanceId[];
  /** Everything needed to either complete or cancel the parked effect. */
  payload: Record<string, unknown>;
}

export interface WheelBreakdownEntry {
  source: string;
  detail: string;
  deltas: Partial<Record<NightOutcome, number>>;
}

export interface WheelState {
  probabilities: Record<NightOutcome, number>;
  breakdown: WheelBreakdownEntry[];
  effectiveRisk: number;
  riskSources: { source: string; points: number }[];
}

export interface RevenueLine {
  propertyId: PropertyId;
  propertyName: string;
  clean: MoneyUnits;
  dirty: MoneyUnits;
  notes: string[];
}

export interface PotentialRevenue {
  clean: MoneyUnits;
  dirty: MoneyUnits;
  lines: RevenueLine[];
}

export interface PendingNight {
  playerId: PlayerId;
  /** What the empire could earn, computed before the spin. Never overwritten. */
  potential: PotentialRevenue;
  wheel: WheelState;
  outcome: NightOutcome | null;
  realisedClean: MoneyUnits;
  realisedDirty: MoneyUnits;
  /** Per-Property outcome after the spin; empty until spun. */
  realisedLines: RevenueLine[];
  consequences: string[];
  spun: boolean;
}

export interface GameEvent {
  id: number;
  round: number;
  phase: Phase;
  playerId: PlayerId | null;
  type: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface VictoryDeclaration {
  playerId: PlayerId;
  type: VictoryType;
  declaredAtRound: number;
  /** Player ids that still owe a final turn. */
  pendingResponders: PlayerId[];
}

export interface GameSettings {
  reducedMotion: boolean;
  showCalculations: boolean;
}

export interface GameState {
  version: number;
  seed: string;
  rngCursor: number;
  round: number;
  phase: Phase;
  turnCounter: number;
  activePlayerIndex: number;
  playerOrder: PlayerId[];
  players: Record<PlayerId, PlayerState>;
  properties: Record<PropertyId, PropertyState>;
  upgrades: Record<UpgradeInstanceId, UpgradeInstanceState>;
  upgradeSupply: Record<string, number>;
  workerSupply: Record<string, number>;
  mamasanSupply: string[];
  police: PoliceUnitState[];
  deck: CardInstanceId[];
  discard: CardInstanceId[];
  cards: Record<CardInstanceId, CardInstance>;
  environment: ActiveEnvironment[];
  pendingNight: PendingNight | null;
  pendingUpkeep: PendingUpkeep | null;
  pendingReaction: PendingReaction | null;
  declaration: VictoryDeclaration | null;
  finalRaidTriggered: boolean;
  /** Nights still owed before the city-wide Raid resolves. */
  finalRaidTurnsRemaining: number;
  finalRaidResolved: boolean;
  gameOver: boolean;
  winnerId: PlayerId | null;
  victoryType: VictoryType | null;
  finalScores: Record<PlayerId, number> | null;
  log: GameEvent[];
  nextEventId: number;
  nextEntityId: number;
  settings: GameSettings;
}
