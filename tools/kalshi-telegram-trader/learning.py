"""
Learning layer — the bot gets smarter the more it scans
========================================================
What it does (and, honestly, what it does NOT):

  It CANNOT retrain your scanner's model — that lives outside this bot.
  It CAN keep a track record and correct itself from it:

    1. Every pick the bot surfaces is logged.
    2. A background job polls Kalshi for settled markets and records the
       outcome (did the NO side win?) for each logged pick.
    3. Calibration: predictions are bucketed and compared against the real
       hit rate. "Model said 80%" is checked against "actually hit X%", and
       future probabilities are corrected toward what actually happens.
    4. The edge gate runs on the *calibrated* probability, so as data
       accumulates the bot pings less on edges that never pay off.

  The correction uses shrinkage: with little data it trusts the raw model
  number; the more resolved picks in a bucket, the more it trusts the
  observed hit rate. So it literally sharpens the more it scans.

Storage: a single SQLite file (stdlib, no extra deps), path from
KALSHI_LEARNING_DB or ./kalshi_learning.db next to this file.
"""

import os
import sqlite3
import threading
import datetime

DB_PATH = os.environ.get(
    "KALSHI_LEARNING_DB",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "kalshi_learning.db"),
)

# Buckets of 10 percentage points across the 0-100 model scale.
BUCKET_WIDTH = 10
# Prior strength: how many "phantom" observations anchor the raw model number
# before real outcomes outweigh it. Higher = slower, steadier learning.
PRIOR_STRENGTH = 20

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
                calibrated_pct REAL,               -- corrected prob at send time
                no_price       INTEGER NOT NULL,
                edge           INTEGER,             -- calibrated edge at send time
                created_at     TEXT NOT NULL,
                -- betting
                bet            INTEGER NOT NULL DEFAULT 0,
                stake          REAL,
                count          INTEGER,
                cost           REAL,
                -- resolution
                resolved       INTEGER NOT NULL DEFAULT 0,
                won            INTEGER,             -- 1 NO side won, 0 lost
                pnl            REAL,                -- realized $ (bets only)
                resolved_at    TEXT
            )
            """
        )


def log_pick(pick_id: str, pick: dict, calibrated_pct: float):
    """Record that a pick was surfaced (bet or not)."""
    with _LOCK, _conn() as c:
        c.execute(
            """
            INSERT OR IGNORE INTO picks
                (pick_id, ticker, player, model_pct, calibrated_pct,
                 no_price, edge, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pick_id,
                pick["ticker"],
                pick.get("player"),
                int(pick["model_pct"]),
                round(float(calibrated_pct), 2),
                int(pick["no_price"]),
                int(pick.get("edge", 0)),
                datetime.datetime.utcnow().isoformat(),
            ),
        )


def record_bet(pick_id: str, stake: float, count: int, cost: float):
    with _LOCK, _conn() as c:
        c.execute(
            "UPDATE picks SET bet=1, stake=?, count=?, cost=? WHERE pick_id=?",
            (stake, count, cost, pick_id),
        )


def unresolved() -> list[sqlite3.Row]:
    """Picks that have not settled yet, for the resolution poller."""
    with _LOCK, _conn() as c:
        return c.execute(
            "SELECT pick_id, ticker, no_price, count, bet FROM picks WHERE resolved=0"
        ).fetchall()


def resolve_pick(pick_id: str, won: bool, no_price: int, count, bet: int):
    """Mark a pick settled and compute realized PnL for actual bets."""
    pnl = 0.0
    if bet and count:
        if won:
            pnl = count * (100 - no_price) / 100.0   # settles at 100¢
        else:
            pnl = -(count * no_price / 100.0)         # settles at 0¢
    with _LOCK, _conn() as c:
        c.execute(
            "UPDATE picks SET resolved=1, won=?, pnl=?, resolved_at=? WHERE pick_id=?",
            (1 if won else 0, round(pnl, 2), datetime.datetime.utcnow().isoformat(), pick_id),
        )


def _bucket(model_pct: float) -> int:
    b = int(model_pct) // BUCKET_WIDTH
    return min(b, (100 // BUCKET_WIDTH) - 1)  # clamp 100 into the top bucket


def calibrate(model_pct: float) -> float:
    """
    Map a raw model probability (0-100) to a calibrated one using the observed
    hit rate in its bucket, shrunk toward the raw number by PRIOR_STRENGTH.

      calibrated = (wins + K * p_raw) / (n + K)

    With no history this returns model_pct unchanged; it moves toward the real
    hit rate as resolved picks in the bucket accumulate.
    """
    b = _bucket(model_pct)
    lo, hi = b * BUCKET_WIDTH, (b + 1) * BUCKET_WIDTH
    with _LOCK, _conn() as c:
        row = c.execute(
            """
            SELECT COUNT(*) AS n, COALESCE(SUM(won), 0) AS wins
            FROM picks
            WHERE resolved=1 AND model_pct >= ? AND model_pct < ?
            """,
            (lo, hi),
        ).fetchone()
    n, wins = row["n"], row["wins"]
    p_raw = model_pct / 100.0
    calibrated = (wins + PRIOR_STRENGTH * p_raw) / (n + PRIOR_STRENGTH)
    return round(calibrated * 100.0, 1)


def stats_summary() -> str:
    with _LOCK, _conn() as c:
        totals = c.execute(
            """
            SELECT
                COUNT(*)                                   AS picks,
                COALESCE(SUM(resolved), 0)                 AS resolved,
                COALESCE(SUM(bet), 0)                       AS bets,
                COALESCE(SUM(CASE WHEN bet=1 AND resolved=1 THEN 1 ELSE 0 END), 0) AS settled_bets,
                COALESCE(SUM(CASE WHEN bet=1 THEN won ELSE 0 END), 0)              AS bet_wins,
                COALESCE(SUM(CASE WHEN bet=1 THEN pnl ELSE 0 END), 0.0)           AS pnl,
                COALESCE(SUM(CASE WHEN bet=1 THEN cost ELSE 0 END), 0.0)          AS staked
            FROM picks
            """
        ).fetchone()
        buckets = c.execute(
            """
            SELECT (model_pct / ?) AS b,
                   COUNT(*) AS n,
                   COALESCE(SUM(won), 0) AS wins
            FROM picks
            WHERE resolved=1
            GROUP BY b
            ORDER BY b
            """,
            (BUCKET_WIDTH,),
        ).fetchall()

    lines = [
        f"📊 Track record",
        f"Picks logged: {totals['picks']}  |  Resolved: {totals['resolved']}",
        f"Bets placed: {totals['bets']}  |  Settled: {totals['settled_bets']}",
    ]
    if totals["settled_bets"]:
        wr = 100.0 * totals["bet_wins"] / totals["settled_bets"]
        lines.append(f"Bet win rate: {wr:.0f}%  ({totals['bet_wins']}/{totals['settled_bets']})")
    if totals["staked"]:
        roi = 100.0 * totals["pnl"] / totals["staked"]
        lines.append(f"Realized PnL: ${totals['pnl']:.2f}  |  ROI: {roi:+.0f}%")

    if buckets:
        lines.append("\nCalibration (model% → actual):")
        for row in buckets:
            b = int(row["b"])
            lo, hi = b * BUCKET_WIDTH, (b + 1) * BUCKET_WIDTH
            n, wins = row["n"], row["wins"]
            actual = 100.0 * wins / n if n else 0.0
            lines.append(f"  {lo:>3}-{hi:<3}%:  {actual:5.0f}%  (n={n})")
    else:
        lines.append("\nNo settled picks yet — calibration kicks in as they resolve.")

    return "\n".join(lines)
