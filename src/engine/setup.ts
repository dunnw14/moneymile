import { BALANCE } from '@/content/balance';
import { CARDS, FINAL_RAID_CARD, FINAL_RAID_WINDOW } from '@/content/cards';
import { MAMASANS, STARTER_MAMASAN_IDS } from '@/content/mamasans';
import { POLICE } from '@/content/police';
import { PROPERTIES, STARTER_PROPERTY_IDS } from '@/content/properties';
import { UPGRADES, COPIES_PER_UPGRADE } from '@/content/upgrades';
import { WORKER_PROFILES, WORKER_BY_ID, COPIES_PER_WORKER_PROFILE } from '@/content/workers';
import { createRng, randomSeed } from '@/engine/rng';
import type {
  CardInstance,
  CardInstanceId,
  GameState,
  PlayerState,
  PropertyState,
  TurnEffects,
} from '@/types';

export const PLAYER_COLOURS = ['#f0a35e', '#5ec8f0', '#c98af0', '#6ee0a8'];

export interface NewGameOptions {
  playerNames: string[];
  seed?: string;
  reducedMotion?: boolean;
}

export function createGame(options: NewGameOptions): GameState {
  const { playerNames } = options;
  if (playerNames.length < 3 || playerNames.length > 4) {
    throw new Error('Money Mile supports 3 or 4 players.');
  }

  const seed = options.seed?.trim() || randomSeed();
  const rng = createRng(seed, 0);

  // --- Card supply --------------------------------------------------------
  const cards: Record<CardInstanceId, CardInstance> = {};
  const nightCardIds: CardInstanceId[] = [];
  let entityCounter = 1;

  for (const def of CARDS) {
    for (let copy = 0; copy < def.copies; copy++) {
      const instanceId = `c${entityCounter++}`;
      cards[instanceId] = { instanceId, defId: def.id };
      nightCardIds.push(instanceId);
    }
  }

  const deck = rng.shuffle(nightCardIds);

  // The Final Raid card is seeded into the final window of the deck, so nobody
  // knows exactly when the game ends — only roughly.
  const finalRaidInstanceId = `c${entityCounter++}`;
  cards[finalRaidInstanceId] = { instanceId: finalRaidInstanceId, defId: FINAL_RAID_CARD.id };
  const windowStart = Math.max(0, deck.length - FINAL_RAID_WINDOW);
  const insertAt = windowStart + rng.int(deck.length - windowStart + 1);
  deck.splice(insertAt, 0, finalRaidInstanceId);

  // --- Properties ---------------------------------------------------------
  const properties: Record<number, PropertyState> = {};
  for (const def of PROPERTIES) {
    properties[def.id] = {
      id: def.id,
      ownerId: null,
      licensed: def.licence === 'licensed',
      heat: 0,
      closedUntilRound: null,
      mamasanId: null,
      workerIds: [],
      upgradeIds: [],
      modifiers: [],
    };
  }

  // --- Supplies -----------------------------------------------------------
  const workerSupply: Record<string, number> = {};
  for (const profile of WORKER_PROFILES) {
    workerSupply[profile.id] = COPIES_PER_WORKER_PROFILE;
  }

  const upgradeSupply: Record<string, number> = {};
  for (const upgrade of UPGRADES) {
    upgradeSupply[upgrade.id] = COPIES_PER_UPGRADE;
  }

  const mamasanSupply = MAMASANS.map((m) => m.id);

  // --- Players ------------------------------------------------------------
  const starterProperties = rng.shuffle(STARTER_PROPERTY_IDS).slice(0, playerNames.length);
  const starterMamasans = rng.shuffle(STARTER_MAMASAN_IDS).slice(0, playerNames.length);

  const players: Record<string, PlayerState> = {};
  const playerOrder: string[] = [];

  playerNames.forEach((name, index) => {
    const id = `p${index + 1}`;
    playerOrder.push(id);

    const vettedId = `w${entityCounter++}`;
    const unregisteredId = `w${entityCounter++}`;
    const vettedProfile = WORKER_BY_ID[BALANCE.setup.startingVettedWorkerProfile];
    const unregisteredProfile = WORKER_BY_ID[BALANCE.setup.startingUnregisteredWorkerProfile];
    workerSupply[vettedProfile.id] -= 1;
    workerSupply[unregisteredProfile.id] -= 1;

    const propertyId = starterProperties[index];
    const mamasanDefId = starterMamasans[index];
    const mamasanId = `m${entityCounter++}`;

    mamasanSupply.splice(mamasanSupply.indexOf(mamasanDefId), 1);

    properties[propertyId].ownerId = id;
    properties[propertyId].mamasanId = mamasanId;
    properties[propertyId].workerIds = [vettedId, unregisteredId];

    players[id] = {
      id,
      name: name.trim() || `Player ${index + 1}`,
      colour: PLAYER_COLOURS[index],
      cleanCash: BALANCE.setup.startingCleanCash,
      dirtyCash: BALANCE.setup.startingDirtyCash,
      heat: BALANCE.setup.startingHeat,
      notoriety: BALANCE.setup.startingNotoriety,
      actionsRemaining: 0,
      cardPlayedThisTurn: false,
      hand: [],
      workers: [
        {
          id: vettedId,
          profileId: vettedProfile.id,
          status: 'vetted',
          ownerId: id,
          propertyId,
          stability: vettedProfile.stability,
          conditions: {},
          producingNights: 0,
        },
        {
          id: unregisteredId,
          profileId: unregisteredProfile.id,
          status: 'unregistered',
          ownerId: id,
          propertyId,
          stability: unregisteredProfile.stability,
          conditions: {},
          producingNights: 0,
        },
      ],
      mamasans: [{ id: mamasanId, defId: mamasanDefId, ownerId: id, propertyId }],
      stats: emptyStats(),
      turnEffects: emptyTurnEffects(),
    };
  });

  // Opening hands.
  for (const id of playerOrder) {
    for (let i = 0; i < BALANCE.setup.startingHandSize; i++) {
      const cardId = deck.shift();
      if (cardId) players[id].hand.push(cardId);
    }
  }

  const firstPlayerIndex = rng.int(playerOrder.length);

  const state: GameState = {
    version: 1,
    seed,
    rngCursor: rng.cursor(),
    round: 1,
    phase: 'draw',
    turnCounter: 0,
    activePlayerIndex: firstPlayerIndex,
    playerOrder,
    players,
    properties,
    upgrades: {},
    upgradeSupply,
    workerSupply,
    mamasanSupply,
    police: POLICE.map((p) => ({ id: p.id, hex: { ...p.start }, bonusMovement: 0 })),
    deck,
    discard: [],
    cards,
    environment: [],
    pendingNight: null,
    pendingUpkeep: null,
    pendingReaction: null,
    declaration: null,
    finalRaidTriggered: false,
    finalRaidTurnsRemaining: 0,
    finalRaidResolved: false,
    gameOver: false,
    winnerId: null,
    victoryType: null,
    finalScores: null,
    log: [],
    nextEventId: 1,
    nextEntityId: entityCounter,
    settings: {
      reducedMotion: options.reducedMotion ?? false,
      showCalculations: true,
    },
  };

  state.players[playerOrder[firstPlayerIndex]].actionsRemaining = BALANCE.turn.actionsPerTurn;

  return state;
}

export function emptyStats() {
  return {
    consecutiveHighHeatTurns: 0,
    consecutiveHighUnregisteredRounds: 0,
    aggressiveCardsThisRound: 0,
    launderTiersUsedThisTurn: [] as number[],
    freeWorkerMovesUsed: 0,
    bigNightsThisRound: 0,
    heatReductionActionsThisTurn: 0,
    recruitsThisRound: 0,
  };
}

export function emptyTurnEffects(): TurnEffects {
  return {
    propertyDiscount: 0,
    upgradeDiscount: 0,
    licenceDiscount: 0,
    freeMamasanAction: false,
    recruitTwoWithOneAction: false,
    raidSeverityModifier: 0,
    cancelNextRaid: false,
    protectedDirty: 0,
    protectedCash: 0,
    guaranteedBigProperty: null,
    immuneToFinancialCrimes: false,
  };
}
