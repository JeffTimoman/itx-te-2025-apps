"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type Gift = { id: number; name: string; quantity: number; awarded: number };
type Registrant = {
  id: number;
  name: string;
  bureau?: string | null;
  gacha_code?: string | null;
};

type FetchErr = unknown | { error?: string; message?: string } | string;

/**
 * AssignGiftPage — manual assignment console (polished)
 *
 * UX upgrades
 * - Two‑panel layout: Gift on the left, Registrant on the right
 * - Live search + bureau filter + rows/page for registrants
 * - Capacity guard (if awarded === quantity, disable assign)
 * - Sticky action bar, success/error banners, skeleton loaders
 * - Masked gacha codes (PPPPYYYY‑**********) with Copy
 */
export default function AssignGiftPage() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);

  const [selectedGift, setSelectedGift] = useState<number | null>(null);
  const [selectedRegistrant, setSelectedRegistrant] = useState<number | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Toolbar state
  const [q, setQ] = useState("");
  const [bureauFilter, setBureauFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const toMsg = (e: FetchErr) => {
    if (typeof e === "string") return e;
    if (!e || typeof e !== "object") return String(e);
    const o = e as Record<string, unknown>;
    return typeof o.error === "string"
      ? o.error
      : typeof o.message === "string"
      ? o.message
      : JSON.stringify(o);
  };

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const [g, r] = await Promise.all([
        fetch("/api/admin/gifts/available"),
        fetch("/api/admin/registrants"),
      ]);
      if (g.ok) setGifts(await g.json());
      if (r.ok) setRegistrants(await r.json());
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedGiftObj = useMemo(
    () => gifts.find((g) => g.id === selectedGift) || null,
    [gifts, selectedGift]
  );
  const giftFull = selectedGiftObj
    ? selectedGiftObj.awarded >= selectedGiftObj.quantity
    : false;

  // registrant helpers
  const bureaus = useMemo(() => {
    const s = new Set<string>();
    registrants.forEach((r) => r.bureau && s.add(r.bureau));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [registrants]);

  const filteredRegs = useMemo(() => {
    const query = q.trim().toLowerCase();
    return registrants.filter((r) => {
      const bOk = bureauFilter === "all" || r.bureau === bureauFilter;
      if (!query) return bOk;
      const hay = `${r.id}|${r.name}|${r.bureau || ""}|${
        r.gacha_code || ""
      }`.toLowerCase();
      return bOk && hay.includes(query);
    });
  }, [registrants, q, bureauFilter]);

  useEffect(() => {
    setPage(1);
  }, [q, bureauFilter, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredRegs.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedRegs = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filteredRegs.slice(start, start + pageSize);
  }, [filteredRegs, pageSafe, pageSize]);

  function maskedCode(code?: string | null) {
    if (!code) return "";
    const [pre] = code.split("-");
    return `${pre || ""}-**********`;
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!selectedGift) return setError("Select a gift");
    if (!selectedRegistrant) return setError("Select a registrant");
    if (giftFull) return setError("This gift has reached its capacity");

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/gifts/${selectedGift}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrant_id: selectedRegistrant }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body;

      setSuccess("Gift assigned ✔");
      // Refresh lists
      const g = await fetch("/api/admin/gifts/available");
      if (g.ok) setGifts(await g.json());
      const r = await fetch("/api/admin/registrants");
      if (r.ok) setRegistrants(await r.json());
      setSelectedRegistrant(null);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setSelectedGift(null);
    setSelectedRegistrant(null);
    setQ("");
    setBureauFilter("all");
    setError(null);
    setSuccess(null);
  }

  function copy(text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
              ITX
            </div>
            <h1 className="text-sm sm:text-base font-semibold">
              Assign Gift (Manual)
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={fetching}
              className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15 disabled:opacity-50"
            >
              {fetching ? "Refreshing…" : "Refresh"}
            </button>
            <button
              onClick={resetAll}
              className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-6 items-start">
        {/* Left: Gift */}
        <section className="rounded-2xl p-6 bg-white/5 border border-white/10 space-y-4">
          <h2 className="text-lg font-bold">1) Choose gift</h2>
          <select
            value={selectedGift ?? ""}
            onChange={(e) =>
              setSelectedGift(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
          >
            <option value="">— Select a gift —</option>
            {gifts.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} (awarded {g.awarded}/{g.quantity})
              </option>
            ))}
          </select>

          {/* Gift summary */}
          {selectedGiftObj && (
            <div className="rounded-xl p-3 bg-white/5 border border-white/10 text-sm">
              <div className="font-medium">{selectedGiftObj.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className={`px-2 py-1 rounded-lg border ${
                    giftFull
                      ? "bg-rose-500/20 border-rose-400/40 text-rose-100"
                      : "bg-emerald-500/20 border-emerald-400/40 text-emerald-100"
                  }`}
                >
                  {giftFull ? "Capacity reached" : "Assignable"}
                </span>
                <span className="opacity-80">
                  {selectedGiftObj.awarded} / {selectedGiftObj.quantity} awarded
                </span>
              </div>
            </div>
          )}

          <div className="text-xs opacity-80">
            Note: You can assign gifts manually regardless of random draws.
          </div>

          {error && <div className="text-sm text-rose-300">{error}</div>}
          {success && <div className="text-sm text-emerald-300">{success}</div>}
          {loading && <div className="text-xs opacity-80">Working…</div>}
        </section>

        {/* Right: Registrants */}
        <section className="rounded-2xl p-6 bg-white/5 border border-white/10 space-y-4">
          <h2 className="text-lg font-bold">2) Pick registrant</h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search (name, bureau, code, id)"
              className="w-80 max-w-full p-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
            />
            <select
              value={bureauFilter}
              onChange={(e) => setBureauFilter(e.target.value)}
              className="p-2.5 rounded-xl bg-white/10 border border-white/20"
            >
              <option value="all">All bureaus</option>
              {bureaus.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="opacity-70">Rows</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                className="p-1.5 rounded-lg bg-white/10 border border-white/20"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden border border-white/10">
            <div className="overflow-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="bg-white/10 sticky top-0 z-10">
                  <tr className="text-left">
                    <Th>ID</Th>
                    <Th>Name</Th>
                    <Th>Bureau</Th>
                    <Th>Gacha Code</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    [...Array(8)].map((_, i) => (
                      <tr key={i} className="border-t border-white/10">
                        {[...Array(5)].map((__, j) => (
                          <td key={j} className="p-3">
                            <div className="h-4 w-24 sm:w-32 bg-white/10 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : pagedRegs.length === 0 ? (
                    <tr>
                      <td
                        className="p-6 text-center text-slate-300"
                        colSpan={5}
                      >
                        No registrants found.
                      </td>
                    </tr>
                  ) : (
                    pagedRegs.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRegistrant(r.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedRegistrant(r.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={`border-t border-white/10 hover:bg-white/5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400/40 ${
                          selectedRegistrant === r.id ? "bg-indigo-500/10" : ""
                        }`}
                      >
                        <td className="p-3 font-mono opacity-80 whitespace-nowrap">
                          {r.id}
                        </td>
                        <td className="p-3 min-w-[14rem]">{r.name}</td>
                        <td className="p-3 whitespace-nowrap">
                          {r.bureau || <span className="opacity-60">—</span>}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <span className="font-mono">
                              {maskedCode(r.gacha_code)}
                            </span>
                            {r.gacha_code && (
                              <button
                                onClick={() => copy(r.gacha_code!)}
                                className="text-[11px] px-2 py-0.5 rounded bg-white/10 border border-white/20 hover:bg-white/15"
                              >
                                Copy
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedRegistrant(r.id)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 text-xs"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 text-xs">
              <div className="opacity-80">
                Page {pageSafe} / {totalPages} • {filteredRegs.length} total
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="px-2 py-1 rounded bg-white/10 border border-white/20 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageSafe <= 1}
                >
                  Prev
                </button>
                <button
                  className="px-2 py-1 rounded bg-white/10 border border-white/20 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageSafe >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <form
            onSubmit={handleAssign}
            className="sticky bottom-0 mt-3 flex items-center justify-end gap-2"
          >
            <button
              type="button"
              onClick={() => setSelectedRegistrant(null)}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20"
            >
              Clear Selection
            </button>
            <button
              type="submit"
              disabled={
                !selectedGift || !selectedRegistrant || loading || giftFull
              }
              className="px-4 py-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 font-semibold"
            >
              {loading ? "Assigning…" : "Assign gift"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-200/90">
      {children}
    </th>
  );
}
