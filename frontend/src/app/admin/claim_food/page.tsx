import React, { useCallback, useEffect, useState } from 'react';

type Food = { id: number; name: string; created_at?: string };
type Registrant = { id: number; name?: string; email?: string; gacha_code?: string; bureau?: string };

async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export default function ClaimFoodAdminPage() {
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [newFoodName, setNewFoodName] = useState('');
  const [selectedFoodId, setSelectedFoodId] = useState<number | null>(null);
  const [eligibleRegistrants, setEligibleRegistrants] = useState<Registrant[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadFoods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Food[]>('/api/admin/foods');
      setFoods(data || []);
      if ((data || []).length > 0 && selectedFoodId == null) setSelectedFoodId(data[0].id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedFoodId]);

  const loadEligible = useCallback(async (foodId: number) => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiGet<Registrant[]>(`/api/admin/foods/${foodId}/eligible-registrants`);
      setEligibleRegistrants(list || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  useEffect(() => {
    if (selectedFoodId != null) loadEligible(selectedFoodId);
    else setEligibleRegistrants([]);
  }, [selectedFoodId, loadEligible]);

  async function createFood(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newFoodName || newFoodName.trim().length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const created = await apiPost<Food>('/api/admin/foods', { name: newFoodName.trim() });
      setFoods((cur) => [...cur, created]);
      setNewFoodName('');
      setSelectedFoodId(created.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function claimFood(foodId: number, registrantId: number) {
    setLoading(true);
    setError(null);
    try {
      await apiPost(`/api/admin/foods/${foodId}/claim`, { registrant_id: registrantId });
      // refresh eligible list
      await loadEligible(foodId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Food Claims (Admin)</h1>
      <div className="mb-6">
        <form onSubmit={createFood} className="flex gap-2">
          <input className="border p-2 flex-1" placeholder="New food name" value={newFoodName} onChange={(e) => setNewFoodName(e.target.value)} />
          <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit" disabled={loading}>Create</button>
          <button type="button" className="ml-2 px-3 py-2 border rounded" onClick={() => loadFoods()} disabled={loading}>Refresh</button>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div>
          <h2 className="font-medium mb-2">Foods</h2>
          <div className="border rounded p-2 max-h-80 overflow-auto">
            {foods.length === 0 && <div className="text-sm text-gray-500">No foods yet</div>}
            <ul>
              {foods.map((f) => (
                <li key={f.id} className={`p-2 cursor-pointer ${selectedFoodId === f.id ? 'bg-gray-100' : ''}`} onClick={() => setSelectedFoodId(f.id)}>
                  <div className="font-semibold">{f.name}</div>
                  <div className="text-xs text-gray-500">id: {f.id}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="col-span-2">
          <h2 className="font-medium mb-2">Eligible Registrants</h2>
          <div className="border rounded p-2 max-h-80 overflow-auto">
            {selectedFoodId == null && <div className="text-sm text-gray-500">Select a food to view eligible registrants</div>}
            {selectedFoodId != null && eligibleRegistrants.length === 0 && <div className="text-sm text-gray-500">No eligible registrants</div>}
            <ul>
              {eligibleRegistrants.map((r) => (
                <li key={r.id} className="p-2 border-b flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{r.name || r.email || `#${r.id}`}</div>
                    <div className="text-xs text-gray-500">code: {r.gacha_code} · bureau: {r.bureau}</div>
                  </div>
                  <div>
                    <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={() => claimFood(selectedFoodId as number, r.id)} disabled={loading}>Claim</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  );
}
