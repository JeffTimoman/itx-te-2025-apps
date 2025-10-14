"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function AdminLogout() {
  const router = useRouter();
  async function logout() {
    try {
      const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
      const url = BACKEND ? `${BACKEND}/api/admin/logout` : '/api/admin/logout';
      const token = typeof window !== 'undefined' ? localStorage.getItem('itx:admin:token') : null;
      const headers: Record<string,string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(url, { method: 'POST', headers });
  try { localStorage.removeItem('itx:admin:token'); } catch {}
    } catch {}
    router.replace('/admin/login');
  }
  return (
    <button onClick={logout} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15">Logout</button>
  );
}
