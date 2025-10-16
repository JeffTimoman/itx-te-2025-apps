"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import authFetch from "../../../lib/api/client";
import AdminHeader from "../../../components/AdminHeader";

type Team = { id: number; name: string };

type Total = { team_id: number; name: string; total_points: number };

type SortKeyTotals = "name" | "points" | null;
type SortDir = "asc" | "desc";

export default function AssignScorePage() {
  // ---- Data ----
  const [teams, setTeams] = useState<Team[]>([]);
  const [points, setPoints] = useState<Record<number, number>>({});
  const [totals, setTotals] = useState<Total[]>([]);

  // ---- UI state ----
  const [gameName, setGameName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Totals view controls
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKeyTotals>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // ---- Helpers ----
  function toMessage(err: unknown) {
    if (!err) return String(err);
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  // ---- Loaders ----
  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/teams");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Team[];
      setTeams(data || []);
      // Reset points map to 0 for all teams
      const map: Record<number, number> = {};
      (data || []).forEach((t) => {
        map[t.id] = 0;
      });
      setPoints(map);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTotals = useCallback(async () => {
    try {
      const res = await authFetch("/api/admin/team-scores/totals");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Total[];
      setTotals(data || []);
    } catch (err) {
      // Totals are non-critical—surface softly
      console.warn("Failed to load totals:", err);
    }
  }, []);

  useEffect(() => {
    loadTeams();
    loadTotals();
  }, [loadTeams, loadTotals]);

  // ---- Mutations ----
  function setPoint(teamId: number, value: number) {
    setPoints((p) => ({ ...p, [teamId]: value }));
  }

  function resetAllPoints(val = 0) {
    setPoints((prev) => {
      const next: Record<number, number> = {};
      teams.forEach((t) => {
        next[t.id] = val;
      });
      return next;
    });
  }

  async function saveScores() {
    if (!gameName.trim()) return setError("Game name required");
    const payload = {
      game_name: gameName.trim(),
      scores: Object.keys(points).map((k) => ({
        team_id: Number(k),
        point: Number(points[Number(k)]),
      })),
    };
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/team-scores/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      setGameName("");
      resetAllPoints(0);
      await loadTotals();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ---- Totals derived data ----
  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return totals;
    return totals.filter((t) =>
      `${t.name}|${t.total_points}`.toLowerCase().includes(q)
    );
  }, [totals, query]);

  const sorted = useMemo(() => {
    if (!sortKey) return baseFiltered;
    const copy = [...baseFiltered];
    copy.sort((a, b) => {
      let res = 0;
      if (sortKey === "name") res = a.name.localeCompare(b.name);
      else if (sortKey === "points")
        res = (a.total_points ?? 0) - (b.total_points ?? 0);
      return sortDir === "asc" ? res : -res;
    });
    return copy;
  }, [baseFiltered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageSafe, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize, sortKey, sortDir]);

  function toggleSort(next: SortKeyTotals) {
    setSortKey((prev) => {
      if (prev !== next) {
        setSortDir("asc");
        return next;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  }

  // ---- UI ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* Header */}
      <AdminHeader title="Assign Scores">
        <button
          onClick={loadTeams}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh Teams"}
        </button>
        <button
          onClick={loadTotals}
          className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15"
        >
          Refresh Totals
        </button>
      </AdminHeader>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Assign scores card */}
        <section className="rounded-2xl p-6 bg-white/5 border border-white/10">
          <h2 className="text-lg font-bold">Record game scores</h2>

          {/* Game name */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="game-name"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Game name
              </label>
              <input
                id="game-name"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="e.g., Round 1 — Spelling Bee"
                className={`w-full p-3 rounded-xl bg-white/10 border ${
                  gameName.trim() ? "border-white/20" : "border-red-400/40"
                } outline-none focus:ring-2 focus:ring-indigo-400/60`}
              />
            </div>
            <div className="sm:col-span-1 flex items-end gap-2">
              <button
                onClick={saveScores}
                disabled={saving}
                className="relative inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 w-full"
              >
                {saving && (
                  <span className="absolute left-4 h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                )}
                {saving ? "Saving…" : "Save scores"}
              </button>
            </div>
          </div>

          {/* Inputs table */}
          <div className="mt-6 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-white/10">
              <div className="text-sm opacity-80">
                Enter points for each team
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => resetAllPoints(0)}
                  className="text-[11px] px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/15"
                >
                  Reset to 0
                </button>
                <button
                  onClick={loadTeams}
                  className="text-[11px] px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/15"
                >
                  Reload teams
                </button>
              </div>
            </div>

            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/10 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-200/90">
                      Team
                    </th>
                    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-200/90">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="border-t border-white/10">
                        <td className="p-3">
                          <div className="h-4 w-52 bg-white/10 rounded animate-pulse" />
                        </td>
                        <td className="p-3">
                          <div className="h-8 w-28 bg-white/10 rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : teams.length === 0 ? (
                    <tr>
                      <td
                        className="p-6 text-center text-slate-300"
                        colSpan={2}
                      >
                        No teams found.
                      </td>
                    </tr>
                  ) : (
                    teams.map((t) => (
                      <tr
                        key={t.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="p-3 min-w-[16rem]">{t.name}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            inputMode="numeric"
                            className="w-28 p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                            value={points[t.id] ?? 0}
                            onChange={(e) =>
                              setPoint(t.id, Number(e.target.value || 0))
                            }
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
        </section>

        {/* Totals card */}
        <section className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex-1 flex flex-wrap gap-3 items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teams…"
                className="w-80 max-w-full p-2.5 pl-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs opacity-70">Rows / page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="p-2.5 rounded-xl bg-white/10 border border-white/20"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Totals table */}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/10 sticky top-0 z-10">
                <tr className="text-left">
                  <Th
                    sortable
                    active={sortKey === "name"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "name"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("name")}
                  >
                    Team
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "points"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "points"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("points")}
                  >
                    Total Points
                  </Th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-slate-300" colSpan={2}>
                      No data
                    </td>
                  </tr>
                ) : (
                  paged.map((t) => (
                    <tr
                      key={t.team_id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="p-3 min-w-[16rem]">{t.name}</td>
                      <td className="p-3 font-mono">{t.total_points}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-xs">
            <div className="opacity-80">
              Showing <strong>{paged.length}</strong> of{" "}
              <strong>{sorted.length}</strong> result
              {sorted.length !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1">
              <button
                className="px-2 py-1 rounded bg-white/10 border border-white/20 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
              >
                Prev
              </button>
              <span className="px-2">
                Page {pageSafe} / {totalPages}
              </span>
              <button
                className="px-2 py-1 rounded bg-white/10 border border-white/20 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// --- Small UI bits ---
function Th({
  children,
  sortable,
  active,
  dir,
  onClick,
  ariaSort,
  title,
}: {
  children: React.ReactNode;
  sortable?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  ariaSort?: "none" | "ascending" | "descending";
  title?: string;
}) {
  const base =
    "p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-200/90";
  if (!sortable) {
    return (
      <th className={base + " opacity-70"} aria-sort={ariaSort} title={title}>
        {children}
      </th>
    );
  }
  return (
    <th className={base} aria-sort={ariaSort} title={title || "Click to sort"}>
      <button
        onClick={onClick}
        className={
          "inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-white/10 transition " +
          (active ? "bg-white/10" : "")
        }
      >
        <span>{children}</span>
        <span className="text-[10px] opacity-80">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
