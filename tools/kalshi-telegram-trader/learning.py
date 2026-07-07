"""
Learning + paper-trading brain — the bot plays its own game to get sharper
==========================================================================
Two jobs live here.

1. TRACK RECORD + CALIBRATION (honest "gets smarter the more it scans")
   Every scanned pick is logged. A poller records how each one actually
   settled on Kalshi. Predictions are bucketed and compared to real hit
   rates, and future probabilities are corrected with shrinkage:
        calibrated = (wins + K * p_raw) / (n + K)
   With no data it returns the raw model number; the more resolved picks in
   a bucket, the more it trusts what actually happened.

2. PAPER BRAIN (the bot bets its own imaginary money on EVERYTHING)
   For every pick it scans -- not just the ones it pings you about -- the
   bot makes its own call: would I bet this, and how much? It sizes with
   fractional Kelly off a compounding *paper* bankroll, records the
   imaginary bet, and when the market settles it scores itself. This is how
   it sees the whole game: it learns from picks it would never have shown
   you, and you can watch its paper bankroll, win rate, and prediction
   accuracy (Brier score) move over time via /stats.

   Nothing here spends real money. Real bets (button taps) are tracked
   separately in the same row.

Storage: one SQLite file (stdlib, no deps), KALSHI_LEARNING_DB or
./kalshi_learning.db next to this file.
"""

import os
import math
import sqlite3
import threading
import datetime

DB_PATH = os.environ.get(
    "KALSHI_LEARNING_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "kalshi_learning.db"),
)

# --- Calibration ---
BUCKET_WIDTH = 10        # percentage-point buckets across the 0-100 model scale
PRIOR_STRENGTH = 20      # phantom obs anchoring the raw number before data wins
# How many standard errors of confidence the calibrated edge must clear before
# the paper brain will bet on it. This is what stops it betting on pure noise:
# an efficient market never produces a statistically real edge, so it stays in
# watch mode; only a persistent, sample-backed miscalibration gets bet.
CONFIDENCE_Z = float(os.environ.get("KALSHI_CONFIDENCE_Z", "1.64"))  # ~95% one-sided

# --- Paper brain ---
PAPER_BANKROLL_START = float(os.environ.get("KALSHI_PAPER_BANKROLL", "1000"))
KELLY_FRACTION = float(os.environ.get("KALSHI_KELLY_FRACTION", "0.5"))  # half-Kelly
PAPER_MAX_FRACTION = 0.10     # never risk >10% of the paper bankroll on one bet
PAPER_MIN_EDGE_CENTS = int(os.environ.get("KALSHI_PAPER_MIN_EDGE", "3"))

