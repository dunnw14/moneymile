import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AGENT_IDS, type AgentId } from '@/simulation/agents';
import { reportToCsv, runSimulation } from '@/simulation/runner';

/**
 * Headless balance runner.
 *
 *   npm run simulate -- --games 10000 --players 4
 *   npm run simulate -- --games 500 --players 3 --agents operator,hustler,shark --out reports/run
 */
interface Args {
  games: number;
  players: number;
  agents?: AgentId[];
  out: string;
  seed: string;
  verbose: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    games: 500,
    players: 4,
    out: 'simulation-output/report',
    seed: 'sim',
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];

    switch (flag) {
      case '--games':
        args.games = Number(value);
        i++;
        break;
      case '--players':
        args.players = Number(value);
        i++;
        break;
      case '--agents': {
        const ids = value.split(',').map((s) => s.trim()) as AgentId[];
        const invalid = ids.filter((id) => !AGENT_IDS.includes(id));
        if (invalid.length) {
          throw new Error(
            `Unknown agent(s): ${invalid.join(', ')}. Available: ${AGENT_IDS.join(', ')}`,
          );
        }
        args.agents = ids;
        i++;
        break;
      }
      case '--out':
        args.out = value;
        i++;
        break;
      case '--seed':
        args.seed = value;
        i++;
        break;
      case '--verbose':
        args.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  if (!Number.isFinite(args.games) || args.games < 1) {
    throw new Error('--games must be a positive number.');
  }
  if (args.players !== 3 && args.players !== 4) {
    throw new Error('--players must be 3 or 4.');
  }

  return args;
}

function printHelp(): void {
  process.stdout.write(`
Money Mile simulation runner

  --games    <n>        Number of games to play (default 500)
  --players  <3|4>      Player count (default 4)
  --agents   <a,b,c>    Agent pool (default: all strategy agents)
                        Available: ${AGENT_IDS.join(', ')}
  --seed     <string>   Seed prefix (default "sim")
  --out      <path>     Output path without extension (default simulation-output/report)
  --verbose             Progress to stderr

`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  process.stderr.write(
    `Running ${args.games} games with ${args.players} players (seed prefix "${args.seed}")...\n`,
  );
  const started = Date.now();

  const { results, report } = runSimulation({
    games: args.games,
    players: args.players,
    agents: args.agents,
    seedPrefix: args.seed,
    verbose: args.verbose,
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const jsonPath = resolve(`${args.out}.json`);
  const csvPath = resolve(`${args.out}.csv`);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify({ report, results }, null, 2));
  writeFileSync(csvPath, reportToCsv(report));

  // --- Console summary -----------------------------------------------------
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  process.stdout.write(`\nMoney Mile — balance report\n`);
  process.stdout.write(`${'='.repeat(52)}\n`);
  process.stdout.write(`Games            ${report.games} (${args.players} players) in ${elapsed}s\n`);
  process.stdout.write(`Median rounds    ${report.medianRounds}\n`);
  process.stdout.write(`Mean rounds      ${report.meanRounds.toFixed(1)}\n`);
  process.stdout.write(`Unfinished       ${report.aborted}\n`);

  process.stdout.write(`\nWin rate by strategy\n`);
  for (const [agent, data] of Object.entries(report.winRateByAgent).sort(
    (a, b) => b[1].rate - a[1].rate,
  )) {
    process.stdout.write(
      `  ${agent.padEnd(10)} ${pct(data.rate).padStart(6)}  (${data.wins}/${data.games})${
        data.flagged ? '  <-- flagged' : ''
      }\n`,
    );
  }

  process.stdout.write(`\nWin rate by seat\n`);
  for (const [seat, data] of Object.entries(report.winRateBySeat)) {
    process.stdout.write(
      `  seat ${seat}     ${pct(data.rate).padStart(6)}${data.flagged ? '  <-- flagged' : ''}\n`,
    );
  }

  process.stdout.write(`\nVictory paths\n`);
  for (const [type, data] of Object.entries(report.victoryTypeShare)) {
    process.stdout.write(
      `  ${type.padEnd(13)} ${pct(data.share).padStart(6)}${data.flagged ? '  <-- flagged' : ''}\n`,
    );
  }

  process.stdout.write(`\nMost common Properties in winning portfolios\n`);
  for (const entry of report.propertyPresence.slice(0, 8)) {
    process.stdout.write(
      `  ${entry.name.padEnd(20)} ${pct(entry.share).padStart(6)}${entry.flagged ? '  <-- flagged' : ''}\n`,
    );
  }

  if (report.flags.length > 0) {
    process.stdout.write(`\nBalance flags (${report.flags.length})\n`);
    for (const flag of report.flags) process.stdout.write(`  - ${flag}\n`);
  } else {
    process.stdout.write(`\nNo balance targets breached.\n`);
  }

  process.stdout.write(`\nWritten: ${jsonPath}\n         ${csvPath}\n`);
}

main();
