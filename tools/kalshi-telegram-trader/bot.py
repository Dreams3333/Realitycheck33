"""
Kalshi Telegram Trader — tap-to-bet bot for Dylan's scanner
===========================================================
Flow:
  1. Scanner finds picks -> filters for real edge (see EDGE CONVENTION below)
  2. Bot sends Telegram message with inline buttons: [Bet $5] [Bet $10] [Skip]
  3. Tap a button -> bot places a LIMIT order via Kalshi's trade API
  4. Guardrails: per-bet cap, daily cap, /stop kill switch

Setup:
  pip install -r requirements.txt

  Env vars needed (never hardcode these):
    KALSHI_API_KEY_ID     -> from kalshi.com -> account -> API keys
    KALSHI_PRIVATE_KEY    -> path to your RSA private key .pem file
    TELEGRAM_BOT_TOKEN    -> from @BotFather
    TELEGRAM_CHAT_ID      -> your chat id (so only YOU can trade)
  Optional:
    KALSHI_STATE_FILE     -> where daily-spend state is persisted
                             (default: ./kalshi_state.json next to this file)

EDGE CONVENTION (read this before wiring your scanner):
  This bot buys the NO side. `model_pct` MUST be your model's fair probability
  for the side you are betting — i.e. the probability the event does NOT happen,
  expressed 0-100 to match the cents scale. Edge is then simply:
        edge = model_pct - no_price
  If your scanner emits P(event happens) instead, convert before passing it in:
        model_pct = 100 - P(event happens)
  Getting this backwards silently bets the wrong direction, so keep the two on
  the same side.
"""

import os
import time
import json
import base64
import asyncio
import datetime
import uuid
import threading
import urllib.parse
import requests

import learning

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, BotCommand
from telegram.ext import (
    Application, CallbackQueryHandler, CommandHandler, ContextTypes,
)

# ----------------------------------------------------------------------
# CONFIG / GUARDRAILS
# ----------------------------------------------------------------------
MIN_EDGE_CENTS = 3         # only ping when model_pct - no_price >= 3 cents
MAX_STAKE_PER_BET = 25.00  # dollars, hard cap per single order
MAX_DAILY_TOTAL = 100.00   # dollars, hard cap per calendar day
STAKE_OPTIONS = [5, 10]    # the button amounts
RESOLVE_INTERVAL_SECONDS = 900  # how often to poll Kalshi for settled markets

# --- Autonomous background self-picking ---
# When on, the bot scans live Kalshi markets on a timer and forms its OWN picks
# with no scanner and no human tap. Its opinion is the market price itself, so
# it starts in pure watch mode (edge ~0 -> no bets) and only begins paper-betting
# where its accumulated calibration shows the market is genuinely miscalibrated.
AUTOPICK_ENABLED = os.environ.get("KALSHI_AUTOPICK") == "1"
AUTOPICK_INTERVAL = int(os.environ.get("KALSHI_AUTOPICK_INTERVAL", "600"))
AUTOPICK_SERIES = os.environ.get("KALSHI_AUTOPICK_SERIES") or None  # keep buckets coherent
AUTOPICK_MAX = int(os.environ.get("KALSHI_AUTOPICK_MAX", "50"))     # markets per cycle

# Where proactive alerts (live confident picks + daily digest) are sent. Defaults
# to your user ID, but a bot can't DM you unless you've started a private chat
# with it — set KALSHI_ALERT_CHAT_ID to a group's chat id to get alerts there.
ALERT_CHAT_ID = os.environ.get("KALSHI_ALERT_CHAT_ID") or os.environ.get("TELEGRAM_CHAT_ID")
DIGEST_HOUR = int(os.environ.get("KALSHI_DIGEST_HOUR", "16"))       # UTC hour for daily digest
MAX_ALERTS_PER_CYCLE = 5   # don't burst-spam if many picks turn confident at once

KALSHI_BASE = "https://api.elections.kalshi.com"

