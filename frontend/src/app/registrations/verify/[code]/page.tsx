"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Registrant = { id: number; name: string; bureau?: string | null; gacha_code?: string | null };

export default function VerifyPage({ params }: { params: { code: string } }) {
  const code = params.code;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    // fetch unverified registrants
    (async () => {
      try {
        const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_BASE || '');
        const resp = await fetch(`${BACKEND}/api/registrants/unverified`);
        if (resp.ok) {
          const data = await resp.json();
          setRegistrants(data || []);
        }
      } catch {
        // ignore — page will still allow manual submission with id
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!selectedId) return setStatus('Please select your name');
    setLoading(true);
    try {
      const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_BASE || 'http://localhost:5000');
      const resp = await fetch(`${BACKEND}/api/registrations/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: email || null, registrant_id: selectedId })
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus(data && data.error ? data.error : `Server error ${resp.status}`);
      } else {
        setStatus('Verified! Thank you.');
        setTimeout(() => router.push('/'), 2500);
      }
    } catch {
      setStatus('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Verify Registration</h1>
      <p className="mb-4">Select your name from the list below and enter your email to activate your registration. This link is single-use and expires after 15 minutes.</p>

      <form onSubmit={handleSubmit} className="grid gap-3">
        <label className="block">Select your name</label>
        <select value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)} className="p-2 border rounded">
          <option value="">-- Select your name --</option>
          {registrants.map(r => (
            <option key={r.id} value={r.id}>{r.name}{r.bureau ? ` — ${r.bureau}` : ''}</option>
          ))}
        </select>

        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (required)" className="p-2 border rounded" />
        <div>
          <button disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded">{loading ? 'Verifying…' : 'Verify and Activate'}</button>
        </div>
      </form>
      {status && <div className="mt-4">{status}</div>}
    </div>
  );
}
