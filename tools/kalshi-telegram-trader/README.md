# Kalshi Telegram Trader

Tap-to-bet Telegram bot for a Kalshi scanner. The scanner finds edges, the bot
pings you on Telegram with `[Bet $5] [Bet $10] [Skip]` buttons, and a tap places
a **limit** order on Kalshi. Guardrails: per-bet cap, daily cap, `/stop` kill
switch.

## Setup

```bash
pip install -r requirements.txt
```

Set these env vars (never hardcode secrets — `.env` and `*.pem` are gitignored):

| Var | What |
| --- | --- |
| `KALSHI_API_KEY_ID` | kalshi.com → account → API keys |
| `KALSHI_PRIVATE_KEY` | path to your RSA private key `.pem` |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_CHAT_ID` | your chat id — only this user can trade |
| `KALSHI_STATE_FILE` | *(optional)* where daily-spend state is saved (default: `kalshi_state.json` beside `bot.py`) |
| `KALSHI_LEARNING_DB` | *(optional)* where the pick/outcome track record lives (default: `kalshi_learning.db` beside `bot.py`) |
| `KALSHI_PAPER_BANKROLL` | *(optional)* starting imaginary bankroll for the paper brain (default 1000) |
| `KALSHI_KELLY_FRACTION` | *(optional)* fraction of full Kelly the paper brain sizes with (default 0.5 = half-Kelly) |
| `KALSHI_PAPER_MIN_EDGE` | *(optional)* min calibrated edge (¢) the paper brain requires to bet (default 3) |
| `KALSHI_CONFIDENCE_Z` | *(optional)* std-errors of confidence a calibrated edge must clear before the paper brain bets (default 1.64 ≈ 95%) |
| `KALSHI_AUTOPICK` | *(optional)* set to `1` to turn on autonomous background self-picking |
| `KALSHI_AUTOPICK_INTERVAL` | *(optional)* seconds between autonomous market scans (default 600) |
| `KALSHI_AUTOPICK_SERIES` | *(optional)* restrict autonomous picks to one Kalshi series so calibration buckets stay coherent |
| `KALSHI_AUTOPICK_MAX` | *(optional)* max markets logged per scan cycle (default 50) |
| `KALSHI_ALERT_CHAT_ID` | *(optional)* where proactive alerts go (live confident picks + daily digest). Defaults to `TELEGRAM_CHAT_ID`; set to a **group chat id** if the bot can't DM you |
| `KALSHI_DIGEST_HOUR` | *(optional)* UTC hour for the daily "best picks of the day" digest (default 16) |

```bash
python bot.py
```

## Commands

- `/status` — trading on/off, spent today vs daily cap, current caps
- `/prediction` — the bot's live predictions on open markets right now (its calibrated call vs the market price, and whether it bet). `/picks` also works as an alias.
- `/stats` — all-time track record: hit rate, ROI, and the calibration table
- `/today` — today's scorecard: how many of today's graded picks it called right, plus the day's PnL (a pick is graded when its Kalshi market settles, which may be after the day it was placed; date is UTC)
- `/stop` — kill switch, disables trading
- `/start_trading` — re-enable

## Guardrails (edit the constants at the top of `bot.py`)

- `MAX_STAKE_PER_BET` — hard cap per single order (default $25)
- `MAX_DAILY_TOTAL` — hard cap per calendar day (default $100)
- `MIN_EDGE_CENTS` — minimum edge to ping (default 3¢)

The daily-spend counter and the on/off flag are **persisted to disk**
(`KALSHI_STATE_FILE`) and reloaded on startup, so a crash or restart does not
reset your daily cap or silently re-enable trading. The spend is reserved under
a lock *before* the order fires and rolled back if Kalshi rejects it, so rapid
double-taps can't blow past the cap.

## Gets smarter the more it scans — feed it your FULL scan

Call `ingest_scan(app, chat_id, raw_scanner_output)` with **everything** your
scanner produces, not a pre-filtered list. The bot logs and paper-trades every
pick — above *and* below the ping gate — and only pings you on the ones that
clear `MIN_EDGE_CENTS`. Learning from the whole population (including picks it
would never show you) is what lets it see the real game.

### 1. Track record + calibration

- **Every scanned pick is logged** to SQLite (`KALSHI_LEARNING_DB`).
- A **settlement poller** (every 15 min) looks up each pick's Kalshi market and
  records whether the NO side won.
- **Calibration** buckets predictions and compares "model said 85%" against the
  real hit rate, then corrects future probabilities with shrinkage:
  `calibrated = (wins + K·p_raw) / (n + K)` (K = `PRIOR_STRENGTH`, default 20).
  No history → returns the raw number; more resolved picks → trusts reality more.
- The **edge gate runs on the calibrated probability**, so pings dry up on edges
  that never pay off.

### 2. Paper brain — the bot bets its own imaginary money on everything

For **every** scanned pick the bot makes its own call, no tap required:

- Decides bet-or-skip on the *calibrated* edge (`KALSHI_PAPER_MIN_EDGE`).
- Sizes with **fractional Kelly** (`KALSHI_KELLY_FRACTION`) off a **compounding
  paper bankroll** (`KALSHI_PAPER_BANKROLL`), capped at 10% of bankroll per bet.
  Open positions reserve their cash, so it can never over-commit or go negative.
- When the market settles, it scores the imaginary bet and updates the bankroll.

This is the honest judge of your model: a good model compounds the paper
bankroll, a bad one bleeds it — regardless of whether you ever bet real money.
Each ping also shows what the brain did (`🧠 paper: bet 3x ($2.10)` / `skip`).

### Proactive alerts

When autopick makes a **confident** paper pick, the bot sends a live alert to
`KALSHI_ALERT_CHAT_ID` (🎯 New confident pick …), and once a day at
`KALSHI_DIGEST_HOUR` it sends a 🏆 "Best picks of the day" digest of its top
confident open picks. Both stay quiet until the bot has actually learned enough
to be confident — early on it just watches, so expect silence for a while. A bot
can't DM a user who hasn't started a private chat with it, so if you only use it
in a group, set `KALSHI_ALERT_CHAT_ID` to that group's chat id.

### Watch it with `/stats`

Shows the paper bankroll vs start, paper win rate and ROI, the model-vs-actual
calibration table, and a **Brier score for raw vs calibrated** predictions
(lower = better; 0.25 = coin flip) so you can literally watch accuracy improve.

In backtest: a model overconfident by 12 points gets `calibrate(85)` pulled to
~72 (true ≈ 73) and Brier drops 0.221 → 0.211; a well-calibrated model with real
edge grew the paper bankroll from $1,000 to ~$36k over 600 scans.

Calibration is per-model-bucket, not per-market, so keep the bot pointed at one
kind of contract (e.g. "1+ HR") for the buckets to mean something; mixing wildly
different markets muddies the correction.

## Autonomous mode — the bot makes its own picks in the background

Set `KALSHI_AUTOPICK=1` and the bot needs no scanner and no taps. On a timer it:

1. Pulls live open Kalshi markets (optionally one series via `KALSHI_AUTOPICK_SERIES`).
2. Takes **the market's own NO price as its starting opinion** (`model_pct = no_ask`).
3. Calibrates that against its accumulated track record and paper-trades it.
4. The settlement poller resolves it later and feeds the outcome back in.

**How growth turns into accuracy.** Because its opinion *is* the market price,
before it has data the calibrated edge is ~0 and it simply **watches** — logging
markets and outcomes without betting. As real results accumulate, its calibrated
prediction diverges from the raw price wherever the market is systematically off,
and *that divergence* is the only thing that makes it bet. It literally learns to
bet from its own growth.

**It won't fool itself.** A bet fires only when the calibrated edge clears
`KALSHI_CONFIDENCE_Z` standard errors (default ~95% confidence), so noise in a
thin bucket never triggers a trade. In backtests on a perfectly efficient market
it stays in watch mode (a handful of bets, bankroll at break-even); on a market
where NO is genuinely underpriced it finds the edge and compounds. Honest
caveat: a from-scratch bot betting the market against itself will mostly discover
the market is efficient — real edges are rare. This tells you the truth about
that, which is the point.

## See it work before you have a scanner (`demo.py`)

There is no scanner/model in this repo — `model_pct` (the edge) must come from
*your* model that predicts outcomes better than the market prices them. Until
that exists, **no real data can accumulate**, and the bot, if launched, just
sits idle waiting for picks that never arrive.

To watch the learning brain run end-to-end in the meantime:

```bash
python demo.py                       # 400 synthetic scans
python demo.py --bias 0 --scans 1000 # a well-calibrated model (bankroll grows)
python demo.py --bias 20             # a badly overconfident one (bankroll bleeds)
```

`demo.py` streams **synthetic** picks and outcomes through the real calibration
and paper-brain code, into a **separate** `kalshi_demo.db`. No Telegram, no
Kalshi, no secrets, no real money. It proves the plumbing and lets you feel how
`/stats` evolves — but the numbers say nothing about any real model. Real data
only comes from wiring a real scanner into `ingest_scan`.

## ⚠️ Edge convention — read before wiring your scanner

The bot buys the **NO** side. `model_pct` must be your model's fair probability
for the side you are betting — i.e. `P(event does NOT happen)`, 0–100 to match
the cents scale. Edge is `model_pct - no_price`. If your scanner emits
`P(event happens)`, convert first: `model_pct = 100 - P(event happens)`.
Getting this backwards silently bets the wrong direction.

## Note

Live-money betting automation. Test with tiny caps first, and know your local
rules on prediction-market / sports-contract trading before running it.