# Where the daily-spend counter and kill-switch flag live so they survive a
# restart / crash. Without this, a restart would silently reset the daily cap
# and re-enable trading -- exactly what you do NOT want in money-moving code.
STATE_FILE = os.environ.get(
    "KALSHI_STATE_FILE",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "kalshi_state.json"),
)

# A lock so the button handler and the command handlers can't interleave a
# read-modify-write of the spend counter.
_STATE_LOCK = threading.Lock()


def _default_state() -> dict:
    return {
        "trading_enabled": True,
        "spent_today": 0.0,
        "spend_date": datetime.date.today().isoformat(),
    }


def _load_state() -> dict:
    try:
        with open(STATE_FILE, "r") as f:
            data = json.load(f)
        # Fill any missing keys from defaults so an old/partial file still works.
        merged = _default_state()
        merged.update({k: data[k] for k in merged if k in data})
        return merged
    except (FileNotFoundError, json.JSONDecodeError, ValueError):
        return _default_state()


def _save_state():
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(STATE, f)
    os.replace(tmp, STATE_FILE)  # atomic swap, never leaves a half-written file


STATE = _load_state()


# ----------------------------------------------------------------------
# KALSHI CLIENT (auth + orders)
# ----------------------------------------------------------------------
class KalshiClient:
    """Signs requests with your RSA key per Kalshi's trade-api/v2 auth."""

    def __init__(self):
        self.key_id = os.environ["KALSHI_API_KEY_ID"]
        # KALSHI_PRIVATE_KEY may be either the PEM contents (paste the whole key
        # into the env var — best for Render/cloud) or a path to a .pem file
        # (best for local runs). Detect which and load accordingly.
        key_value = os.environ["KALSHI_PRIVATE_KEY"]
        if "PRIVATE KEY" in key_value:
            key_bytes = key_value.encode()
        else:
            with open(key_value, "rb") as f:
                key_bytes = f.read()
        self.private_key = serialization.load_pem_private_key(
            key_bytes, password=None
        )

    def _headers(self, method: str, path: str) -> dict:
        ts = str(int(time.time() * 1000))
        msg = (ts + method.upper() + path).encode()
        sig = self.private_key.sign(
            msg,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.DIGEST_LENGTH,
            ),
            hashes.SHA256(),
        )
        return {
            "KALSHI-ACCESS-KEY": self.key_id,
            "KALSHI-ACCESS-SIGNATURE": base64.b64encode(sig).decode(),
            "KALSHI-ACCESS-TIMESTAMP": ts,
            "Content-Type": "application/json",
        }

    def get_market(self, ticker: str) -> dict:
        path = f"/trade-api/v2/markets/{ticker}"
        r = requests.get(
            KALSHI_BASE + path, headers=self._headers("GET", path), timeout=10
        )
        r.raise_for_status()
        return r.json()["market"]

    def list_markets(self, status: str = "open", limit: int = 100,
                     series_ticker: str | None = None) -> list[dict]:
        """List live markets so the bot can form its own picks. Signs the bare
        path (Kalshi's auth excludes the query string)."""
        path = "/trade-api/v2/markets"
        params = {"status": status, "limit": limit}
        if series_ticker:
            params["series_ticker"] = series_ticker
        url = KALSHI_BASE + path + "?" + urllib.parse.urlencode(params)
        r = requests.get(url, headers=self._headers("GET", path), timeout=10)
        r.raise_for_status()
        return r.json().get("markets", [])

    def place_no_limit_order(self, ticker: str, no_price_cents: int, count: int) -> dict:
        """Buy NO contracts at a limit price. count = number of contracts."""
        path = "/trade-api/v2/portfolio/orders"
        body = {
            "ticker": ticker,
            "client_order_id": str(uuid.uuid4()),  # idempotency: no double-fires
            "action": "buy",
            "side": "no",
            "type": "limit",
            "count": count,
            "no_price": no_price_cents,
        }
        r = requests.post(
            KALSHI_BASE + path,
            headers=self._headers("POST", path),
            data=json.dumps(body),
            timeout=10,
        )
        r.raise_for_status()
        return r.json()["order"]


