"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminHeader from "../../../components/AdminHeader";

type Winner = {
  name: string;
  gacha_code?: string | null;
  is_assigned?: string | null;
};
type Row = {
  gift_id: number;
  gift_name: string;
  category_name?: string | null;
  winners: Winner[];
};
type FetchError = { error?: string; message?: string } | string | unknown;

type SortKey = "gift" | "category" | "winners" | null;
type SortDir = "asc" | "desc";

/**
 * WinnersPage — aligned with RegistrantsAdminPage UX
 *
 * - Toolbar: refresh, search, category filter, page size, CSV export
 * - Table: sticky header, header filter row, per-column sorting
 * - Sortable columns: Gift, Category, Winners (count)
 * - Non-sortable: No
 * - Filters in header row: Gift (text), Category (text), Winners (text + Assigned status)
 */
export default function WinnersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toolbar state
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Header filter state (per-column)
  const [giftFilter, setGiftFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [winnerFilter, setWinnerFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<
    "all" | "assigned" | "unassigned"
  >("all");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  // Combined filters (toolbar + header filters)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const gf = giftFilter.trim().toLowerCase();
    const cf = categoryFilter.trim().toLowerCase();
    const wf = winnerFilter.trim().toLowerCase();

    return rows.filter((r) => {
      // Toolbar category dropdown
      const catOkToolbar =
        category === "all" || (r.category_name || "") === category;

      // Toolbar free text
      const winnersHay = (r.winners || [])
        .map((w) => `${w.name}|${w.gacha_code || ""}|${w.is_assigned || "N"}`)
        .join("|")
        .toLowerCase();
      const hay = `${r.gift_name}|${
        r.category_name || ""
      }|${winnersHay}`.toLowerCase();
      const qOk = !q || hay.includes(q);

      // Header: gift & category text filters
      const gfOk = !gf || r.gift_name.toLowerCase().includes(gf);
      const cfOk = !cf || (r.category_name || "").toLowerCase().includes(cf);

      // Header: winners (text + assigned filter)
      const assignedOk = (w: Winner) =>
        assignedFilter === "all" ||
        (assignedFilter === "assigned"
          ? w.is_assigned === "Y"
          : w.is_assigned !== "Y");

      const anyWinnerMatch =
        r.winners && r.winners.length > 0
          ? r.winners.some((w) => {
              const text = `${w.name}|${w.gacha_code || ""}`.toLowerCase();
              return (!wf || text.includes(wf)) && assignedOk(w);
            })
          : // no winners: only pass if no specific winner text and not requiring "assigned"
            !wf && assignedFilter !== "assigned";

      return catOkToolbar && qOk && gfOk && cfOk && anyWinnerMatch;
    });
  }, [
    rows,
    query,
    category,
    giftFilter,
    categoryFilter,
    winnerFilter,
    assignedFilter,
  ]);

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];

    const cmpStr = (a?: string | null, b?: string | null) => {
      const A = (a || "").toLowerCase();
      const B = (b || "").toLowerCase();
      return A < B ? -1 : A > B ? 1 : 0;
    };

    copy.sort((a, b) => {
      let res = 0;
      if (sortKey === "gift") res = cmpStr(a.gift_name, b.gift_name);
      else if (sortKey === "category")
        res = cmpStr(
          a.category_name || "~~~",
          b.category_name || "~~~"
        ); // empties last
      else if (sortKey === "winners")
        res = (a.winners?.length ?? 0) - (b.winners?.length ?? 0);
      return sortDir === "asc" ? res : -res;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageSafe, pageSize]);

  // Reset page on filter/sort/page size change
  useEffect(() => {
    setPage(1);
  }, [
    query,
    category,
    giftFilter,
    categoryFilter,
    winnerFilter,
    assignedFilter,
    sortKey,
    sortDir,
    pageSize,
  ]);

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  function exportCSV() {
    const headers = ["no", "gift", "category", "winner_name", "winner_code"];
    const lines: string[] = [headers.join(",")];
    sorted.forEach((r, idx) => {
      if (!r.winners || r.winners.length === 0) {
        lines.push(
          [idx + 1, esc(r.gift_name), esc(r.category_name || ""), "", ""].join(
            ","
          )
        );
      } else {
        r.winners.forEach((w) => {
          const code = w.is_assigned === "Y" ? "" : w.gacha_code || "";
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

  // Sort toggler
  function toggleSort(next: SortKey, canSort: boolean) {
    if (!canSort) return;
    setSortKey((prev) => {
      if (prev !== next) {
        setSortDir("asc");
        return next;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      <AdminHeader title="Gift Winners">
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
      </AdminHeader>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Toolbar */}
        <section className="rounded-2xl p-4 bg-white/5 border border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex-1 flex flex-wrap gap-3 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search gift, category, winner name/code"
              className="w-72 max-w-full p-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
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
          <div className="flex gap-2 items-center">
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
                {/* Sortable header row */}
                <tr className="text-left">
                  <Th sortable={false} ariaSort="none" title="Not sortable">
                    No
                  </Th>

                  <Th
                    sortable
                    active={sortKey === "gift"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "gift"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("gift", true)}
                  >
                    Gift
                  </Th>

                  <Th
                    sortable
                    active={sortKey === "category"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "category"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("category", true)}
                  >
                    Category
                  </Th>

                  <Th
                    sortable
                    active={sortKey === "winners"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "winners"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("winners", true)}
                  >
                    Winners
                  </Th>
                </tr>

                {/* Header filter inputs (sticky) */}
                <tr className="text-left border-t border-white/10">
                  <th className="p-2 text-[11px] font-normal text-slate-300/80">
                    —
                  </th>
                  <th className="p-2">
                    <input
                      value={giftFilter}
                      onChange={(e) => setGiftFilter(e.target.value)}
                      placeholder="Filter gift…"
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                    />
                  </th>
                  <th className="p-2">
                    <input
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      placeholder="Filter category…"
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                    />
                  </th>
                  <th className="p-2">
                    <div className="flex gap-2">
                      <input
                        value={winnerFilter}
                        onChange={(e) => setWinnerFilter(e.target.value)}
                        placeholder="Filter winner name/code…"
                        className="flex-1 p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                      />
                      <select
                        value={assignedFilter}
                        onChange={(e) =>
                          setAssignedFilter(e.target.value as any)
                        }
                        className="p-2 rounded-lg bg-white/10 border border-white/20"
                        title="Assignment status"
                      >
                        <option value="all">All</option>
                        <option value="assigned">Assigned</option>
                        <option value="unassigned">Unassigned</option>
                      </select>
                    </div>
                  </th>
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
                    <tr
                      key={r.gift_id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
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
                                {w.is_assigned !== "Y" && w.gacha_code && (
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
              <strong>{sorted.length}</strong> result
              {sorted.length !== 1 ? "s" : ""}
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

function Th({
  children,
  sortable,
  active,
  dir,
  onClick,
  ariaSort,
  title,
}: {
  children: React.ReactNode;
  sortable?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  ariaSort?: "none" | "ascending" | "descending";
  title?: string;
}) {
  const base =
    "p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-200/90";
  if (!sortable) {
    return (
      <th className={base + " opacity-70"} aria-sort={ariaSort} title={title}>
        {children}
      </th>
    );
  }
  return (
    <th className={base} aria-sort={ariaSort} title="Click to sort">
      <button
        onClick={onClick}
        className={
          "inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-white/10 transition " +
          (active ? "bg-white/10" : "")
        }
      >
        <span>{children}</span>
        <span className="text-[10px] opacity-80">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
