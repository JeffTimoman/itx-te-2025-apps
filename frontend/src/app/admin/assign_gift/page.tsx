"use client";

import React, { useEffect, useState } from 'react';

type Gift = { id: number; name: string; quantity: number; awarded: number };
type Registrant = { id: number; name: string; bureau?: string | null; gacha_code?: string | null };

export default function AssignGiftPage() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [selectedGift, setSelectedGift] = useState<number | null>(null);
  const [selectedRegistrant, setSelectedRegistrant] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const g = await fetch('/api/admin/gifts/available');
        if (g.ok) setGifts(await g.json());
        const r = await fetch('/api/admin/registrants');
        if (r.ok) setRegistrants(await r.json());
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null);
    if (!selectedGift) return setError('Select a gift');
    if (!selectedRegistrant) return setError('Select a registrant');
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gifts/${selectedGift}/assign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrant_id: selectedRegistrant })
      });
      const body = await res.json();
      if (!res.ok) throw body;
      setSuccess('Gift assigned');
      // refresh lists
      const g = await fetch('/api/admin/gifts/available'); if (g.ok) setGifts(await g.json());
      const r = await fetch('/api/admin/registrants'); if (r.ok) setRegistrants(await r.json());
      setSelectedRegistrant(null);
    } catch (e: any) {
      setError(e && e.error ? e.error : String(e));
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Assign Gift (Manual)</h1>
      <form onSubmit={handleAssign} className="grid grid-cols-1 gap-4">
        <div>
          <label className="block mb-2">Gift</label>
          <select value={selectedGift ?? ''} onChange={e => setSelectedGift(e.target.value ? Number(e.target.value) : null)} className="w-full p-2 border rounded">
            <option value="">-- Select a gift --</option>
            {gifts.map(g => (
              <option key={g.id} value={g.id}>{g.name} (awarded {g.awarded}/{g.quantity})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-2">Registrant</label>
          <select value={selectedRegistrant ?? ''} onChange={e => setSelectedRegistrant(e.target.value ? Number(e.target.value) : null)} className="w-full p-2 border rounded">
            <option value="">-- Select registrant --</option>
            {registrants.map(r => (
              <option key={r.id} value={r.id}>{r.name}{r.bureau ? ` — ${r.bureau}` : ''}{r.gacha_code ? ` (${r.gacha_code})` : ''}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button className="px-4 py-2 bg-emerald-600 text-white rounded" type="submit" disabled={loading}>Assign</button>
          <button type="button" className="px-4 py-2 bg-gray-200 rounded" onClick={() => { setSelectedGift(null); setSelectedRegistrant(null); setError(null); setSuccess(null); }}>Reset</button>
        </div>

        {error && <div className="text-red-600">{error}</div>}
        {success && <div className="text-green-600">{success}</div>}
        {loading && <div>Working…</div>}
      </form>
    </div>
  );
}