# Build the client once and reuse it. The original re-read the .pem off disk and
# re-parsed the key on every single button tap; do it a single time at startup.
_KALSHI_CLIENT = None


def kalshi_client() -> KalshiClient:
    global _KALSHI_CLIENT
    if _KALSHI_CLIENT is None:
        _KALSHI_CLIENT = KalshiClient()
    return _KALSHI_CLIENT


# ----------------------------------------------------------------------
# GUARDRAIL CHECKS
# ----------------------------------------------------------------------
def _reset_daily_if_new_day():
    """Caller must hold _STATE_LOCK."""
    today = datetime.date.today().isoformat()
    if STATE["spend_date"] != today:
        STATE["spend_date"] = today
        STATE["spent_today"] = 0.0
        _save_state()


def can_spend(amount: float) -> tuple[bool, str]:
    """Caller must hold _STATE_LOCK."""
    _reset_daily_if_new_day()
    if not STATE["trading_enabled"]:
        return False, "Trading is OFF (/start_trading to re-enable)."
    if amount > MAX_STAKE_PER_BET:
        return False, f"Over per-bet cap (${MAX_STAKE_PER_BET:.2f})."
    if STATE["spent_today"] + amount > MAX_DAILY_TOTAL:
        left = MAX_DAILY_TOTAL - STATE["spent_today"]
        return False, f"Would exceed daily cap. ${left:.2f} left today."
    return True, ""


# ----------------------------------------------------------------------
# TELEGRAM: sending a pick with tap-to-bet buttons
# ----------------------------------------------------------------------
PENDING = {}  # pick_id -> pick dict (buttons carry only a short id)


async def ingest_scan(app: Application, chat_id: str, raw_picks: list[dict]):
    """
    PRIMARY entry point — call this with your scanner's full output.

    Every pick (above OR below the ping gate) is calibrated, logged, and paper-
    traded by the bot's own brain, so it learns from the whole game. Only picks
    that clear MIN_EDGE_CENTS get a tap-to-bet ping.
    """
    for pick in raw_picks:
        pick_id = uuid.uuid4().hex[:8]
        cal = learning.calibrate(pick["model_pct"])
        pick["calibrated_pct"] = cal
        pick["edge"] = round(cal - pick["no_price"], 1)

        # Bot's own imaginary bet + log — happens for EVERY scanned pick.
        paper = learning.observe(pick_id, pick, cal)

        if pick["edge"] >= MIN_EDGE_CENTS:
            PENDING[pick_id] = pick
            await _send_pick_message(app, chat_id, pick_id, pick, paper)


async def _send_pick_message(app, chat_id, pick_id, pick, paper):
    price = pick["no_price"]
    profit = 100 - price
    cal = pick["calibrated_pct"]
    model_line = f"Model {pick['model_pct']}%"
    if round(cal) != pick["model_pct"]:
        model_line += f" → cal {cal}%"
    # Show what the bot's own brain did with this pick.
    if paper["paper_bet"]:
        brain = f"🧠 paper: bet {paper['count']}x (${paper['cost']:.2f})"
    else:
        brain = "🧠 paper: skip"
    text = (
        f"🎯 *{pick['player']}: 1+ HR?*\n"
        f"{model_line}  |  NO @ {price}¢  |  "
        f"*+{pick['edge']}¢ edge*\n"
        f"Risk {price}¢ to win {profit}¢ per contract\n"
        f"{brain}"
    )
    buttons = [
        InlineKeyboardButton(f"Bet ${amt}", callback_data=f"bet|{pick_id}|{amt}")
        for amt in STAKE_OPTIONS
    ]
    buttons.append(InlineKeyboardButton("Skip", callback_data=f"skip|{pick_id}"))
    await app.bot.send_message(
        chat_id=chat_id,
        text=text,
        parse_mode="Markdown",
        reply_markup=InlineKeyboardMarkup([buttons]),
    )


