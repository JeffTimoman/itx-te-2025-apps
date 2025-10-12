"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function AdminLogout() {
  const router = useRouter();
  async function logout() {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    router.replace('/admin/login');
  }
  return (
    <button onClick={logout} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15">Logout</button>
  );
}
