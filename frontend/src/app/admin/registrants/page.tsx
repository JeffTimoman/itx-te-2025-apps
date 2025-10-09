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

  // is_verified and is_win are read-only in the admin UI; they cannot be toggled manually.

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
                  <span className={`inline-block px-2 py-1 rounded ${r.is_verified === 'Y' ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-700'}`}>{r.is_verified === 'Y' ? 'Verified' : 'Unverified'}</span>
                </td>
                <td className="p-2">
                  <span className={`inline-block px-2 py-1 rounded ${r.is_win === 'Y' ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>{r.is_win === 'Y' ? 'Winner' : '—'}</span>
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
