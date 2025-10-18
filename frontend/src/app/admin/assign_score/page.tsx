"use client";

import React, { useCallback, useEffect, useState } from "react";
import authFetch from "../../../lib/api/client";
import AdminHeader from "../../../components/AdminHeader";

type Team = { id: number; name: string };

type Total = { team_id: number; name: string; total_points: number };

// (sorting/paging types removed — totals shown in sidebar only)

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

  // Totals view (shown in sidebar)
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    const next: Record<number, number> = {};
    teams.forEach((t) => {
      next[t.id] = val;
    });
    setPoints(next);
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

  // Totals displayed in sidebar; no derived sorting/paging in body.

  // ---- UI ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* Header */}
      <AdminHeader title="Assign Scores">
        <button
          onClick={() => setSidebarOpen((s) => !s)}
          className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15"
        >
          {sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        </button>
      </AdminHeader>

      {/* Sidebar overlay/panel */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-80 bg-slate-900/95 border-l border-white/10 p-4 text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Controls</h3>
              <button
                onClick={() => setSidebarOpen(false)}
                className="px-2 py-1 text-sm rounded bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={loadTeams}
                disabled={loading}
                className="w-full text-left px-3 py-2 rounded bg-white/10 border border-white/10"
              >
                {loading ? 'Refreshing teams…' : 'Refresh Teams'}
              </button>

              <button
                onClick={loadTotals}
                className="w-full text-left px-3 py-2 rounded bg-white/10 border border-white/10"
              >
                Refresh Totals
              </button>

              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Totals preview</h4>
                <div className="max-h-64 overflow-auto border rounded p-2 bg-white/5">
                  {totals.length === 0 ? (
                    <div className="text-sm text-slate-400">No totals yet</div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {totals.slice(0, 20).map((t) => (
                        <li key={t.team_id} className="flex justify-between">
                          <span>{t.name}</span>
                          <span className="font-mono">{t.total_points}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

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

          {/* Inputs cards */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm opacity-80">Enter points for each team</div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loading
                ? [...Array(6)].map((_, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
                  ))
                : teams.length === 0
                ? (
                  <div className="p-4 text-sm text-slate-300">No teams found.</div>
                )
                : teams.map((t) => (
                    <div key={t.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-xs text-slate-400">id: {t.id}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-white/10 rounded-lg overflow-hidden bg-white/5">
                          <button
                            aria-label={`Decrease points for ${t.name}`}
                            onClick={() => setPoint(t.id, Math.max(0, (points[t.id] ?? 0) - 1))}
                            className="px-2 py-1 text-sm bg-transparent hover:bg-white/6 disabled:opacity-50"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            className="w-20 p-2 bg-transparent border-0 outline-none text-center"
                            value={points[t.id] ?? 0}
                            onChange={(e) => setPoint(t.id, Math.max(0, Number(e.target.value || 0)))}
                          />
                          <button
                            aria-label={`Increase points for ${t.name}`}
                            onClick={() => setPoint(t.id, (points[t.id] ?? 0) + 1)}
                            className="px-2 py-1 text-sm bg-transparent hover:bg-white/6"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-sm opacity-80">points</div>
                      </div>
                    </div>
                  ))}
            </div>
          </div>

          {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
        </section>

        {/* Totals moved to sidebar — removed from body */}
      </main>
    </div>
  );
}

// no additional small UI bits required
