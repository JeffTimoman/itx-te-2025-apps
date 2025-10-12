"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/session', { credentials: 'include' });
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
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-200">Checking session…</div>
    );
  }

  return <>{children}</>;
}