# ----------------------------------------------------------------------
# TELEGRAM: button tap -> place the order
# ----------------------------------------------------------------------
async def on_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    # Only the owner can trade
    if str(query.from_user.id) != os.environ["TELEGRAM_CHAT_ID"]:
        return

    parts = query.data.split("|")
    action, pick_id = parts[0], parts[1]
    pick = PENDING.pop(pick_id, None)

    if pick is None:
        await query.edit_message_text("⏰ Pick expired or already handled.")
        return

    if action == "skip":
        await query.edit_message_text(f"⏭ Skipped {pick['player']}.")
        return

    stake = float(parts[2])
    price_cents = pick["no_price"]
    count = max(1, int((stake * 100) // price_cents))  # contracts that fit the stake
    actual_cost = count * price_cents / 100

    # Reserve the spend BEFORE firing the order, under the lock, so two quick
    # taps can't both pass the cap check. Roll it back if the order is rejected.
    with _STATE_LOCK:
        ok, reason = can_spend(actual_cost)
        if not ok:
            await query.edit_message_text(f"🚫 Blocked: {reason}")
            return
        STATE["spent_today"] += actual_cost
        _save_state()

    try:
        order = kalshi_client().place_no_limit_order(
            pick["ticker"], price_cents, count
        )
        learning.record_bet(pick_id, stake, count, actual_cost)
        await query.edit_message_text(
            f"✅ Order placed: {count}x NO on {pick['player']} @ {price_cents}¢ "
            f"(${actual_cost:.2f})\n"
            f"Status: {order.get('status', 'submitted')}\n"
            f"Spent today: ${STATE['spent_today']:.2f} / ${MAX_DAILY_TOTAL:.2f}"
        )
    except requests.HTTPError as e:
        with _STATE_LOCK:  # order never landed -> give the reservation back
            STATE["spent_today"] -= actual_cost
            _save_state()
        await query.edit_message_text(
            f"❌ Kalshi rejected the order: {e.response.status_code} "
            f"{e.response.text[:200]}"
        )
    except Exception as e:
        with _STATE_LOCK:
            STATE["spent_today"] -= actual_cost
            _save_state()
        await query.edit_message_text(f"❌ Error placing order: {e}")


# ----------------------------------------------------------------------
# KILL SWITCH + STATUS COMMANDS
# ----------------------------------------------------------------------
async def cmd_stop(update: Update, context: ContextTypes.DEFAULT_TYPE):
    with _STATE_LOCK:
        STATE["trading_enabled"] = False
        _save_state()
    await update.message.reply_text("🛑 Trading DISABLED. /start_trading to resume.")


async def cmd_start_trading(update: Update, context: ContextTypes.DEFAULT_TYPE):
    with _STATE_LOCK:
        STATE["trading_enabled"] = True
        _save_state()
    await update.message.reply_text("✅ Trading ENABLED.")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    with _STATE_LOCK:
        _reset_daily_if_new_day()
        enabled = STATE["trading_enabled"]
        spent = STATE["spent_today"]
    await update.message.reply_text(
        f"Trading: {'ON' if enabled else 'OFF'}\n"
        f"Spent today: ${spent:.2f} / ${MAX_DAILY_TOTAL:.2f}\n"
        f"Per-bet cap: ${MAX_STAKE_PER_BET:.2f} | Min edge: {MIN_EDGE_CENTS}¢"
    )


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Track record + calibration — the 'is it getting smarter' view."""
    summary = await asyncio.to_thread(learning.stats_summary)
    await update.message.reply_text(summary)


async def cmd_today(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Today's scorecard: how many of today's graded picks it called right."""
    summary = await asyncio.to_thread(learning.today_summary)
    await update.message.reply_text(summary)


async def cmd_picks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """The bot's live predictions on open markets right now."""
    summary = await asyncio.to_thread(learning.open_summary)
    await update.message.reply_text(summary)


# The command list shown in Telegram's "/" menu, with descriptions.
BOT_COMMANDS = [
    ("prediction", "The bot's live predictions on open markets"),
    ("today", "Today's prediction scorecard"),
    ("stats", "All-time track record & calibration"),
    ("status", "Trading on/off, caps, spend today"),
    ("stop", "Kill switch — disable trading"),
    ("start_trading", "Re-enable trading"),
    ("help", "What each command does"),
]


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    lines = ["Commands:"] + [f"/{name} — {desc}" for name, desc in BOT_COMMANDS]
    await update.message.reply_text("\n".join(lines))


async def _on_startup(app: Application):
    """Register the command list so Telegram's '/' menu is accurate — otherwise
    the menu is whatever was last set (or empty) and /picks won't show up."""
    await app.bot.set_my_commands([BotCommand(n, d) for n, d in BOT_COMMANDS])


# ----------------------------------------------------------------------
# SETTLEMENT POLLER — feeds outcomes back into calibration
# ----------------------------------------------------------------------
async def resolve_settled(context: ContextTypes.DEFAULT_TYPE):
    """
    Look up every unresolved pick's market on Kalshi; when one has settled,
    record whether the NO side won. Runs on a repeating JobQueue timer.
    """
    try:
        rows = await asyncio.to_thread(learning.unresolved)
        if not rows:
            return
        # One market can back several picks — query each ticker only once.
        by_ticker: dict[str, list] = {}
        for r in rows:
            by_ticker.setdefault(r["ticker"], []).append(r)

        client = kalshi_client()
        for ticker, picks in by_ticker.items():
            try:
                market = await asyncio.to_thread(client.get_market, ticker)
            except Exception as e:
                print(f"[resolve] {ticker}: lookup failed: {e}")
                continue
            result = (market.get("result") or "").lower()
            if result not in ("yes", "no"):
                continue  # not settled yet
            won = result == "no"  # this bot buys NO
            for r in picks:
                await asyncio.to_thread(learning.resolve_pick, r["pick_id"], won)
    except Exception as e:  # never let a poller error kill the bot
        print(f"[resolve] poller error: {e}")


# ----------------------------------------------------------------------
# AUTONOMOUS SELF-PICKING — the bot forms its own picks in the background
# ----------------------------------------------------------------------
async def autopick(context: ContextTypes.DEFAULT_TYPE):
    """
    Scan live Kalshi markets and log the bot's own paper picks — no scanner,
    no human tap. Its base opinion IS the market price, so calibration is what
    turns growth into edge: early on edge ~0 (pure watch), and it only starts
    paper-betting where its accumulated track record says the price is off.
    """
    try:
        client = kalshi_client()
        markets = await asyncio.to_thread(
            client.list_markets, "open", 100, AUTOPICK_SERIES
        )
        logged = 0
        alerts = 0
        for m in markets:
            if logged >= AUTOPICK_MAX:
                break
            ticker = m.get("ticker")
            no_ask = m.get("no_ask")  # cents to BUY the NO side right now
            if not ticker or not no_ask or not (1 <= no_ask <= 99):
                continue  # missing / illiquid market
            if await asyncio.to_thread(learning.has_open_pick, ticker):
                continue  # already watching this open market

            # Market-as-model: the price is our starting probability. Calibration
            # (learned from real outcomes) is the only thing that creates edge.
            model_pct = int(round(no_ask))
            cal = await asyncio.to_thread(learning.calibrate, model_pct)
            pick = {
                "ticker": ticker,
                "player": m.get("title") or m.get("subtitle") or ticker,
                "model_pct": model_pct,
                "no_price": int(no_ask),
                "calibrated_pct": cal,
                "edge": round(cal - no_ask, 1),
            }
            paper = await asyncio.to_thread(
                learning.observe, f"auto-{uuid.uuid4().hex[:8]}", pick, cal
            )
            logged += 1

            # LIVE ALERT: only when the bot made a *confident* paper bet on it.
            if paper["paper_bet"] and alerts < MAX_ALERTS_PER_CYCLE:
                await _send_alert(
                    context.bot,
                    f"🎯 *New confident pick*\n{pick['player'][:60]}\n"
                    f"NO {pick['no_price']}¢ → bot {cal:.0f}%  "
                    f"(edge +{pick['edge']:.1f}¢)\n"
                    f"🧠 paper bet {paper['count']}x (${paper['cost']:.2f})"
                )
                alerts += 1
        if logged:
            print(f"[autopick] logged {logged} self-picks, {alerts} alerts")
    except Exception as e:  # never let the poller kill the bot
        print(f"[autopick] error: {e}")


async def _send_alert(bot, text: str):
    """Send a proactive message to the alert chat; never crash on failure
    (e.g. the bot can't DM a user who hasn't started a chat with it)."""
    if not ALERT_CHAT_ID:
        return
    try:
        await bot.send_message(chat_id=ALERT_CHAT_ID, text=text, parse_mode="Markdown")
    except Exception as e:
        print(f"[alert] could not send (has the chat started the bot?): {e}")


async def daily_digest(context: ContextTypes.DEFAULT_TYPE):
    """Once a day: send the bot's best confident open picks."""
    text = await asyncio.to_thread(learning.best_picks_summary)
    await _send_alert(context.bot, text)


# ----------------------------------------------------------------------
# WIRE-UP
# ----------------------------------------------------------------------
def main():
    learning.init_db()

    app = (
        Application.builder()
        .token(os.environ["TELEGRAM_BOT_TOKEN"])
        .post_init(_on_startup)   # register the "/" command menu on startup
        .build()
    )
    app.add_handler(CallbackQueryHandler(on_button))
    app.add_handler(CommandHandler("stop", cmd_stop))
    app.add_handler(CommandHandler("start_trading", cmd_start_trading))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("stats", cmd_stats))
    app.add_handler(CommandHandler("today", cmd_today))
    app.add_handler(CommandHandler("prediction", cmd_picks))
    app.add_handler(CommandHandler("picks", cmd_picks))  # alias, keeps old name working
    app.add_handler(CommandHandler("help", cmd_help))

    # Poll Kalshi for settled markets so outcomes flow back into calibration.
    app.job_queue.run_repeating(resolve_settled, interval=RESOLVE_INTERVAL_SECONDS, first=60)

    # Autonomous background self-picking (set KALSHI_AUTOPICK=1 to turn on).
    if AUTOPICK_ENABLED:
        app.job_queue.run_repeating(autopick, interval=AUTOPICK_INTERVAL, first=10)
        print(f"[autopick] ON — scanning every {AUTOPICK_INTERVAL}s"
              + (f", series={AUTOPICK_SERIES}" if AUTOPICK_SERIES else ", all series"))

    # Daily "best picks of the day" digest to the alert chat.
    if ALERT_CHAT_ID:
        app.job_queue.run_daily(
            daily_digest,
            time=datetime.time(hour=DIGEST_HOUR, tzinfo=datetime.timezone.utc),
        )
        print(f"[digest] daily best-picks at {DIGEST_HOUR:02d}:00 UTC → chat {ALERT_CHAT_ID}")

    # --- Optional: push picks from your OWN scanner too ---
    # If you also have an external model, feed its full output to ingest_scan;
    # it paper-trades/logs everything and pings you on picks above MIN_EDGE_CENTS:
    #
    #     await ingest_scan(app, os.environ["TELEGRAM_CHAT_ID"], raw_scanner_output)

    app.run_polling()


if __name__ == "__main__":
    main()
