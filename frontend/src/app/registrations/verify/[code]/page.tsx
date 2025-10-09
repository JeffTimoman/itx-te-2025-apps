"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyPage({ params }: { params: { code: string } }) {
  const code = params.code;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_BASE || 'http://localhost:5000');
      const resp = await fetch(`${BACKEND}/api/registrations/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: email || null })
      });
      const data = await resp.json();
      if (!resp.ok) {
        setStatus(data && data.error ? data.error : `Server error ${resp.status}`);
      } else {
        setStatus('Verified! Thank you.');
        // optionally redirect after a moment
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
      <p className="mb-4">Please enter your email to verify your registration. This link is single-use and expires after 15 minutes.</p>
      <form onSubmit={handleSubmit} className="grid gap-3">
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (optional)" className="p-2 border rounded" />
        <div>
          <button disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded">{loading ? 'Verifying…' : 'Verify'}</button>
        </div>
      </form>
      {status && <div className="mt-4">{status}</div>}
    </div>
  );
}
