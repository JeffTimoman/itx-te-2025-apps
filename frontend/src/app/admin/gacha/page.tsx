"use client";

import React, { useEffect, useState } from 'react';

type GiftAvail = { id: number; name: string; description?: string | null; quantity: number; awarded: number; gift_category_id?: number | null };
type PreviewWinner = { id: number; name: string; gacha_code?: string | null };

export default function GachaPage() {
  const [gifts, setGifts] = useState<GiftAvail[]>([]);
  const [selectedGift, setSelectedGift] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewWinner | null>(null);
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

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gifts/available');
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setGifts(data || []);
    } catch (e) {
      setError(toMsg(e));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function pickRandom() {
    if (!selectedGift) return setError('Select a gift first');
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/gifts/${selectedGift}/random-winner`, { method: 'POST' });
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setPreview(data);
    } catch (e) {
      setError(toMsg(e));
    } finally { setLoading(false); }
  }

  async function saveWinner() {
    if (!selectedGift || !preview) return setError('No preview available');
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/gifts/${selectedGift}/save-winner`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrant_id: preview.id }) });
      if (!res.ok) throw await res.json();
      await load();
      setPreview(null);
      alert('Winner saved');
    } catch (e) {
      setError(toMsg(e));
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Gacha (Award Gifts)</h1>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600 mb-4">{error}</div>}

      <div className="mb-4">
        <label className="block mb-2">Select a gift</label>
        <select value={selectedGift ?? ''} onChange={e => setSelectedGift(e.target.value ? Number(e.target.value) : null)} className="p-2 border rounded w-full">
          <option value="">-- Select gift --</option>
          {gifts.map(g => (
            <option key={g.id} value={g.id}>{g.name} (awarded {g.awarded}/{g.quantity})</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => pickRandom()} className="px-4 py-2 bg-indigo-600 text-white rounded">Get Winner</button>
        <button onClick={() => { setPreview(null); pickRandom(); }} className="px-4 py-2 bg-gray-200 rounded">Refresh Winner</button>
        <button onClick={() => saveWinner()} disabled={!preview} className="px-4 py-2 bg-green-600 text-white rounded">Save Winner</button>
      </div>

      {preview && (
        <div className="p-4 border rounded">
          <div><strong>Preview Winner:</strong></div>
          <div className="mt-2">Name: {preview.name}</div>
          <div>Gacha Code: <span className="font-mono">{preview.gacha_code}</span></div>
        </div>
      )}
    </div>
  );
}
