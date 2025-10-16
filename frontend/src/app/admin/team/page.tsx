"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import authFetch from "../../../lib/api/client";
import AdminHeader from "../../../components/AdminHeader";

// --- Types ---
type Team = { id: number; name: string; created_at?: string | null };

type SortKey = "id" | "name" | "created" | null;
type SortDir = "asc" | "desc";

type YN = "Y" | "N" | undefined | null; // (kept for parity if you add flags later)

/**
 * TeamsAdminPage — styled & architected like RegistrantsAdminPage
 */
export default function TeamsAdminPage() {
  // Data state
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<Team | null>(null);
  const [saving, setSaving] = useState(false);

  // Toolbar filters/paging (match template)
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Header filters
  const [idFilter, setIdFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [createdFilter, setCreatedFilter] = useState("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // --- Helpers ---
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

  // --- Data loading ---
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/teams");
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Team[];
      setTeams(data || []);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // --- Create ---
  async function createTeam(e?: React.FormEvent) {
    e?.preventDefault();
    const name = newName.trim();
    if (!name) return setError("Name is required");
    setCreating(true);
    setError(null);
    try {
      const res = await authFetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = (await res.json()) as Team;
      setTeams((t) => [created, ...t]);
      setNewName("");
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setCreating(false);
    }
  }

  // --- Edit ---
  async function saveEdit() {
    if (!editing) return;
    const name = (editing.name || "").trim();
    if (!name) return setError("Name is required");
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/teams/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as Team;
      setTeams((arr) => arr.map((x) => (x.id === updated.id ? updated : x)));
      setEditing(null);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // --- Delete ---
  async function deleteTeam(id: number) {
    if (!confirm("Delete this team?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/teams/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setTeams((arr) => arr.filter((x) => x.id !== id));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // --- Derived data (follow template pipeline) ---
  // 1) Toolbar/global search
  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) =>
      `${t.id}|${t.name}|${t.created_at || ""}`.toLowerCase().includes(q)
    );
  }, [teams, query]);

  // 2) Header filters (precise)
  const filtered = useMemo(() => {
    const idf = idFilter.trim().toLowerCase();
    const nf = nameFilter.trim().toLowerCase();
    const cf = createdFilter.trim().toLowerCase();

    return baseFiltered.filter((t) => {
      const idOk = !idf || String(t.id).toLowerCase().includes(idf);
      const nameOk = !nf || (t.name || "").toLowerCase().includes(nf);
      const createdOk =
        !cf ||
        String(t.created_at || "")
          .toLowerCase()
          .includes(cf);
      return idOk && nameOk && createdOk;
    });
  }, [baseFiltered, idFilter, nameFilter, createdFilter]);

  // 3) Sorting
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
      else if (sortKey === "created")
        res = cmpStr(a.created_at || "", b.created_at || "");
      return sortDir === "asc" ? res : -res;
    });

    return copy;
  }, [filtered, sortKey, sortDir]);

  // 4) Paging
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageSafe, pageSize]);

  // Reset to page 1 on filter/sort/page-size change
  useEffect(() => {
    setPage(1);
  }, [query, pageSize, idFilter, nameFilter, createdFilter, sortKey, sortDir]);

  // --- CSV Export ---
  function exportCSV() {
    const headers = ["id", "name", "created_at"];
    const rows = sorted.map((t) => [
      t.id,
      escapeCSV(t.name),
      t.created_at || "",
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teams_${new Date()
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
      <AdminHeader title="Teams">
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
        {/* Create card */}
        <section className="rounded-2xl p-6 bg-white/5 border border-white/10">
          <h2 className="text-lg font-bold">Create team</h2>
          <form
            onSubmit={createTeam}
            className="mt-4 grid gap-3 sm:grid-cols-3"
          >
            <div className="sm:col-span-2">
              <label
                htmlFor="t-name"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Name
              </label>
              <input
                id="t-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Engineering"
                className={`w-full p-3 rounded-xl bg-white/10 border ${
                  newName.trim() ? "border-white/20" : "border-red-400/40"
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

        {/* Toolbar */}
        <section className="rounded-2xl p-4 bg-white/5 border border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex-1 flex flex-wrap gap-3 items-center">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search (id, name, created)"
                className="w-72 max-w-full p-2.5 pl-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              />
            </div>
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

        {/* Table card */}
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
                      value={createdFilter}
                      onChange={(e) => setCreatedFilter(e.target.value)}
                      placeholder="Filter created…"
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
                      No teams found.
                    </td>
                  </tr>
                ) : (
                  paged.map((t) => (
                    <tr
                      key={t.id}
                      className="border-t border-white/10 hover:bg-white/5"
                    >
                      <td className="p-3 font-mono opacity-80 whitespace-nowrap">
                        {t.id}
                      </td>
                      <td className="p-3 min-w-[16rem]">{t.name}</td>
                      <td className="p-3 whitespace-nowrap">
                        {t.created_at ? (
                          new Date(t.created_at).toLocaleString()
                        ) : (
                          <span className="opacity-60">—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditing(t)}
                            className="text-[11px] px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/15"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteTeam(t.id)}
                            className="text-[11px] px-2 py-1 rounded bg-rose-500/80 hover:bg-rose-500 border border-rose-400/40"
                          >
                            Delete
                          </button>
                        </div>
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

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 text-slate-100 shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit team</h3>
              <button
                onClick={() => setEditing(null)}
                className="text-xs px-2 py-1 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15"
              >
                Close
              </button>
            </div>
            <div className="p-5 space-y-3">
              <label
                htmlFor="edit-name"
                className="block text-xs uppercase tracking-wider opacity-80"
              >
                Name
              </label>
              <input
                id="edit-name"
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              />
            </div>
            <div className="p-5 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="text-[11px] px-3 py-1.5 rounded bg-white/10 border border-white/20 hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="relative inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50"
              >
                {saving && (
                  <span className="absolute left-3 h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                )}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Small UI bits (copied pattern) ---
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
