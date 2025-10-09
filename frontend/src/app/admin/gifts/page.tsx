"use client";

import React, { useEffect, useState } from 'react';
import api, { Gift } from '../../../../lib/api/gifts';

export default function GiftsAdmin() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(0);
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
      const data = await api.listGifts();
      setGifts(data);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name required');
    try {
      const created = await api.createGift({ name: name.trim(), description: description || null, quantity });
      setGifts((g) => [created, ...g]);
      setName(''); setDescription(''); setQuantity(0);
    } catch (e) {
      setError(toMsg(e));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this gift?')) return;
    try {
      await api.deleteGift(id);
      setGifts((g) => g.filter(x => x.id !== id));
    } catch (e) {
      setError(toMsg(e));
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Gifts</h1>
      <form onSubmit={handleCreate} className="grid grid-cols-4 gap-2 mb-4">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="p-2 border rounded col-span-2" />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description" className="p-2 border rounded" />
        <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} placeholder="Quantity" className="p-2 border rounded" />
        <div className="col-span-4 text-right">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded">Create</button>
        </div>
      </form>

      {error && <div className="mb-4 text-red-600">{error}</div>}

      {loading ? <div>Loading…</div> : (
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Name</th>
              <th className="p-2">Description</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Created</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {gifts.map(g => (
              <tr key={g.id} className="border-t">
                <td className="p-2">{g.id}</td>
                <td className="p-2">{g.name}</td>
                <td className="p-2">{g.description}</td>
                <td className="p-2">{g.quantity}</td>
                <td className="p-2">{g.created_at ? new Date(g.created_at).toLocaleString() : ''}</td>
                <td className="p-2"><button className="px-2 py-1 bg-red-500 text-white rounded" onClick={() => handleDelete(g.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
