"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type Winner = { name: string; gacha_code?: string | null; is_assigned?: string | null };
type Row = {
  gift_id: number;
  gift_name: string;
  category_name?: string | null;
  winners: Winner[];
};

type FetchError = { error?: string; message?: string } | string | unknown;

export default function WinnersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const toMsg = (e: FetchError) => {
    if (typeof e === "string") return e;
    if (!e || typeof e !== "object") return String(e);
    const obj = e as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.message === "string") return obj.message;
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/winners");
      if (!res.ok) throw await res.json();
      const data = (await res.json()) as Row[];
      setRows(data || []);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Derived
  const categories = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.category_name && s.add(r.category_name));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const catOk = category === "all" || (r.category_name || "") === category;
      if (!q) return catOk;
      const winnersHay = (r.winners || [])
        .map((w) => `${w.name}|${w.gacha_code || ""}|${w.is_assigned || "N"}`)
        .join("|")
        .toLowerCase();
      const hay = `${r.gift_name}|${
        r.category_name || ""
      }|${winnersHay}`.toLowerCase();
      return catOk && hay.includes(q);
    });
  }, [rows, query, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, category, pageSize]);

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  function exportCSV() {
    const headers = ["no", "gift", "category", "winner_name", "winner_code"];
    const lines: string[] = [headers.join(",")];
    filtered.forEach((r, idx) => {
      if (!r.winners || r.winners.length === 0) {
        lines.push(
          [idx + 1, esc(r.gift_name), esc(r.category_name || ""), "", ""].join(
            ","
          )
        );
      } else {
        r.winners.forEach((w, widx) => {
          const code = w.is_assigned === 'Y' ? '' : (w.gacha_code || '');
          lines.push(
            [
              idx + 1,
              esc(r.gift_name),
              esc(r.category_name || ""),
              esc(w.name),
              esc(code),
            ].join(",")
          );
        });
      }
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `winners_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function esc(v: string) {
    return v.includes(",") || v.includes("\n") || v.includes('"')
      ? '"' + v.replace(/"/g, '""') + '"'
      : v;
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
            <h1 className="text-sm sm:text-base font-semibold">Gift Winners</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 text-xs"
            >
              Export CSV
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Filters */}
        <section className="rounded-2xl p-4 bg-white/5 border border-white/10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 flex flex-wrap gap-3 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search gift, category, winner name/code"
              className="w-80 max-w-full p-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="p-2.5 rounded-xl bg-white/10 border border-white/20"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Rows / page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
              className="p-2.5 rounded-xl bg-white/10 border border-white/20"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-2xl p-4 bg-rose-900/40 border border-rose-400/40 text-rose-100">
            {error}
          </div>
        )}

        {/* Table */}
        <section className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/10 sticky top-0 z-10">
                <tr className="text-left">
                  <Th>No</Th>
                  <Th>Gift</Th>
                  <Th>Category</Th>
                  <Th>Winners</Th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(pageSize)].map((_, i) => (
                    <tr key={i} className="border-t border-white/10">
                      {[...Array(4)].map((__, j) => (
                        <td key={j} className="p-3">
                          <div className="h-4 w-24 sm:w-32 bg-white/10 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-slate-300" colSpan={4}>
                      No winners found.
                    </td>
                  </tr>
                ) : (
                  paged.map((r, idx) => (
                    <tr key={r.gift_id} className="border-t border-white/10">
                      <td className="p-3 whitespace-nowrap">
                        {(pageSafe - 1) * pageSize + idx + 1}
                      </td>
                      <td className="p-3 min-w-[16rem]">{r.gift_name}</td>
                      <td className="p-3 whitespace-nowrap">
                        {r.category_name || (
                          <span className="opacity-60">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {!r.winners || r.winners.length === 0 ? (
                          <span className="opacity-60">—</span>
                        ) : (
                          <ul className="flex flex-wrap gap-1.5">
                                            {r.winners.map((w, i) => (
                              <li
                                key={i}
                                className="inline-flex items-center gap-2 px-2 py-1 rounded-lg bg-white/10 border border-white/20"
                              >
                                <span className="text-[13px] font-medium">
                                  {w.name}
                                </span>
                                                {w.is_assigned !== 'Y' && w.gacha_code && (
                                                  <button
                                                    onClick={() => copy(w.gacha_code!)}
                                                    className="text-[11px] px-1.5 py-0.5 rounded bg-white/10 border border-white/20 hover:bg-white/15"
                                                    title="Copy code"
                                                  >
                                                    {w.gacha_code}
                                                  </button>
                                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 text-xs">
            <div className="opacity-80">
              Showing <strong>{paged.length}</strong> of{" "}
              <strong>{filtered.length}</strong> result
              {filtered.length !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1">
              <button
                className="px-2 py-1 rounded bg-white/10 border border-white/20 disabled:opacity-50"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe <= 1}
              >
                Prev
              </button>
              <span className="px-2">
                Page {pageSafe} / {totalPages}
              </span>
              <button
                className="px-2 py-1 rounded bg-white/10 border border-white/20 disabled:opacity-50"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-200/90">
      {children}
    </th>
  );
}
