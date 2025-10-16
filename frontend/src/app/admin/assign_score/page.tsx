"use client";

import React, { useCallback, useEffect, useState } from 'react';
import authFetch from '../../../lib/api/client';

type Team = { id: number; name: string };

export default function AssignScorePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [points, setPoints] = useState<Record<number, number>>({});
  const [gameName, setGameName] = useState('');
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<Array<{team_id:number,name:string,total_points:number}>>([]);
  const [error, setError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/teams');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTeams(data || []);
      // reset points map
      const map: Record<number, number> = {};
  (data || []).forEach((t: Team) => { map[t.id] = 0; });
      setPoints(map);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }, []);

  const loadTotals = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/team-scores/totals');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTotals(data || []);
    } catch {
      // ignore for now
    }
  }, []);

  useEffect(() => { loadTeams(); loadTotals(); }, [loadTeams, loadTotals]);

  function setPoint(teamId: number, value: number) {
    setPoints((p) => ({ ...p, [teamId]: value }));
  }

  async function saveScores() {
    if (!gameName.trim()) return setError('Game name required');
    const payload = {
      game_name: gameName.trim(),
      scores: Object.keys(points).map((k) => ({ team_id: Number(k), point: Number(points[Number(k)]) }))
    };
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/team-scores/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      setGameName('');
      // reload totals
      await loadTotals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Assign Scores (Admin)</h1>
      <div className="mb-4 max-w-xl">
        <label className="block text-sm mb-1">Game name</label>
        <input value={gameName} onChange={(e) => setGameName(e.target.value)} className="w-full p-2 border rounded" placeholder="e.g., Round 1" />
      </div>

      <div className="space-y-2 mb-4">
        {teams.map((t) => (
          <div key={t.id} className="flex items-center gap-3">
            <div className="w-48">{t.name}</div>
            <input type="number" value={points[t.id] ?? 0} onChange={(e) => setPoint(t.id, Number(e.target.value || 0))} className="w-28 p-2 border rounded" />
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button className="px-4 py-2 bg-emerald-600 text-white rounded" onClick={saveScores} disabled={loading}>Save</button>
        <button className="px-4 py-2 border rounded" onClick={loadTeams} disabled={loading}>Refresh teams</button>
      </div>

      {error && <div className="text-red-600 mb-2">{error}</div>}

      <h2 className="text-lg font-semibold mb-2">Team totals</h2>
      <div className="border rounded p-2 max-w-xl">
        <ul>
          {totals.map((t) => (
            <li key={t.team_id} className="flex justify-between py-1">
              <div>{t.name}</div>
              <div className="font-mono">{t.total_points}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
