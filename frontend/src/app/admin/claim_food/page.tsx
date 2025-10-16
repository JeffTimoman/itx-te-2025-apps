"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import authFetch from "../../../lib/api/client";
import AdminHeader from "../../../components/AdminHeader";

// --- Types ---
export type Food = { id: number; name: string; created_at?: string };
export type Registrant = {
  id: number;
  name?: string;
  email?: string;
  gacha_code?: string;
  bureau?: string;
};

// --- Small fetch helpers (kept from your original) ---
async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await authFetch(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

// --- Sort types for registrants table ---
type SortKey = "id" | "name" | "email" | "code" | "bureau" | null;
type SortDir = "asc" | "desc";

/**
 * ClaimFoodAdminPage — revamped to match the RegistrantsAdminPage look & patterns
 */
export default function ClaimFoodAdminPage() {
  // Data
  const [foods, setFoods] = useState<Food[]>([]);
  const [selectedFoodId, setSelectedFoodId] = useState<number | null>(null);
  const [eligibleRegistrants, setEligibleRegistrants] = useState<Registrant[]>(
    []
  );

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create food
  const [newFoodName, setNewFoodName] = useState("");
  const [creating, setCreating] = useState(false);

  // Claiming state (per-row)
  const [claimingId, setClaimingId] = useState<number | null>(null);

  // Toolbar + header filters for registrants
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  const [idFilter, setIdFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [bureauFilter, setBureauFilter] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Foods sidebar filter
  const [foodQuery, setFoodQuery] = useState("");

  // --- Utils ---
  function toMessage(err: unknown) {
    if (!err) return String(err);
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  // --- Data loaders ---
  const loadFoods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Food[]>("/api/admin/foods");
      setFoods(data || []);
      if ((data || []).length > 0 && selectedFoodId == null) {
        setSelectedFoodId(data[0].id);
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [selectedFoodId]);

  const loadEligible = useCallback(async (foodId: number) => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiGet<Registrant[]>(
        `/api/admin/foods/${foodId}/eligible-registrants`
      );
      setEligibleRegistrants(list || []);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFoods();
  }, [loadFoods]);

  useEffect(() => {
    if (selectedFoodId != null) loadEligible(selectedFoodId);
    else setEligibleRegistrants([]);
  }, [selectedFoodId, loadEligible]);

  // --- Create Food ---
  async function createFood(e?: React.FormEvent) {
    e?.preventDefault();
    const name = newFoodName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const created = await apiPost<Food>("/api/admin/foods", { name });
      setFoods((cur) => [created, ...cur]);
      setNewFoodName("");
      setSelectedFoodId(created.id);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setCreating(false);
    }
  }

  // --- Claim Food ---
  async function claimFood(foodId: number, registrantId: number) {
    setClaimingId(registrantId);
    setError(null);
    try {
      await apiPost(`/api/admin/foods/${foodId}/claim`, {
        registrant_id: registrantId,
      });
      await loadEligible(foodId);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setClaimingId(null);
    }
  }

  // --- Derived data: registrants pipeline ---
  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return eligibleRegistrants;
    return eligibleRegistrants.filter((r) => {
      const hay = `${r.id}|${r.name || ""}|${r.email || ""}|${
        r.gacha_code || ""
      }|${r.bureau || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [eligibleRegistrants, query]);

  const filtered = useMemo(() => {
    const idf = idFilter.trim().toLowerCase();
    const nf = nameFilter.trim().toLowerCase();
    const ef = emailFilter.trim().toLowerCase();
    const cf = codeFilter.trim().toLowerCase();
    const bf = bureauFilter.trim().toLowerCase();

    return baseFiltered.filter((r) => {
      const idOk = !idf || String(r.id).toLowerCase().includes(idf);
      const nameOk = !nf || (r.name || "").toLowerCase().includes(nf);
      const emailOk = !ef || (r.email || "").toLowerCase().includes(ef);
      const codeOk = !cf || (r.gacha_code || "").toLowerCase().includes(cf);
      const bureauOk = !bf || (r.bureau || "").toLowerCase().includes(bf);
      return idOk && nameOk && emailOk && codeOk && bureauOk;
    });
  }, [
    baseFiltered,
    idFilter,
    nameFilter,
    emailFilter,
    codeFilter,
    bureauFilter,
  ]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const copy = [...filtered];
    const cmpStr = (a?: string | null, b?: string | null) => {
      const A = (a || "").toLowerCase();
      const B = (b || "").toLowerCase();
      return A < B ? -1 : A > B ? 1 : 0;
    };
    const cmpNum = (a?: number | null, b?: number | null) =>
      (a ?? 0) - (b ?? 0);

    copy.sort((a, b) => {
      let res = 0;
      if (sortKey === "id") res = cmpNum(a.id as any, b.id as any);
      else if (sortKey === "name") res = cmpStr(a.name || "", b.name || "");
      else if (sortKey === "email") res = cmpStr(a.email || "", b.email || "");
      else if (sortKey === "code")
        res = cmpStr(a.gacha_code || "", b.gacha_code || "");
      else if (sortKey === "bureau")
        res = cmpStr(a.bureau || "", b.bureau || "");
      return sortDir === "asc" ? res : -res;
    });

    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageSafe, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [
    query,
    pageSize,
    idFilter,
    nameFilter,
    emailFilter,
    codeFilter,
    bureauFilter,
    sortKey,
    sortDir,
  ]);

  // --- Foods filtered list ---
  const foodsFiltered = useMemo(() => {
    const q = foodQuery.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter((f) => `${f.id}|${f.name}`.toLowerCase().includes(q));
  }, [foods, foodQuery]);

  // --- CSV Export for current eligible list ---
  function exportEligibleCSV() {
    const headers = ["id", "name", "email", "gacha_code", "bureau"];
    const rows = sorted.map((r) => [
      r.id,
      escapeCSV(r.name || ""),
      r.email || "",
      r.gacha_code || "",
      r.bureau || "",
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eligible_${selectedFoodId ?? "none"}_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function escapeCSV(val: string) {
    if (val.includes(",") || val.includes("\n") || val.includes('"')) {
      return '"' + val.replace(/"/g, '""') + '"';
    }
    return val;
  }

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

  // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* Header */}
      <AdminHeader title="Food Claims">
        <button
          onClick={loadFoods}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        <button
          onClick={exportEligibleCSV}
          className="px-3 py-1.5 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 text-xs"
          disabled={eligibleRegistrants.length === 0}
        >
          Export Eligible CSV
        </button>
      </AdminHeader>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Create food card */}
        <section className="rounded-2xl p-6 bg-white/5 border border-white/10">
          <h2 className="text-lg font-bold">Create food</h2>
          <form
            onSubmit={createFood}
            className="mt-4 grid gap-3 sm:grid-cols-3"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="food-name"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Name
              </label>
              <input
                id="food-name"
                value={newFoodName}
                onChange={(e) => setNewFoodName(e.target.value)}
                placeholder="e.g., Bento A"
                className={`w-full p-3 rounded-xl bg-white/10 border ${
                  newFoodName.trim() ? "border-white/20" : "border-red-400/40"
                } outline-none focus:ring-2 focus:ring-indigo-400/60`}
              />
            </div>
            <div className="sm:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={creating}
                className="relative inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-slate-900 w-full"
              >
                {creating && (
                  <span className="absolute left-4 h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                )}
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
          {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
        </section>

        {/* Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Foods list card */}
          <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between gap-3">
              <h3 className="font-semibold">Foods</h3>
              <input
                value={foodQuery}
                onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="Search foods…"
                className="w-44 p-2 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              />
            </div>
            <div className="max-h-96 overflow-auto">
              {foodsFiltered.length === 0 ? (
                <div className="p-4 text-sm text-slate-300">No foods yet</div>
              ) : (
                <ul>
                  {foodsFiltered.map((f) => (
                    <li
                      key={f.id}
                      className={`p-3 border-t border-white/10 cursor-pointer hover:bg-white/5 ${
                        selectedFoodId === f.id ? "bg-white/10" : ""
                      }`}
                      onClick={() => setSelectedFoodId(f.id)}
                    >
                      <div className="font-semibold">{f.name}</div>
                      <div className="text-[11px] opacity-70">id: {f.id}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Eligible registrants card */}
          <div className="lg:col-span-2 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="flex-1 flex flex-wrap gap-3 items-center">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search (id, name, email, code, bureau)"
                  className="w-80 max-w-full p-2.5 pl-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                />
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
            </div>

            {/* Table */}
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/10 sticky top-0 z-10">
                  <tr className="text-left">
                    <Th
                      sortable
                      active={sortKey === "id"}
                      dir={sortDir}
                      ariaSort={
                        sortKey === "id"
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      onClick={() => toggleSort("id", true)}
                    >
                      ID
                    </Th>
                    <Th
                      sortable
                      active={sortKey === "name"}
                      dir={sortDir}
                      ariaSort={
                        sortKey === "name"
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      onClick={() => toggleSort("name", true)}
                    >
                      Name
                    </Th>
                    <Th
                      sortable
                      active={sortKey === "email"}
                      dir={sortDir}
                      ariaSort={
                        sortKey === "email"
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      onClick={() => toggleSort("email", true)}
                    >
                      Email
                    </Th>
                    <Th
                      sortable
                      active={sortKey === "code"}
                      dir={sortDir}
                      ariaSort={
                        sortKey === "code"
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      onClick={() => toggleSort("code", true)}
                    >
                      Code
                    </Th>
                    <Th
                      sortable
                      active={sortKey === "bureau"}
                      dir={sortDir}
                      ariaSort={
                        sortKey === "bureau"
                          ? sortDir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      onClick={() => toggleSort("bureau", true)}
                    >
                      Bureau
                    </Th>
                    <Th title="Actions">Actions</Th>
                  </tr>
                  {/* Header filter row */}
                  <tr className="text-left border-t border-white/10">
                    <th className="p-2">
                      <input
                        value={idFilter}
                        onChange={(e) => setIdFilter(e.target.value)}
                        placeholder="Filter ID…"
                        inputMode="numeric"
                        className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                      />
                    </th>
                    <th className="p-2">
                      <input
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        placeholder="Filter name…"
                        className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                      />
                    </th>
                    <th className="p-2">
                      <input
                        value={emailFilter}
                        onChange={(e) => setEmailFilter(e.target.value)}
                        placeholder="Filter email…"
                        className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                      />
                    </th>
                    <th className="p-2">
                      <input
                        value={codeFilter}
                        onChange={(e) => setCodeFilter(e.target.value)}
                        placeholder="Filter code…"
                        className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                      />
                    </th>
                    <th className="p-2">
                      <input
                        value={bureauFilter}
                        onChange={(e) => setBureauFilter(e.target.value)}
                        placeholder="Filter bureau…"
                        className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                      />
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(pageSize)].map((_, i) => (
                      <tr key={i} className="border-t border-white/10">
                        {[...Array(6)].map((__, j) => (
                          <td key={j} className="p-3">
                            <div className="h-4 w-24 sm:w-32 bg-white/10 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : paged.length === 0 ? (
                    <tr>
                      <td
                        className="p-6 text-center text-slate-300"
                        colSpan={6}
                      >
                        {selectedFoodId == null
                          ? "Select a food to view eligible registrants"
                          : "No eligible registrants"}
                      </td>
                    </tr>
                  ) : (
                    paged.map((r) => (
                      <tr
                        key={r.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="p-3 font-mono opacity-80 whitespace-nowrap">
                          {r.id}
                        </td>
                        <td className="p-3 min-w-[14rem]">
                          {r.name || <span className="opacity-60">—</span>}
                        </td>
                        <td className="p-3 min-w-[16rem]">
                          {r.email || <span className="opacity-60">—</span>}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {r.gacha_code || (
                            <span className="opacity-60">—</span>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {r.bureau || <span className="opacity-60">—</span>}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <button
                            onClick={() =>
                              claimFood(selectedFoodId as number, r.id)
                            }
                            disabled={claimingId === r.id}
                            className="relative text-[11px] px-2 py-1 rounded bg-emerald-500/80 hover:bg-emerald-500 border border-emerald-400/40 disabled:opacity-60"
                          >
                            {claimingId === r.id && (
                              <span className="absolute -left-5 h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                            )}
                            {claimingId === r.id ? "Claiming…" : "Claim"}
                          </button>
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
          </div>
        </section>

        {error && <div className="text-sm text-rose-300">{error}</div>}
      </main>
    </div>
  );
}

// --- Small UI bits ---
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
    <th className={base} aria-sort={ariaSort} title={title || "Click to sort"}>
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
