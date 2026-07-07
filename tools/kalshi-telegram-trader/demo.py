"""
demo.py — watch the learning brain work, end to end (SIMULATION ONLY)
=====================================================================
THIS IS NOT LIVE TRADING AND NOT MODEL VALIDATION.

There is no real scanner/model yet, so this script feeds the bot's brain a
stream of *synthetic* picks and *synthetic* outcomes purely so you can watch
the machinery run: calibration correcting the model, the paper brain sizing
imaginary bets off a compounding bankroll, and /stats evolving as data piles up.

  - Uses a SEPARATE database (kalshi_demo.db), reset on every run, so it never
    touches your real kalshi_learning.db.
  - No Telegram, no Kalshi, no real money, no secrets required.
  - Synthetic outcomes are drawn from a "true" probability you control, so the
    numbers here say nothing about whether any real model has edge.

Run:
    python demo.py                 # 400 scans, model overconfident by 10 pts
    python demo.py --scans 1000 --bias 0    # a well-calibrated model
    python demo.py --bias 20 --seed 7       # a badly overconfident one

When you have a REAL scanner, none of this is used — you call
`ingest_scan(app, chat_id, real_picks)` from bot.py instead.
"""

import os
import argparse
import random
import collections

# Point the learning layer at a throwaway DB BEFORE importing it, and start
# fresh so each demo run is clean.
_DEMO_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kalshi_demo.db")
os.environ["KALSHI_LEARNING_DB"] = _DEMO_DB
os.environ.setdefault("KALSHI_PAPER_BANKROLL", "1000")
if os.path.exists(_DEMO_DB):
    os.remove(_DEMO_DB)

import learning  # noqa: E402  (import after env is set)


def true_prob(model_pct: int, bias: int) -> float:
    """The 'real' P(NO wins). The model claims model_pct but is overconfident
    by `bias` points, so reality is lower. bias=0 => perfectly calibrated."""
    return max(0.02, min(0.98, (model_pct - bias) / 100.0))


def main():
    ap = argparse.ArgumentParser(description="Simulate the learning brain (fake data).")
    ap.add_argument("--scans", type=int, default=400, help="number of synthetic picks")
    ap.add_argument("--bias", type=int, default=10,
                    help="model overconfidence in points (0 = well calibrated)")
    ap.add_argument("--lag", type=int, default=5,
                    help="scans between placing a pick and it settling")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    random.seed(args.seed)
    learning.init_db()

    print(f"SIMULATION — {args.scans} synthetic scans, model overconfident by "
          f"{args.bias} pts. Fake data in {os.path.basename(_DEMO_DB)}.\n")

    pending = collections.deque()

    def settle(pid, mp):
        learning.resolve_pick(pid, random.random() < true_prob(mp, args.bias))

    for i in range(args.scans):
        if len(pending) >= args.lag:
            settle(*pending.popleft())

        model_pct = random.randint(60, 95)
        # Price gives some apparent edge on the raw model number.
        price = max(5, min(95, model_pct - random.randint(3, 12)))
        pid = f"demo{i}"
        cal = learning.calibrate(model_pct)
        pick = {
            "ticker": f"DEMO-{i}", "player": f"Player{i}",
            "model_pct": model_pct, "no_price": price,
            "calibrated_pct": cal, "edge": round(cal - price, 1),
        }
        learning.observe(pid, pick, cal)
        pending.append((pid, model_pct))

        if (i + 1) % max(1, args.scans // 4) == 0:
            print(f"--- after {i + 1} scans "
                  f"(paper bankroll ${learning.paper_bankroll():,.2f}) ---")

    while pending:
        settle(*pending.popleft())

    print("\n" + "=" * 60)
    print(learning.stats_summary())
    print("=" * 60)
    print("\nReminder: synthetic data. This measures the plumbing, not a real model.")


if __name__ == "__main__":
    main()
