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

## Gets smarter the more it scans

The bot can't retrain your scanner's model (that lives outside it), but it keeps
a track record and corrects itself from it — see `learning.py`:

1. **Every surfaced pick is logged** to SQLite (`KALSHI_LEARNING_DB`).
2. A **settlement poller** (every 15 min) looks up each pick's Kalshi market and
   records whether the NO side won.
3. **Calibration** buckets predictions and compares "model said 85%" against the
   real hit rate, then corrects future probabilities with shrinkage:
   `calibrated = (wins + K·p_raw) / (n + K)` (K = `PRIOR_STRENGTH`, default 20).
   With no history it returns the raw number; the more resolved picks in a
   bucket, the more it trusts what actually happened.
4. The **edge gate runs on the calibrated probability**, so as data accumulates
   the bot pings less on edges that never pay off.

Example: if the 80–90% bucket keeps settling at ~50%, `calibrate(85)` drops from
85 toward 50 as picks resolve — so those stop clearing the edge gate. Watch it
happen with `/stats`.

Calibration is per-market-type, so keep the bot pointed at one kind of contract
(e.g. "1+ HR") for the buckets to mean something; mixing wildly different markets
muddies the correction.

## ⚠️ Edge convention — read before wiring your scanner

The bot buys the **NO** side. `model_pct` must be your model's fair probability
for the side you are betting — i.e. `P(event does NOT happen)`, 0–100 to match
the cents scale. Edge is `model_pct - no_price`. If your scanner emits
`P(event happens)`, convert first: `model_pct = 100 - P(event happens)`.
Getting this backwards silently bets the wrong direction.

## Note

Live-money betting automation. Test with tiny caps first, and know your local
rules on prediction-market / sports-contract trading before running it.
