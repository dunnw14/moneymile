import { createGame } from '@/engine/setup';
import { dispatch } from '@/engine';
import { createRng } from '@/engine/rng';
import { cleanWealthProgress, empireProgress } from '@/engine/calculations/victory';
import { cleanNetWorth, ownedProperties } from '@/engine/selectors';
import { PROPERTY_BY_ID } from '@/content/properties';
import { chooseAction, createAgent, type AgentId } from '@/simulation/agents';
import { BALANCE } from '@/content/balance';
import type { GameState, VictoryType } from '@/types';

export interface GameResult {
  seed: string;
  rounds: number;
  winnerAgent: AgentId | null;
  winnerSeat: number | null;
  victoryType: VictoryType | null;
  finalScores: Record<string, number>;
  agentsBySeat: AgentId[];
  /** Property ids owned by the winner at the end. */
  winnerProperties: number[];
  winnerMamasans: string[];
  winnerUpgrades: string[];
  aborted: boolean;
}

export interface SimulationOptions {
  games: number;
  players: number;
  agents?: AgentId[];
  seedPrefix?: string;
  verbose?: boolean;
}

/** Plays one complete game headlessly and returns the outcome. */
export function playGame(seed: string, agentIds: AgentId[]): GameResult {
  const playerNames = agentIds.map((id, i) => `${id}-${i + 1}`);
  let state: GameState = createGame({ playerNames, seed });

  const agents = agentIds.map((id) => createAgent(id));
  // A separate stream from the game's own, so agent noise never perturbs the
  // game's deterministic sequence.
  const rng = createRng(`${seed}:agents`, 0);

  let guard = 0;
  const maxSteps = 40_000;

  while (!state.gameOver && guard++ < maxSteps) {
    const playerId = state.playerOrder[state.activePlayerIndex];
    const seat = state.playerOrder.indexOf(playerId);
    const agent = agents[seat];

    // Interrupts first.
    if (state.pendingReaction) {
      const responderId = state.pendingReaction.responderId;
      const eligible = state.pendingReaction.eligibleCardIds;
      // Always react when able — a cancelled attack is nearly always worth a card.
      const cardId = eligible.length > 0 ? eligible[0] : null;
      state = dispatch(state, responderId, { type: 'RESOLVE_REACTION', cardId }).state;
      continue;
    }

    if (state.pendingUpkeep) {
      const upkeepPlayer = state.pendingUpkeep.playerId;
      const upkeepAgent = agents[state.playerOrder.indexOf(upkeepPlayer)];
      state = dispatch(state, upkeepPlayer, {
        type: 'UPKEEP_CHOICE',
        choice: upkeepAgent.chooseUpkeep(state, upkeepPlayer),
      }).state;
      continue;
    }

    switch (state.phase) {
      case 'draw':
        state = dispatch(state, playerId, { type: 'ADVANCE_PHASE' }).state;
        break;

      case 'scheme': {
        const choice = agent.chooseCard(state, playerId, rng);
        if (choice) {
          const result = dispatch(state, playerId, {
            type: 'PLAY_CARD',
            cardId: choice.cardId,
            target: choice.target,
          });
          state = result.ok ? result.state : dispatch(state, playerId, { type: 'SKIP_CARD' }).state;
        } else {
          state = dispatch(state, playerId, { type: 'SKIP_CARD' }).state;
        }
        break;
      }

      case 'operate': {
        const player = state.players[playerId];
        if (player.actionsRemaining <= 0) {
          state = dispatch(state, playerId, { type: 'END_OPERATE' }).state;
          break;
        }
        const action = chooseAction(agent, state, playerId, rng);
        if (!action) {
          state = dispatch(state, playerId, { type: 'END_OPERATE' }).state;
          break;
        }
        const result = dispatch(state, playerId, { type: 'ACTION', action });
        // A rejected action would loop forever, so bail out of Operate instead.
        state = result.ok ? result.state : dispatch(state, playerId, { type: 'END_OPERATE' }).state;
        break;
      }

      case 'resolve': {
        if (!state.pendingNight?.spun) {
          state = dispatch(state, playerId, { type: 'SPIN' }).state;
        } else {
          // Declare a victory the moment it is available.
          state = dispatch(state, playerId, { type: 'ADVANCE_PHASE' }).state;
        }
        break;
      }

      case 'police':
        state = dispatch(state, playerId, { type: 'ADVANCE_PHASE' }).state;
        break;

      case 'close': {
        if (!state.declaration) {
          if (cleanWealthProgress(state, playerId).eligible) {
            state = dispatch(state, playerId, { type: 'DECLARE', victoryType: 'clean_wealth' }).state;
          } else if (empireProgress(state, playerId).eligible) {
            state = dispatch(state, playerId, { type: 'DECLARE', victoryType: 'empire' }).state;
          }
        }
        state = dispatch(state, playerId, { type: 'ADVANCE_PHASE' }).state;
        break;
      }

      default:
        state = dispatch(state, playerId, { type: 'ADVANCE_PHASE' }).state;
        break;
    }
  }

  const aborted = !state.gameOver;
  const winnerId = state.winnerId;
  const winnerSeat = winnerId ? state.playerOrder.indexOf(winnerId) : null;

  const scores: Record<string, number> = {};
  for (const id of state.playerOrder) scores[id] = cleanNetWorth(state, id);

  const winnerProperties = winnerId ? ownedProperties(state, winnerId).map((p) => p.id) : [];
  const winnerMamasans = winnerId
    ? state.players[winnerId].mamasans.map((m) => m.defId)
    : [];
  const winnerUpgrades = winnerId
    ? Object.values(state.upgrades)
        .filter((u) => state.properties[u.propertyId].ownerId === winnerId)
        .map((u) => u.defId)
    : [];

  return {
    seed,
    rounds: state.round,
    winnerAgent: winnerSeat !== null ? agentIds[winnerSeat] : null,
    winnerSeat,
    victoryType: state.victoryType,
    finalScores: scores,
    agentsBySeat: agentIds,
    winnerProperties,
    winnerMamasans,
    winnerUpgrades,
    aborted,
  };
}

