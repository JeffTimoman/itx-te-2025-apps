"use client";

import React, { useEffect, useState, useCallback } from 'react';
import api, { Registrant } from '../../../lib/api/registrants';

export default function RegistrantsAdminPage() {
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bureau, setBureau] = useState('');
  const [error, setError] = useState<string | null>(null);

  function toMessage(err: unknown) {
    if (!err) return String(err);
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;
    try { return JSON.stringify(err); } catch { return String(err); }
  }

  const load = useCallback(async function load() {
    setLoading(true);
    try {
      const data = await api.listRegistrants();
      setRegistrants(data);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Name is required');
    try {
      const created = await api.createRegistrant({ name: name.trim(), email: email || null, bureau: bureau || null });
      setRegistrants((r) => [created, ...r]);
      setName(''); setEmail(''); setBureau('');
    } catch (err) {
      setError(toMessage(err));
    }
  }

  async function toggleVerified(id: number, current: string | undefined) {
    try {
      const updated = await api.updateRegistrant(id, { is_verified: current === 'Y' ? 'N' : 'Y' });
      setRegistrants((r) => r.map(x => x.id === id ? updated : x));
    } catch (err) {
      setError(toMessage(err));
    }
  }

  async function toggleWin(id: number, current: string | undefined) {
    try {
      const updated = await api.updateRegistrant(id, { is_win: current === 'Y' ? 'N' : 'Y' });
      setRegistrants((r) => r.map(x => x.id === id ? updated : x));
    } catch (err) {
      setError(toMessage(err));
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Registrants</h1>
      <form onSubmit={handleCreate} className="grid grid-cols-3 gap-3 mb-4">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" className="p-2 border rounded" />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" className="p-2 border rounded" />
        <input value={bureau} onChange={e => setBureau(e.target.value)} placeholder="Bureau" className="p-2 border rounded" />
        <div className="col-span-3 text-right">
          <button className="px-4 py-2 bg-indigo-600 text-white rounded">Create</button>
        </div>
      </form>

      {error && <div className="mb-4 text-red-500">{error}</div>}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Name</th>
              <th className="p-2">Code</th>
              <th className="p-2">Email</th>
              <th className="p-2">Bureau</th>
              <th className="p-2">Verified</th>
              <th className="p-2">Win</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {registrants.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.id}</td>
                <td className="p-2">{r.name}</td>
                <td className="p-2 font-mono">{r.gacha_code}</td>
                <td className="p-2">{r.email}</td>
                <td className="p-2">{r.bureau}</td>
                <td className="p-2">
                  <button onClick={() => toggleVerified(r.id, r.is_verified)} className="px-2 py-1 bg-yellow-400 rounded">{r.is_verified === 'Y' ? 'Yes' : 'No'}</button>
                </td>
                <td className="p-2">
                  <button onClick={() => toggleWin(r.id, r.is_win)} className="px-2 py-1 bg-emerald-400 rounded">{r.is_win === 'Y' ? 'Yes' : 'No'}</button>
                </td>
                <td className="p-2">{new Date(r.created_at || '').toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
