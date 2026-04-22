"use client";

import { useEffect, useState } from "react";

type Row = { address: string; earningsCusd: number; earningsWei: string };

export function Leaderboard() {
  const [period, setPeriod] = useState<"day" | "week">("week");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/leaderboard?period=${period}`);
        const j = (await r.json()) as { rows?: Row[] };
        if (!cancelled) {
          setRows(j.rows ?? []);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <div className="leaderboard">
      <div className="leaderboard__head">
        <h3>Leaderboard</h3>
        <select
          className="leaderboard__period"
          value={period}
          onChange={(e) => setPeriod(e.target.value as "day" | "week")}
          aria-label="Leaderboard period"
        >
          <option value="day">Today</option>
          <option value="week">This week</option>
        </select>
      </div>
      {loading ? (
        <p className="leaderboard__loading">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="leaderboard__empty">No payouts in this window yet.</p>
      ) : (
        <ol className="leaderboard__list">
          {rows.map((r, i) => (
            <li key={r.address} className="leaderboard__row">
              <span className="leaderboard__rank">{i + 1}</span>
              <span className="leaderboard__addr" title={r.address}>
                {r.address.slice(0, 6)}…{r.address.slice(-4)}
              </span>
              <span className="leaderboard__amt">{r.earningsCusd.toFixed(4)} cUSD</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