export interface BalanceReport {
  games: number;
  players: number;
  aborted: number;
  medianRounds: number;
  meanRounds: number;
  winRateByAgent: Record<string, { games: number; wins: number; rate: number; flagged: boolean }>;
  winRateBySeat: Record<string, { games: number; wins: number; rate: number; flagged: boolean }>;
  victoryTypeShare: Record<string, { count: number; share: number; flagged: boolean }>;
  propertyPresence: { id: number; name: string; share: number; flagged: boolean }[];
  mamasanPresence: { id: string; share: number; flagged: boolean }[];
  upgradePresence: { id: string; share: number; flagged: boolean }[];
  flags: string[];
}

/** Runs a batch and produces the balance report the spec asks for. */
export function runSimulation(options: SimulationOptions): {
  results: GameResult[];
  report: BalanceReport;
} {
  const { games, players } = options;
  const pool: AgentId[] = options.agents?.length
    ? options.agents
    : ['operator', 'hustler', 'shark', 'baron', 'fortress', 'hybrid'];

  const results: GameResult[] = [];
  const prefix = options.seedPrefix ?? 'sim';

  for (let i = 0; i < games; i++) {
    const seed = `${prefix}-${i}`;
    // Rotate the agent line-up so seat advantage is measured, not baked in.
    const lineup: AgentId[] = [];
    for (let seat = 0; seat < players; seat++) {
      lineup.push(pool[(i + seat) % pool.length]);
    }
    results.push(playGame(seed, lineup));
    if (options.verbose && (i + 1) % 100 === 0) {
      process.stderr.write(`  ${i + 1}/${games} games\n`);
    }
  }

  return { results, report: buildReport(results, players) };
}

