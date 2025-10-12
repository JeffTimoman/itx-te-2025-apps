"use client";

import React, { useEffect, useState } from "react";
import AdminLogout from "./AdminLogout";
import Link from "next/link";

export default function AdminHeader({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [user, setUser] = useState<{ username?: string; name?: string; role?: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/session', { credentials: 'include' });
        const js = await res.json();
        if (!mounted) return;
        setUser(js && js.user ? js.user : null);
      } catch {
        if (mounted) setUser(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
            ITX
          </div>
          <h1 className="text-sm sm:text-base font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {children}
          {user ? (
            <>
              <div className="text-xs opacity-80">{user.name || user.username} <span className="ml-2 px-2 py-0.5 rounded bg-white/10 text-[11px]">{user.role}</span></div>
              <AdminLogout />
            </>
          ) : (
            <Link href="/admin/login" className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15">Login</Link>
          )}
        </div>
      </div>
    </header>
  );
}
