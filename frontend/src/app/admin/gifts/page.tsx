"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import api, { Gift } from "../../../lib/api/gifts";
import AdminHeader from "../../../components/AdminHeader";

type SortKey = "id" | "name" | "category" | "qty" | "created" | null;
type SortDir = "asc" | "desc";

/**
 * GiftsAdmin — gifts dashboard with header filters + sorting
 */
export default function GiftsAdmin() {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    []
  );

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [categoryId, setCategoryId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Toolbar / paging
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Header filters
  const [nameFilter, setNameFilter] = useState("");
  const [catTextFilter, setCatTextFilter] = useState("");
  const [qtyMin, setQtyMin] = useState<string>("");
  const [qtyMax, setQtyMax] = useState<string>("");
  const [createdFilter, setCreatedFilter] = useState("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toMsg(e: unknown) {
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
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, cats] = await Promise.all([
        api.listGifts(),
        api.listGiftCategories(),
      ]);
      setGifts(data || []);
      setCategories(cats || []);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name required");
    if (quantity < 0) return setError("Quantity cannot be negative");
    try {
      setCreating(true);
      const created = await api.createGift({
        name: name.trim(),
        description: description.trim() || null,
        quantity,
        gift_category_id: categoryId,
      });
      setGifts((g) => [created, ...g]);
      setName("");
      setDescription("");
      setQuantity(0);
      setCategoryId(null);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("Delete this gift?");
    if (!ok) return;
    try {
      setDeletingId(id);
      await api.deleteGift(id);
      setGifts((g) => g.filter((x) => x.id !== id));
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setDeletingId(null);
    }
  }

  // Helpers / derived
  const categoryName = (id?: number | null) =>
    id ? categories.find((c) => c.id === id)?.name || String(id) : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nf = nameFilter.trim().toLowerCase();
    const ctf = catTextFilter.trim().toLowerCase();
    const cf = createdFilter.trim().toLowerCase();
    const min =
      qtyMin.trim() === "" ? Number.NEGATIVE_INFINITY : Number(qtyMin);
    const max =
      qtyMax.trim() === "" ? Number.POSITIVE_INFINITY : Number(qtyMax);

    return gifts.filter((g) => {
      const catName = categoryName(g.gift_category_id);
      // Toolbar category dropdown
      const catOkDrop = catFilter === "all" || catName === catFilter;

      // Toolbar free search
      const hay = `${g.id}|${g.name}|${g.description || ""}|${catName}|${
        g.quantity
      }|${g.created_at || ""}`.toLowerCase();
      const qOk = !q || hay.includes(q);

      // Header filters
      const nameOk = !nf || g.name.toLowerCase().includes(nf);
      const catTextOk = !ctf || catName.toLowerCase().includes(ctf);
      const qtyOk = (g.quantity ?? 0) >= min && (g.quantity ?? 0) <= max;
      const createdOk =
        !cf ||
        String(g.created_at || "")
          .toLowerCase()
          .includes(cf);

      return catOkDrop && qOk && nameOk && catTextOk && qtyOk && createdOk;
    });
  }, [
    gifts,
    query,
    catFilter,
    nameFilter,
    catTextFilter,
    qtyMin,
    qtyMax,
    createdFilter,
    categories,
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
      else if (sortKey === "name") res = cmpStr(a.name, b.name);
      else if (sortKey === "category")
        res = cmpStr(
          categoryName(a.gift_category_id),
          categoryName(b.gift_category_id)
        );
      else if (sortKey === "qty") res = cmpNum(a.quantity, b.quantity);
      else if (sortKey === "created")
        res = cmpStr(a.created_at || "", b.created_at || "");
      return sortDir === "asc" ? res : -res;
    });

    return copy;
  }, [filtered, sortKey, sortDir, categories]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageSafe, pageSize]);

  // Reset page whenever filters/sort/pageSize change
  useEffect(() => {
    setPage(1);
  }, [
    query,
    catFilter,
    nameFilter,
    catTextFilter,
    qtyMin,
    qtyMax,
    createdFilter,
    sortKey,
    sortDir,
    pageSize,
  ]);

  function exportCSV() {
    const headers = [
      "id",
      "name",
      "description",
      "category",
      "quantity",
      "created_at",
    ];
    const lines = [headers.join(",")];
    sorted.forEach((g) => {
      lines.push(
        [
          g.id,
          esc(g.name),
          esc(g.description || ""),
          esc(categoryName(g.gift_category_id)),
          g.quantity,
          g.created_at || "",
        ].join(",")
      );
    });
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gifts_${new Date()
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
      {/* Header */}
      <AdminHeader title="Gifts">
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

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Create */}
        <section className="rounded-2xl p-6 bg-white/5 border border-white/10">
          <h2 className="text-lg font-bold">Create gift</h2>
          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-3 sm:grid-cols-4"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="g-name"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Name
              </label>
              <input
                id="g-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Hoodie"
                className={`w-full p-3 rounded-xl bg-white/10 border ${
                  name.trim() ? "border-white/20" : "border-red-400/40"
                } outline-none focus:ring-2 focus:ring-indigo-400/60`}
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="g-desc"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Description
              </label>
              <input
                id="g-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details"
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              />
            </div>
            <div>
              <label
                htmlFor="g-cat"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Category
              </label>
              <select
                id="g-cat"
                value={categoryId ?? ""}
                onChange={(e) =>
                  setCategoryId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              >
                <option value="">— Select —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="g-qty"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Quantity
              </label>
              <input
                id="g-qty"
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                placeholder="0"
                className={`w-full p-3 rounded-xl bg-white/10 border ${
                  quantity >= 0 ? "border-white/20" : "border-red-400/40"
                } outline-none focus:ring-2 focus:ring-indigo-400/60`}
              />
            </div>
            <div className="sm:col-span-4 flex justify-end">
              <button
                disabled={creating}
                className="relative inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-slate-900"
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

        {/* Toolbar */}
        <section className="rounded-2xl p-4 bg-white/5 border border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex-1 flex flex-wrap gap-3 items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name/description/category"
              className="w-80 max-w-full p-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
            />
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="p-2.5 rounded-xl bg-white/10 border border-white/20"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
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

        {/* Table */}
        <section className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/10 sticky top-0 z-10">
                {/* Sortable header row */}
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
                  <Th sortable={false} ariaSort="none" title="Not sortable">
                    Description
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
                    active={sortKey === "qty"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "qty"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("qty", true)}
                  >
                    Qty
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "created"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "created"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("created", true)}
                  >
                    Created
                  </Th>
                  <Th sortable={false} ariaSort="none" title="Not sortable">
                    Actions
                  </Th>
                </tr>

                {/* Header filter row */}
                <tr className="text-left border-t border-white/10">
                  <th className="p-2 text-[11px] font-normal text-slate-300/80">
                    —
                  </th>
                  <th className="p-2">
                    <input
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      placeholder="Filter name…"
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                    />
                  </th>
                  <th className="p-2 text-slate-300/70 text-[11px]">—</th>
                  <th className="p-2">
                    <input
                      value={catTextFilter}
                      onChange={(e) => setCatTextFilter(e.target.value)}
                      placeholder="Filter category…"
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                    />
                  </th>
                  <th className="p-2">
                    <div className="flex items-center gap-2">
                      <input
                        value={qtyMin}
                        onChange={(e) => setQtyMin(e.target.value)}
                        placeholder="Min"
                        inputMode="numeric"
                        className="w-20 p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                      />
                      <input
                        value={qtyMax}
                        onChange={(e) => setQtyMax(e.target.value)}
                        placeholder="Max"
                        inputMode="numeric"
                        className="w-20 p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                      />
                    </div>
                  </th>
                  <th className="p-2">
                    <input
                      value={createdFilter}
                      onChange={(e) => setCreatedFilter(e.target.value)}
                      placeholder="Filter created…"
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                    />
                  </th>
                  <th className="p-2 text-slate-300/70 text-[11px]">—</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  [...Array(pageSize)].map((_, i) => (
                    <tr key={i} className="border-t border-white/10">
                      {[...Array(7)].map((__, j) => (
                        <td key={j} className="p-3">
                          <div className="h-4 w-24 sm:w-32 bg-white/10 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-slate-300" colSpan={7}>
                      No gifts found.
                    </td>
                  </tr>
                ) : (
                  paged.map((g) => (
                    <tr
                      key={g.id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="p-3 font-mono opacity-80 whitespace-nowrap">
                        {g.id}
                      </td>
                      <td className="p-3 min-w-[12rem]">{g.name}</td>
                      <td className="p-3 min-w-[14rem]">
                        {g.description || <span className="opacity-60">—</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {categoryName(g.gift_category_id) || (
                          <span className="opacity-60">—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">{g.quantity}</td>
                      <td className="p-3 whitespace-nowrap">
                        {g.created_at ? (
                          new Date(g.created_at).toLocaleString()
                        ) : (
                          <span className="opacity-60">—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <button
                          className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-50"
                          onClick={() => handleDelete(g.id)}
                          disabled={deletingId === g.id}
                        >
                          {deletingId === g.id ? "Deleting…" : "Delete"}
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
