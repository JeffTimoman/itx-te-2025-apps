"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = BACKEND ? `${BACKEND}/api/admin/login` : '/api/admin/login';
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json && json.error ? json.error : 'Login failed');
      router.replace('/admin/registrants');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 grid place-items-center">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-white/5 border border-white/10">
        <h1 className="text-lg font-semibold mb-4">Admin login</h1>
        {error && <div className="text-rose-300 mb-3">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs opacity-80 mb-1">Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20" />
          </div>
          <div>
            <label className="block text-xs opacity-80 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20" />
          </div>
          <div className="flex justify-end">
            <button disabled={loading} className="px-4 py-2 rounded-xl bg-indigo-500/90 hover:bg-indigo-500">{loading ? 'Signing in…' : 'Sign in'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
