"use client";

import React, { useEffect, useState } from 'react';

type Winner = { name: string; gacha_code?: string | null };
type Row = { gift_id: number; gift_name: string; category_name?: string | null; winners: Winner[] };

export default function WinnersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toMsg(e: unknown) {
    if (typeof e === 'string') return e;
    if (!e || typeof e !== 'object') return String(e);
    const obj = e as Record<string, unknown>;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.message === 'string') return obj.message;
    try { return JSON.stringify(obj); } catch { return String(obj); }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/winners');
        if (!res.ok) throw await res.json();
        const data = await res.json();
        setRows(data || []);
      } catch (e) {
        setError(toMsg(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Gift Winners</h1>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600 mb-4">{error}</div>}
      <table className="w-full table-auto border-collapse">
        <thead>
          <tr className="text-left">
            <th className="p-2">No</th>
            <th className="p-2">Gift</th>
            <th className="p-2">Category</th>
            <th className="p-2">Winners</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.gift_id} className="border-t">
              <td className="p-2">{idx + 1}</td>
              <td className="p-2">{r.gift_name}</td>
              <td className="p-2">{r.category_name || ''}</td>
              <td className="p-2 font-mono break-words">{(r.winners || []).map(w => `${w.name} | ${w.gacha_code || ''}`).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