_LOCK = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _LOCK, _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS picks (
                pick_id        TEXT PRIMARY KEY,
                ticker         TEXT NOT NULL,
                player         TEXT,
                model_pct      INTEGER NOT NULL,   -- raw model P(NO wins), 0-100
                calibrated_pct REAL,               -- corrected prob at scan time
                no_price       INTEGER NOT NULL,
                edge           REAL,               -- calibrated edge at scan time
                created_at     TEXT NOT NULL,
                -- real money (button taps)
                bet            INTEGER NOT NULL DEFAULT 0,
                stake          REAL,
                count          INTEGER,
                cost           REAL,
                pnl            REAL,
                -- paper brain (the bot's own imaginary bet)
                paper_bet      INTEGER NOT NULL DEFAULT 0,
                paper_count    INTEGER,
                paper_cost     REAL,
                paper_pnl      REAL,
                bankroll_at    REAL,               -- paper bankroll when it decided
                -- resolution
                resolved       INTEGER NOT NULL DEFAULT 0,
                won            INTEGER,             -- 1 NO side won, 0 lost
                resolved_at    TEXT
            )
            """
        )
        # Lightweight migration for DBs created by an earlier version.
        have = {r["name"] for r in c.execute("PRAGMA table_info(picks)")}
        for col, decl in [
            ("paper_bet", "INTEGER NOT NULL DEFAULT 0"),
            ("paper_count", "INTEGER"),
            ("paper_cost", "REAL"),
            ("paper_pnl", "REAL"),
            ("bankroll_at", "REAL"),
            ("pnl", "REAL"),
        ]:
            if col not in have:
                c.execute(f"ALTER TABLE picks ADD COLUMN {col} {decl}")


# ----------------------------------------------------------------------
# Calibration
# ----------------------------------------------------------------------
def _bucket_bounds(model_pct: float) -> tuple[int, int]:
    b = min(int(model_pct) // BUCKET_WIDTH, (100 // BUCKET_WIDTH) - 1)
    return b * BUCKET_WIDTH, (b + 1) * BUCKET_WIDTH


def _bucket_stats(model_pct: float) -> tuple[int, int]:
    lo, hi = _bucket_bounds(model_pct)
    with _LOCK, _conn() as c:
        row = c.execute(
            "SELECT COUNT(*) n, COALESCE(SUM(won),0) wins FROM picks "
            "WHERE resolved=1 AND model_pct >= ? AND model_pct < ?",
            (lo, hi),
        ).fetchone()
    return row["n"], row["wins"]


def _calibrated_prob(model_pct: float) -> tuple[float, float]:
    """Returns (point, lower_bound) probabilities in 0-1 for a raw model number.
      point       = shrinkage-calibrated estimate.
      lower_bound = point minus CONFIDENCE_Z standard errors — the conservative
                    estimate the paper brain must bet against, so it can't chase
                    calibration noise in thin buckets."""
    n, wins = _bucket_stats(model_pct)
    p_raw = model_pct / 100.0
    point = (wins + PRIOR_STRENGTH * p_raw) / (n + PRIOR_STRENGTH)
    n_eff = n + PRIOR_STRENGTH
    se = math.sqrt(max(point * (1 - point), 1e-9) / n_eff)
    return point, max(0.0, point - CONFIDENCE_Z * se)


def calibrate(model_pct: float) -> float:
    """Shrinkage-calibrated point estimate of P(NO wins), 0-100 (for display)."""
    return round(_calibrated_prob(model_pct)[0] * 100.0, 1)


# ----------------------------------------------------------------------
# Paper brain
# ----------------------------------------------------------------------
def _paper_cash() -> tuple[float, float]:
    """Returns (equity, available).
      equity    = start + realized PnL from settled paper bets (net worth).
      available = equity minus cash tied up in open (unsettled) paper bets.
    Sizing must use `available` so the brain can never commit money it doesn't
    have — that's what kept the paper bankroll from going negative."""
    with _LOCK, _conn() as c:
        row = c.execute(
            """
            SELECT
              COALESCE(SUM(CASE WHEN resolved=1 THEN paper_pnl END),0.0) realized,
              COALESCE(SUM(CASE WHEN resolved=0 THEN paper_cost END),0.0) outstanding
            FROM picks WHERE paper_bet=1
            """
        ).fetchone()
    equity = PAPER_BANKROLL_START + row["realized"]
    return equity, max(0.0, equity - row["outstanding"])


def paper_bankroll() -> float:
    """The bot's paper equity: start + realized PnL from settled bets."""
    return _paper_cash()[0]


def _kelly_fraction(p: float, price_cents: int) -> float:
    """Fractional Kelly for a NO contract: risk `price`¢ to win (100-price)¢.
    p is the (calibrated) win probability, 0-1."""
    if price_cents <= 0 or price_cents >= 100:
        return 0.0
    b = (100 - price_cents) / price_cents          # net odds
    f = p - (1 - p) / b                            # full Kelly
    return max(0.0, f) * KELLY_FRACTION


def _paper_decision(lower_prob_pct: float, bettable_edge: float, price_cents: int,
                    equity: float, available: float):
    """Decide the bot's own imaginary bet. Returns (paper_bet, count, cost).
    Both the gate and the Kelly size use the CONSERVATIVE (lower-bound) prob, so
    a noisy thin bucket never gets bet and sizing never chases an inflated edge.
    Kelly sizes off equity, capped at available cash so open positions can't
    over-commit the bankroll."""
    if bettable_edge < PAPER_MIN_EDGE_CENTS or available <= 0:
        return 0, 0, 0.0
    f = min(_kelly_fraction(lower_prob_pct / 100.0, price_cents), PAPER_MAX_FRACTION)
    stake = min(f * equity, available)             # never spend cash you don't have
    count = int((stake * 100) // price_cents)
    if count < 1:
        return 0, 0, 0.0
    return 1, count, round(count * price_cents / 100.0, 2)


def observe(pick_id: str, pick: dict, calibrated_pct: float) -> dict:
    """Log a scanned pick AND record the bot's own paper decision on it.
    Called for every pick the scanner produces, above or below the ping gate.
    Returns the paper decision so the caller can surface it."""
    price = int(pick["no_price"])
    edge = round(calibrated_pct - price, 1)          # point edge, for display
    # Confidence-gated edge the paper brain actually bets on.
    _, lower = _calibrated_prob(pick["model_pct"])
    lower_pct = lower * 100.0
    bettable_edge = round(lower_pct - price, 1)
    equity, available = _paper_cash()
    paper_bet, count, cost = _paper_decision(
        lower_pct, bettable_edge, price, equity, available)
    with _LOCK, _conn() as c:
        c.execute(
            """
            INSERT OR IGNORE INTO picks
                (pick_id, ticker, player, model_pct, calibrated_pct, no_price,
                 edge, created_at, paper_bet, paper_count, paper_cost, bankroll_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pick_id, pick["ticker"], pick.get("player"),
                int(pick["model_pct"]), round(float(calibrated_pct), 2), price,
                edge, datetime.datetime.utcnow().isoformat(),
                paper_bet, count, cost, round(equity, 2),
            ),
        )
    return {"paper_bet": paper_bet, "count": count, "cost": cost,
            "equity": equity, "available": available}


# ----------------------------------------------------------------------
# Real-money bet (button tap) + resolution
# ----------------------------------------------------------------------
def record_bet(pick_id: str, stake: float, count: int, cost: float):
    with _LOCK, _conn() as c:
        c.execute(
            "UPDATE picks SET bet=1, stake=?, count=?, cost=? WHERE pick_id=?",
            (stake, count, cost, pick_id),
        )


def unresolved() -> list[sqlite3.Row]:
    with _LOCK, _conn() as c:
        return c.execute(
            "SELECT pick_id, ticker FROM picks WHERE resolved=0"
        ).fetchall()


def has_open_pick(ticker: str) -> bool:
    """True if there's already an unresolved pick on this market, so the
    autonomous poller doesn't log the same open market over and over."""
    with _LOCK, _conn() as c:
        return c.execute(
            "SELECT 1 FROM picks WHERE ticker=? AND resolved=0 LIMIT 1", (ticker,)
        ).fetchone() is not None


def resolve_pick(pick_id: str, won: bool):
    """Settle a pick: score both the real bet and the paper bet on it."""
    with _LOCK, _conn() as c:
        row = c.execute(
            "SELECT no_price, bet, count, paper_bet, paper_count "
            "FROM picks WHERE pick_id=?",
            (pick_id,),
        ).fetchone()
        if row is None:
            return
        price = row["no_price"]

        def pnl(n):
            if not n:
                return 0.0
            return n * (100 - price) / 100.0 if won else -(n * price / 100.0)

        real_pnl = round(pnl(row["count"]), 2) if row["bet"] else None
        paper_pnl = round(pnl(row["paper_count"]), 2) if row["paper_bet"] else None
        c.execute(
            "UPDATE picks SET resolved=1, won=?, pnl=?, paper_pnl=?, resolved_at=? "
            "WHERE pick_id=?",
            (1 if won else 0, real_pnl, paper_pnl,
             datetime.datetime.utcnow().isoformat(), pick_id),
        )


# ----------------------------------------------------------------------
# Scoring / reporting
# ----------------------------------------------------------------------
def _brier(rows, prob_col: str) -> float | None:
    """Mean squared error of a probability column vs actual outcome. Lower is
    better; 0.25 is the coin-flip baseline. None if no data."""
    vals = [((r[prob_col] / 100.0) - r["won"]) ** 2 for r in rows if r[prob_col] is not None]
    return sum(vals) / len(vals) if vals else None


def today_summary() -> str:
    """Today's scorecard: of the picks that SETTLED today, how many the paper
    brain (and any real bets) called right, plus the day's PnL. Note a pick
    settles when its Kalshi market settles, which may be days after it was
    logged — so this is 'graded today', not 'placed today'. Date is UTC."""
    today = datetime.datetime.utcnow().date().isoformat()
    with _LOCK, _conn() as c:
        t = c.execute(
            """
            SELECT
              COUNT(*) settled,
              COALESCE(SUM(CASE WHEN paper_bet=1 THEN 1 END),0) pbets,
              COALESCE(SUM(CASE WHEN paper_bet=1 THEN won END),0) pwins,
              COALESCE(SUM(CASE WHEN paper_bet=1 THEN paper_pnl END),0.0) ppnl,
              COALESCE(SUM(CASE WHEN bet=1 THEN 1 END),0) rbets,
              COALESCE(SUM(CASE WHEN bet=1 THEN won END),0) rwins,
              COALESCE(SUM(CASE WHEN bet=1 THEN pnl END),0.0) rpnl
            FROM picks
            WHERE resolved=1 AND substr(resolved_at,1,10)=?
            """,
            (today,),
        ).fetchone()

    L = [f"📅 Today ({today} UTC)"]
    L.append(f"Picks graded today: {t['settled']}")
    if t["pbets"]:
        wr = 100.0 * t["pwins"] / t["pbets"]
        L.append(f"🧠 Paper bets: {t['pbets']}  |  right: {t['pwins']}/{t['pbets']} "
                 f"({wr:.0f}%)  |  PnL ${t['ppnl']:+.2f}")
    else:
        L.append("🧠 Paper bets graded today: 0 (watching, no confident edge yet)")
    if t["rbets"]:
        rwr = 100.0 * t["rwins"] / t["rbets"]
        L.append(f"💵 Real bets: {t['rbets']}  |  right: {t['rwins']}/{t['rbets']} "
                 f"({rwr:.0f}%)  |  PnL ${t['rpnl']:+.2f}")
    return "\n".join(L)


def stats_summary() -> str:
    with _LOCK, _conn() as c:
        t = c.execute(
            """
            SELECT
              COUNT(*) picks,
              COALESCE(SUM(resolved),0) resolved,
              COALESCE(SUM(bet),0) bets,
              COALESCE(SUM(CASE WHEN bet=1 AND resolved=1 THEN 1 END),0) rbet_settled,
              COALESCE(SUM(CASE WHEN bet=1 AND resolved=1 THEN won END),0) rbet_wins,
              COALESCE(SUM(CASE WHEN bet=1 AND resolved=1 THEN pnl END),0.0) rpnl,
              COALESCE(SUM(CASE WHEN bet=1 AND resolved=1 THEN cost END),0.0) rstaked,
              COALESCE(SUM(paper_bet),0) pbets,
              COALESCE(SUM(CASE WHEN paper_bet=1 AND resolved=1 THEN 1 END),0) pbet_settled,
              COALESCE(SUM(CASE WHEN paper_bet=1 AND resolved=1 THEN won END),0) pbet_wins,
              COALESCE(SUM(CASE WHEN paper_bet=1 AND resolved=1 THEN paper_pnl END),0.0) ppnl,
              COALESCE(SUM(CASE WHEN paper_bet=1 AND resolved=1 THEN paper_cost END),0.0) pstaked
            FROM picks
            """
        ).fetchone()
        resolved_rows = c.execute(
            "SELECT won, model_pct, calibrated_pct FROM picks WHERE resolved=1"
        ).fetchall()
        buckets = c.execute(
            "SELECT (model_pct/?) b, COUNT(*) n, COALESCE(SUM(won),0) wins "
            "FROM picks WHERE resolved=1 GROUP BY b ORDER BY b",
            (BUCKET_WIDTH,),
        ).fetchall()

    L = []
    L.append("🧠 *Paper brain* (imaginary money, every scan)")
    bankroll = PAPER_BANKROLL_START + t["ppnl"]
    L.append(f"Bankroll: ${bankroll:,.2f}  (start ${PAPER_BANKROLL_START:,.0f}, "
             f"{'+' if t['ppnl']>=0 else ''}{t['ppnl']:.2f})")
    L.append(f"Paper bets: {t['pbets']}  |  settled: {t['pbet_settled']}")
    if t["pbet_settled"]:
        pwr = 100.0 * t["pbet_wins"] / t["pbet_settled"]
        L.append(f"Win rate: {pwr:.0f}%  ({t['pbet_wins']}/{t['pbet_settled']})")
    if t["pstaked"]:
        L.append(f"Paper ROI: {100.0*t['ppnl']/t['pstaked']:+.0f}%  "
                 f"(risked ${t['pstaked']:.2f})")

    L.append("\n📊 *Track record*")
    L.append(f"Picks logged: {t['picks']}  |  resolved: {t['resolved']}")
    br_raw, br_cal = _brier(resolved_rows, "model_pct"), _brier(resolved_rows, "calibrated_pct")
    if br_raw is not None:
        arrow = ""
        if br_cal is not None:
            arrow = "  ✅ sharper" if br_cal < br_raw else "  (raw still ahead)"
        L.append(f"Accuracy (Brier, lower=better): raw {br_raw:.3f} → "
                 f"calibrated {br_cal:.3f}{arrow}")
        L.append("  (0.25 = coin flip)")

    if t["rbet_settled"]:
        rwr = 100.0 * t["rbet_wins"] / t["rbet_settled"]
        L.append(f"\n💵 Real bets settled: {t['rbet_settled']}  |  "
                 f"win {rwr:.0f}%  |  PnL ${t['rpnl']:.2f}")

    if buckets:
        L.append("\nCalibration (model% → actual):")
        for r in buckets:
            b = int(r["b"]); lo, hi = b * BUCKET_WIDTH, (b + 1) * BUCKET_WIDTH
            actual = 100.0 * r["wins"] / r["n"] if r["n"] else 0.0
            L.append(f"  {lo:>3}-{hi:<3}%:  {actual:5.0f}%  (n={r['n']})")
    else:
        L.append("\nNo settled picks yet — the brain scores itself as they resolve.")

    return "\n".join(L)
