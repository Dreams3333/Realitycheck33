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
import datetime
import uuid
import threading
import requests

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
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
        key_path = os.environ["KALSHI_PRIVATE_KEY"]
        with open(key_path, "rb") as f:
            self.private_key = serialization.load_pem_private_key(
                f.read(), password=None
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
# EDGE FILTER — see EDGE CONVENTION in the module docstring
# ----------------------------------------------------------------------
def filter_picks(picks: list[dict]) -> list[dict]:
    """
    picks: [{"ticker": ..., "player": ..., "model_pct": 88, "no_price": 92}, ...]
    `model_pct` is the model's fair probability for the NO side (0-100).
    Keeps only positive-edge picks, sorted best edge first.
    """
    kept = []
    for p in picks:
        edge = p["model_pct"] - p["no_price"]
        if edge >= MIN_EDGE_CENTS:
            p["edge"] = edge
            kept.append(p)
    return sorted(kept, key=lambda p: p["edge"], reverse=True)


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


async def send_pick(app: Application, chat_id: str, pick: dict):
    pick_id = uuid.uuid4().hex[:8]
    PENDING[pick_id] = pick

    price = pick["no_price"]
    profit = 100 - price
    text = (
        f"🎯 *{pick['player']}: 1+ HR?*\n"
        f"Model: {pick['model_pct']}%  |  NO @ {price}¢  |  "
        f"*+{pick['edge']}¢ edge*\n"
        f"Risk {price}¢ to win {profit}¢ per contract"
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


# ----------------------------------------------------------------------
# WIRE-UP
# ----------------------------------------------------------------------
def main():
    app = Application.builder().token(os.environ["TELEGRAM_BOT_TOKEN"]).build()
    app.add_handler(CallbackQueryHandler(on_button))
    app.add_handler(CommandHandler("stop", cmd_stop))
    app.add_handler(CommandHandler("start_trading", cmd_start_trading))
    app.add_handler(CommandHandler("status", cmd_status))

    # --- Example: how your scanner would push picks ---
    # In your real bot, call send_pick(...) from your scan loop, e.g.:
    #
    # picks = filter_picks(raw_scanner_output)
    # for p in picks:
    #     await send_pick(app, os.environ["TELEGRAM_CHAT_ID"], p)

    app.run_polling()


if __name__ == "__main__":
    main()
