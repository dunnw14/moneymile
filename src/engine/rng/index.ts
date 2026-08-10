/**
 * Seeded RNG.
 *
 * The engine never calls Math.random. Every random draw takes the game's seed
 * plus a monotonic cursor, so a game replayed from the same seed and the same
 * action sequence produces byte-identical state. The cursor lives in GameState,
 * which means a serialised save resumes the exact same random stream.
 */

/** xmur3 string hash — turns a seed string into a 32-bit integer. */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for a board game. */
function mulberry32(a: number): number {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export interface RngHandle {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Uniform pick; throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** Fisher-Yates shuffle returning a new array. */
  shuffle<T>(items: readonly T[]): T[];
  /** How many draws have been consumed — write this back into GameState. */
  cursor(): number;
}

export function createRng(seed: string, startCursor: number): RngHandle {
  const base = hashSeed(seed);
  let cursor = startCursor;

  const next = (): number => {
    const value = mulberry32(base + cursor * 0x9e3779b9);
    cursor += 1;
    return value;
  };

  const int = (maxExclusive: number): number => {
    if (maxExclusive <= 0) return 0;
    return Math.floor(next() * maxExclusive);
  };

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick called with an empty list');
      return items[int(items.length)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    cursor: () => cursor,
  };
}

/** Generates a human-friendly seed for a new game. */
export function randomSeed(): string {
  const words = [
    'neon', 'harbour', 'lantern', 'monsoon', 'velvet', 'orchid', 'amber',
    'transit', 'quarter', 'bazaar', 'midnight', 'skyline', 'temple', 'station',
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  return `${pick()}-${pick()}-${Math.floor(Math.random() * 9000) + 1000}`;
}
