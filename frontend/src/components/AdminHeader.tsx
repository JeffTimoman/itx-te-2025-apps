"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
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
    const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
    (async () => {
      try {
        const url = BACKEND ? `${BACKEND}/api/admin/session` : '/api/admin/session';
        const token = typeof window !== 'undefined' ? localStorage.getItem('itx:admin:token') : null;
        const headers: Record<string,string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(url, { headers });
        const js = await res.json();
        if (!mounted) return;
        setUser(js && js.user ? js.user : null);
      } catch {
        if (mounted) setUser(null);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const handleDocumentClick = useCallback((e: MouseEvent) => {
    if (!menuRef.current) return;
    if (!menuRef.current.contains(e.target as Node)) setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('mousedown', handleDocumentClick);
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, handleDocumentClick]);

  return (
    <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">ITX</div>
          <div className="relative" ref={menuRef}>
            <button
              aria-haspopup="true"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="text-sm sm:text-base font-semibold px-2 py-1 rounded hover:bg-white/5 flex items-center gap-2"
            >
              <span>{title}</span>
              <svg className="h-4 w-4 opacity-80" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
            </button>

            {open && (
              <div className="absolute left-0 mt-2 w-56 bg-white/5 border border-white/10 rounded shadow-lg py-1 z-40">
                <nav className="flex flex-col">
                  <Link href="/admin/registrants" onClick={() => setOpen(false)} className="px-3 py-2 text-sm hover:bg-white/10">Registrants</Link>
                  <Link href="/admin/gifts" onClick={() => setOpen(false)} className="px-3 py-2 text-sm hover:bg-white/10">Gifts</Link>
                  <Link href="/admin/gacha" onClick={() => setOpen(false)} className="px-3 py-2 text-sm hover:bg-white/10">Gacha</Link>
                  <Link href="/admin/assign_gift" onClick={() => setOpen(false)} className="px-3 py-2 text-sm hover:bg-white/10">Assign Gift</Link>
                  <Link href="/admin/game" onClick={() => setOpen(false)} className="px-3 py-2 text-sm hover:bg-white/10">Game</Link>
                  <Link href="/admin/generate" onClick={() => setOpen(false)} className="px-3 py-2 text-sm hover:bg-white/10">Generate (QR)</Link>
                  <Link href="/admin/winners" onClick={() => setOpen(false)} className="px-3 py-2 text-sm hover:bg-white/10">Winners</Link>
                </nav>
              </div>
            )}
          </div>
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
