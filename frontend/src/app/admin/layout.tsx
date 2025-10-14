"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const url = BACKEND ? `${BACKEND}/api/admin/session` : '/api/admin/session';
        const token = typeof window !== 'undefined' ? localStorage.getItem('itx:admin:token') : null;
        const headers: Record<string,string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(url, { headers });
        if (!mounted) return;
        const json = await res.json();
        if (!json || !json.user) {
          router.replace('/admin/login');
          return;
        }
      } catch {
        router.replace('/admin/login');
        return;
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [router, BACKEND]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-200">Checking session…</div>
    );
  }

  return <>{children}</>;
}
