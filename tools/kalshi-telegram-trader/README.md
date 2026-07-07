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

```bash
python bot.py
```

## Commands

- `/status` — trading on/off, spent today vs daily cap, current caps
- `/stats` — track record: hit rate, ROI, and the calibration table
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