export function buildReport(results: GameResult[], players: number): BalanceReport {
  const flags: string[] = [];
  const completed = results.filter((r) => !r.aborted);

  const rounds = completed.map((r) => r.rounds).sort((a, b) => a - b);
  const medianRounds = rounds.length ? rounds[Math.floor(rounds.length / 2)] : 0;
  const meanRounds = rounds.length ? rounds.reduce((a, b) => a + b, 0) / rounds.length : 0;

  // --- Win rate by agent ---------------------------------------------------
  const agentGames: Record<string, number> = {};
  const agentWins: Record<string, number> = {};
  for (const result of results) {
    for (const agent of result.agentsBySeat) {
      agentGames[agent] = (agentGames[agent] ?? 0) + 1;
    }
    if (result.winnerAgent) {
      agentWins[result.winnerAgent] = (agentWins[result.winnerAgent] ?? 0) + 1;
    }
  }

  const winRateByAgent: BalanceReport['winRateByAgent'] = {};
  for (const agent of Object.keys(agentGames)) {
    const games = agentGames[agent];
    const wins = agentWins[agent] ?? 0;
    const rate = games ? wins / games : 0;
    const flagged = players === 4 && (rate > 0.32 || rate < 0.18);
    winRateByAgent[agent] = { games, wins, rate, flagged };
    if (flagged) {
      flags.push(
        `${agent} win rate ${(rate * 100).toFixed(1)}% is outside the 18-32% target band.`,
      );
    }
  }

  // --- Win rate by seat ----------------------------------------------------
  const seatWins: Record<number, number> = {};
  for (const result of results) {
    if (result.winnerSeat !== null) {
      seatWins[result.winnerSeat] = (seatWins[result.winnerSeat] ?? 0) + 1;
    }
  }

  const winRateBySeat: BalanceReport['winRateBySeat'] = {};
  for (let seat = 0; seat < players; seat++) {
    const wins = seatWins[seat] ?? 0;
    const rate = results.length ? wins / results.length : 0;
    const flagged = seat === 0 && rate > 0.29;
    winRateBySeat[String(seat)] = { games: results.length, wins, rate, flagged };
    if (flagged) {
      flags.push(`First-player win rate ${(rate * 100).toFixed(1)}% exceeds the 29% target.`);
    }
  }

  // --- Victory type share --------------------------------------------------
  const typeCounts: Record<string, number> = {};
  for (const result of completed) {
    if (result.victoryType) {
      typeCounts[result.victoryType] = (typeCounts[result.victoryType] ?? 0) + 1;
    }
  }

  const bands: Record<string, [number, number]> = {
    clean_wealth: [0.25, 0.6],
    empire: [0.15, 0.4],
    final_raid: [0.2, 0.5],
  };

  const victoryTypeShare: BalanceReport['victoryTypeShare'] = {};
  for (const type of ['clean_wealth', 'empire', 'final_raid']) {
    const count = typeCounts[type] ?? 0;
    const share = completed.length ? count / completed.length : 0;
    const [min, max] = bands[type];
    const flagged = share < min || share > max;
    victoryTypeShare[type] = { count, share, flagged };
    if (flagged) {
      flags.push(
        `${type} victories at ${(share * 100).toFixed(1)}% are outside the ${min * 100}-${max * 100}% band.`,
      );
    }
  }

  // --- Presence in winning portfolios --------------------------------------
  const winners = completed.filter((r) => r.winnerAgent !== null);

  const propertyCounts: Record<number, number> = {};
  const mamasanCounts: Record<string, number> = {};
  const upgradeCounts: Record<string, number> = {};

  for (const result of winners) {
    for (const id of new Set(result.winnerProperties)) {
      propertyCounts[id] = (propertyCounts[id] ?? 0) + 1;
    }
    for (const id of new Set(result.winnerMamasans)) {
      mamasanCounts[id] = (mamasanCounts[id] ?? 0) + 1;
    }
    for (const id of new Set(result.winnerUpgrades)) {
      upgradeCounts[id] = (upgradeCounts[id] ?? 0) + 1;
    }
  }

  const total = Math.max(1, winners.length);

  const propertyPresence = Object.entries(propertyCounts)
    .map(([id, count]) => {
      const share = count / total;
      const flagged = share > 0.75;
      if (flagged) {
        flags.push(
          `${PROPERTY_BY_ID[Number(id)].name} appears in ${(share * 100).toFixed(1)}% of winning portfolios.`,
        );
      }
      return { id: Number(id), name: PROPERTY_BY_ID[Number(id)].name, share, flagged };
    })
    .sort((a, b) => b.share - a.share);

  const mamasanPresence = Object.entries(mamasanCounts)
    .map(([id, count]) => {
      const share = count / total;
      const flagged = share > 0.7;
      if (flagged) flags.push(`Mamasan ${id} appears in ${(share * 100).toFixed(1)}% of wins.`);
      return { id, share, flagged };
    })
    .sort((a, b) => b.share - a.share);

  const upgradePresence = Object.entries(upgradeCounts)
    .map(([id, count]) => {
      const share = count / total;
      const flagged = share > 0.7;
      if (flagged) flags.push(`Upgrade ${id} appears in ${(share * 100).toFixed(1)}% of wins.`);
      return { id, share, flagged };
    })
    .sort((a, b) => b.share - a.share);

  if (medianRounds < 8 || medianRounds > 16) {
    flags.push(`Median game length ${medianRounds} rounds is outside the 8-16 target.`);
  }

  const aborted = results.filter((r) => r.aborted).length;
  if (aborted > 0) {
    flags.push(`${aborted} game(s) hit the ${BALANCE.simulation.maxRounds}-round safety limit.`);
  }

  return {
    games: results.length,
    players,
    aborted,
    medianRounds,
    meanRounds,
    winRateByAgent,
    winRateBySeat,
    victoryTypeShare,
    propertyPresence,
    mamasanPresence,
    upgradePresence,
    flags,
  };
}

export function reportToCsv(report: BalanceReport): string {
  const rows: string[] = ['section,key,games,wins,rate,flagged'];

  for (const [agent, data] of Object.entries(report.winRateByAgent)) {
    rows.push(`agent,${agent},${data.games},${data.wins},${data.rate.toFixed(4)},${data.flagged}`);
  }
  for (const [seat, data] of Object.entries(report.winRateBySeat)) {
    rows.push(`seat,${seat},${data.games},${data.wins},${data.rate.toFixed(4)},${data.flagged}`);
  }
  for (const [type, data] of Object.entries(report.victoryTypeShare)) {
    rows.push(`victory,${type},${report.games},${data.count},${data.share.toFixed(4)},${data.flagged}`);
  }
  for (const entry of report.propertyPresence) {
    rows.push(`property,"${entry.name}",,,${entry.share.toFixed(4)},${entry.flagged}`);
  }
  for (const entry of report.mamasanPresence) {
    rows.push(`mamasan,${entry.id},,,${entry.share.toFixed(4)},${entry.flagged}`);
  }
  for (const entry of report.upgradePresence) {
    rows.push(`upgrade,${entry.id},,,${entry.share.toFixed(4)},${entry.flagged}`);
  }

  return rows.join('\n');
}
