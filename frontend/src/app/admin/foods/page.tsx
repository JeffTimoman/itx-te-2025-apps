"use client";

import React, { useCallback, useEffect, useState } from 'react';
import authFetch from '../../../lib/api/client';

type Food = { id: number; name: string; created_at?: string };

export default function FoodsPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<Food | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/foods');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setFoods(data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createFood(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/foods', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName.trim() }) });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setFoods((f) => [...f, created]);
      setNewName('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editing.name.trim()) return setError('Name required');
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/foods/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: editing.name.trim() }) });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setFoods((f) => f.map((x) => (x.id === updated.id ? updated : x)));
      setEditing(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  async function deleteFood(id: number) {
    if (!confirm('Delete this food?')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/foods/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      setFoods((f) => f.filter((x) => x.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Foods</h1>

      <form onSubmit={createFood} className="flex gap-2 mb-4">
        <input className="border p-2 flex-1" placeholder="New food name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit" disabled={loading}>Create</button>
        <button type="button" className="ml-2 px-3 py-2 border rounded" onClick={load} disabled={loading}>Refresh</button>
      </form>

      {error && <div className="text-red-600 mb-2">{error}</div>}

      <div className="border rounded p-2 max-h-80 overflow-auto">
        {foods.length === 0 && <div className="text-sm text-gray-500">No foods yet</div>}
        <ul>
          {foods.map((f) => (
            <li key={f.id} className="p-2 border-b flex items-center justify-between">
              <div>
                <div className="font-semibold">{f.name}</div>
                <div className="text-xs text-gray-500">id: {f.id}</div>
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 border rounded" onClick={() => setEditing(f)}>Edit</button>
                <button className="px-2 py-1 bg-rose-600 text-white rounded" onClick={() => deleteFood(f.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {editing && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="bg-white p-4 rounded max-w-lg w-full">
            <h3 className="text-lg font-semibold mb-2">Edit food</h3>
            <input className="w-full border p-2 mb-2" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 border rounded" onClick={() => setEditing(null)}>Cancel</button>
              <button className="px-3 py-1 bg-emerald-600 text-white rounded" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
