import type { NightOutcome } from '@/types';

/**
 * Every balance-relevant constant in the game.
 *
 * Money values are units of $25,000. Multipliers are integers x100.
 * Nothing in the engine hard-codes a number that belongs here.
 */
export const BALANCE = {
  /** 1 money unit, in dollars. */
  MONEY_UNIT: 25_000,

  setup: {
    startingCleanCash: 28, // $700k
    startingDirtyCash: 8, // $200k
    startingHeat: 1,
    startingNotoriety: 0,
    startingHandSize: 3,
    startingVettedWorkerProfile: 'local_regular',
    startingUnregisteredWorkerProfile: 'new_arrival',
  },

  turn: {
    actionsPerTurn: 2,
    cardsDrawnPerTurn: 1,
  },

  wheel: {
    base: { big: 20, normal: 50, quiet: 20, trouble: 8, raid: 2 } as Record<NightOutcome, number>,
    /** Risk points above this threshold start converting Normal into Trouble/Raid. */
    riskThreshold: 2,
    /** Risk points above this threshold also convert Quiet into Big (volatility). */
    volatilityThreshold: 6,
    perRiskPoint: { raid: 1, trouble: 1, normal: -2 },
    perVolatilityPoint: { big: 1, quiet: -1 },
    maxEffectiveRisk: 14,
    /** Outcome revenue multipliers, x100. */
    outcomeMultiplier: { big: 150, normal: 100, quiet: 50, trouble: 50, raid: 0 } as Record<
      NightOutcome,
      number
    >,
  },

  heat: {
    min: 0,
    max: 10,
    /** Active Unregistered Workers per +1 player Heat. */
    unregisteredWorkersPerHeat: 2,
    reduceHeatActionAmount: 2,
    reduceHeatActionCost: 4, // $100k
    propertyHeatMax: 6,
  },

  notoriety: {
    min: 0,
    max: 5,
    highHeatThreshold: 8,
    consecutiveHighHeatTurnsForNotoriety: 2,
    unregisteredWorkerThreshold: 4,
    consecutiveRoundsForNotoriety: 3,
    aggressiveCardsPerRoundForNotoriety: 3,
    undergroundStarProducingNights: 3,
  },

  police: {
    pressureSameHex: 3,
    pressureAdjacent: 2,
    /** Only the Financial Crimes Unit projects pressure at two hexes. */
    pressureTwoHexFcu: 1,
  },

  laundering: {
    /** Dirty spent -> Clean received, per tier. $300k = 12 units. */
    tiers: [
      { tier: 1, dirty: 12, clean: 8 },
      { tier: 2, dirty: 12, clean: 6 },
      { tier: 3, dirty: 12, clean: 4 },
      { tier: 4, dirty: 12, clean: 2 },
    ],
    /** Without infrastructure, only tier 1 is available and only once per turn. */
    baseTiersAvailable: 1,
    launderActionsPerTurn: 1,
  },

  upkeep: {
    /** Empire Overhead by Property count (index = count). */
    overheadByPropertyCount: [0, 0, 0, 0, 0, 2, 4, 8, 12, 18, 26, 34, 42],
    /** Beyond the table, add this per extra Property. */
    overheadPerExtraProperty: 8, // $200k
    /** Each unpaid chunk of this size forces one consequence. */
    unpaidChunk: 2, // $50k
    emergencyFinanceDirty: 4, // $100k
    closedPropertyUpkeepDivisor: 2,
  },

  licensing: {
    /** Cost to licence an Unlicensed Property. */
    cost: 12, // $300k
    heatRemovedOnLicence: 1,
  },

  vetting: {
    cost: 6, // $150k
    revenuePenalty: 1, // -$25k
    minimumRevenue: 4, // $100k
    stabilityGain: 1,
    stabilityMax: 5,
  },

  property: {
    /** Rounds a Property stays closed after a forced closure. */
    closureRounds: 1,
    reopenCost: 4, // $100k
    repairUpgradeCost: 4, // $100k
  },

  raid: {
    /** severity = exposure - protection, bucketed by these thresholds. */
    severityBuckets: [
      { minScore: -99, level: 0, label: 'Contained' },
      { minScore: 2, level: 1, label: 'Minor' },
      { minScore: 5, level: 2, label: 'Serious' },
      { minScore: 8, level: 3, label: 'Major' },
      { minScore: 12, level: 4, label: 'Catastrophic' },
    ],
    /** Fraction of Dirty Cash seized per severity level, as a percentage. */
    dirtySeizedPct: [0, 15, 30, 50, 70],
    workersRemoved: [0, 0, 1, 1, 2],
    propertiesClosed: [0, 0, 0, 1, 1],
    upgradesDisabled: [0, 0, 1, 1, 2],
    heatAdded: [0, 1, 1, 2, 2],
    /** Severity at which a Raid counts as "Major" for the Notoriety trigger. */
    majorRaidLevel: 3,
    notorietyAdded: [0, 0, 0, 1, 1],
    safeRoomProtection: 12, // $300k
  },

  victory: {
    cleanWealth: {
      4: { netWorth: 220, cleanCash: 60, lead: 20 }, // $5.5m / $1.5m / $500k
      3: { netWorth: 260, cleanCash: 60, lead: 20 }, // $6.5m / $1.5m / $500k
    } as Record<number, { netWorth: number; cleanCash: number; lead: number }>,
    empire: {
      minProperties: 10,
      minDistricts: 2,
      minCapacityUtilisationPct: 50,
      maxClosedProperties: 2,
    },
  },

  scoring: {
    /** Percentages applied at final scoring. */
    cleanCashPct: 100,
    licensedPropertyPct: 75,
    unlicensedPropertyPct: 25,
    legalUpgradePct: 50,
    underworldUpgradePct: 0,
    dirtyCashPct: 0,
    closedPropertyPct: 0,
  },

  district: {
    /** Owning this many of a District's four Properties grants control. */
    controlThreshold: 3,
    sweepBonusCardDraw: 1,
  },

  cards: {
    handLimit: 7,
    /** Cost a rival pays to satisfy Protection Demand. */
    protectionDemandCost: 6, // $150k
    protectionDemandHeat: 2,
    poachBaseCost: 8, // $200k
    territorialPressurePerProperty: 2, // $50k
  },

  simulation: {
    /** Games are abandoned as a draw past this many rounds. */
    maxRounds: 40,
  },
} as const;

export type Balance = typeof BALANCE;
