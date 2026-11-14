// btc-cent-forecast-01 entry (Node 22, standard library only).
//
// Forecast: Bitcoin's US-dollar close 240 minutes after each checkpoint, from the
// 4,320 one-minute closes of the 72 hours up to it.
//
// Method: damped log-linear trend extrapolation.
//   - Fit a least-squares line to log(price) over the whole 72-hour window.
//   - Extrapolate that slope 240 minutes ahead from the last close.
//   - Cap the extrapolated move at 1% of the last close, so an extreme slope in
//     the window can never throw the guess far from the checkpoint price.
//   - Clamp the result onto the price grid's 5 decimals, inside (0, 10,000,000).
//
// Why: the 4-hour move keeps some of the 72-hour drift (on the practice cases the
// full-window trend points the same way as the realised 4-hour move in 4 of 5
// cases), while the move it adds is small next to the usual 4-hour noise, so the
// downside when the drift reverses is bounded. The 1% cap is inert on the
// practice data (moves there are 0.1-0.2%) and only guards the final window.
//
// Robustness: the program never crashes on a bad case. A case it cannot parse, or
// with no usable prices, still gets a well-formed output (price 1.0), so the case
// stays valid in format. Output is deterministic: no clock, no randomness.
//
// Run locally:  mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** Largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;
/** The forecast horizon in minutes, from the competition's case format. */
const HORIZON_MINUTES = 240;
/** The extrapolated move is capped at this fraction of the last close. */
const MAX_MOVE_FRACTION = 0.01;
/** The same cap in log space: log(1 + 0.01), applied before exp() so a steep
 *  fitted slope can never overflow the exponential or overshoot the cap. */
const MAX_LOG_MOVE = Math.log(1 + MAX_MOVE_FRACTION);
/** Fallback price when a case carries no usable price at all. */
const FALLBACK_PRICE = 1.0;

interface CaseMarket {
  id: string;
  prices: unknown;
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
function price5(x: number): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) return FALLBACK_PRICE;
  return Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;
}

/**
 * Least-squares slope of log(price) against minute index, per minute, over the
 * whole series. Returns 0 when the series is too short to fit a line.
 */
function logSlope(prices: number[]): number {
  const n = prices.length;
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const ly = Math.log(prices[i]);
    sx += i;
    sy += ly;
    sxx += i * i;
    sxy += i * ly;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

/**
 * Forecast one market: last close moved along the fitted 72-hour log trend for
 * the horizon. The trend's log-move is clamped to +/-log(1.01) before exp(), so
 * the move can never exceed 1% of the last close however steep the fitted slope.
 */
function forecast(market: CaseMarket): number {
  const raw = Array.isArray(market.prices) ? market.prices : [];
  const prices = raw.filter((p): p is number => typeof p === 'number' && Number.isFinite(p) && p > 0);
  if (prices.length === 0) return FALLBACK_PRICE;
  const last = prices[prices.length - 1] as number;
  const slope = logSlope(prices);
  const logMove = Math.max(-MAX_LOG_MOVE, Math.min(MAX_LOG_MOVE, slope * HORIZON_MINUTES));
  return price5(last * Math.exp(logMove));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  let price = FALLBACK_PRICE;
  try {
    const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
    if (Array.isArray(c.markets) && c.markets.length === 1) {
      price = forecast(c.markets[0] as CaseMarket);
    }
  } catch {
    // A case we cannot read still gets a well-formed output below.
  }
  writeFileSync(
    join(OUTPUT_DIR, `${id}.out`),
    `${JSON.stringify({ forecasts: [{ case: id, price }] })}\n`,
  );
}
