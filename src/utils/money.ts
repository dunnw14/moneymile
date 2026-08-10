import { BALANCE } from '@/content/balance';
import type { MoneyUnits } from '@/types';

/**
 * Formats money units as the game's display currency.
 *   4  -> "$100k"
 * 220  -> "$5.5m"
 */
export function formatMoney(units: MoneyUnits): string {
  const dollars = units * BALANCE.MONEY_UNIT;
  const negative = dollars < 0;
  const abs = Math.abs(dollars);
  let text: string;
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    text = `$${trimZeros(millions.toFixed(2))}m`;
  } else if (abs >= 1_000) {
    text = `$${Math.round(abs / 1_000)}k`;
  } else {
    text = `$${abs}`;
  }
  return negative ? `-${text}` : text;
}

function trimZeros(value: string): string {
  return value.replace(/\.?0+$/, '');
}

/** Applies an integer x100 multiplier, rounding to the nearest whole unit. */
export function applyMultiplier(units: MoneyUnits, multiplierX100: number): MoneyUnits {
  return Math.round((units * multiplierX100) / 100);
}

/** Composes several x100 multipliers into one, without leaving integer space. */
export function composeMultipliers(...multipliersX100: number[]): number {
  return multipliersX100.reduce((acc, m) => Math.round((acc * m) / 100), 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
