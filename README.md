# btc-cent-forecast-01 — Forecast Bitcoin's price 4 hours ahead

Entry for make.fun competition `btc-cent-forecast-01` ($250, program/v1).
`main.ts` (Node 22, standard library only) reads one case at a time from
`$MAKEFUN_INPUT_DIR` (default `/input`) and writes one guess per case to
`$MAKEFUN_OUTPUT_DIR` (default `/output`).

## Method

Damped log-linear trend extrapolation:

1. Fit a least-squares line to `log(price)` over the whole 72-hour window
   (4,320 one-minute closes).
2. Extrapolate that slope 240 minutes ahead from the last close (the
   checkpoint price).
3. Cap the extrapolated log-move at ±log(1.01) before `exp()`, so the guess can
   never move more than 1% away from the checkpoint price, however steep the
   fitted slope is.
4. Round to the price grid's 5 decimals, clamped inside (0, 10,000,000).

Rationale: the 4-hour move keeps some of the 72-hour drift — on the practice
cases the full-window trend points the same way as the realised 4-hour move in
4 of 5 cases — while the move it adds is small next to the usual 4-hour noise,
so the downside when the drift reverses is bounded. Alternatives tested and
rejected on the same 5 evaluable practice cases: short-window trends,
EWMA-of-returns (best mean, but worst case $963 vs persistence $767 — too
fragile), mean reversion, recency-weighted fits, R² shrinkage, and trend
ensembles. None beat the plain full-window trend consistently.

The program is deterministic (no clock, no randomness) and never crashes on a
bad case: a case it cannot parse, or with no usable prices, still gets a
well-formed output (price 1.0).

## Run locally

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Practice results (p00–p04)

Actuals are the next case's last price (cases are 4 hours apart, so p_{k+1}
ends exactly at p_k's target). p05 has no successor, so it cannot be scored
— its guess is listed for reference only.

| case | guess (USD) | checkpoint (USD) | actual (USD) | error (cents) | persistence error (cents) |
|------|------------:|-----------------:|-------------:|--------------:|--------------------------:|
| p00 | 74,676.15 | 74,764.92 | 74,447.80 | 22,834.12 | 31,711.14 |
| p01 | 74,359.54 | 74,447.80 | 73,680.84 | 67,870.79 | 76,696.79 |
| p02 | 73,587.85 | 73,680.84 | 73,210.50 | 37,734.41 | 47,033.39 |
| p03 | 73,100.78 | 73,210.50 | 73,777.35 | 67,656.85 | 56,684.98 |
| p04 | 73,653.66 | 73,777.35 | 73,545.88 | 10,777.99 | 23,147.01 |
| p05 | 73,416.14 | 73,545.88 | n/a | n/a | n/a |

- **Entry mean loss (p00–p04): 41,374.83 cents** (worst case 67,870.79 cents)
- **Persistence baseline, same cases: 47,054.66 cents** (worst 76,696.79 cents)
- **Improvement: 12.1%**; beats persistence on 4 of 5 cases (loses only p03).
- House baseline over all 6 practice cases (incl. p05): 44,521.58 cents.
- Determinism: two runs per case produce byte-identical outputs (sha256 checked).
- Runtime: ~141 ms per case on this machine (limit 8,000 ms).
- All 6 outputs well-formed: exactly `{"forecasts":[{"case":"<id>","price":<number>}]}`.

## Files

- `main.ts` — the entrypoint (only file the grader runs)
- `LICENSE` — MIT
- `README.md` — this file
- `.makefun/owner.json` — payout wallet
