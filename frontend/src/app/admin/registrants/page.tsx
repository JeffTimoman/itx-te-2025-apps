"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import api, {
  Registrant,
  resendVerificationEmail,
} from "../../../lib/api/registrants";
import AdminHeader from "../../../components/AdminHeader";

type SortKey =
  | "id"
  | "name"
  | "gifts"
  | "code"
  | "email"
  | "sent"
  | "bureau"
  | "verified"
  | "win"
  | "created"
  | null;
type SortDir = "asc" | "desc";

/**
 * RegistrantsAdminPage — with header filters + sorting
 */
export default function RegistrantsAdminPage() {
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [bureau, setBureau] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Toolbar filters/paging
  const [query, setQuery] = useState("");
  const [bureauFilter, setBureauFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Header filters
  const [idFilter, setIdFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [giftsFilter, setGiftsFilter] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [bureauTextFilter, setBureauTextFilter] = useState("");
  const [sentFilter, setSentFilter] = useState<"all" | "yes" | "no">("all");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "yes" | "no">(
    "all"
  );
  const [winFilter, setWinFilter] = useState<"all" | "yes" | "no">("all");
  const [createdFilter, setCreatedFilter] = useState("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listRegistrants();
      setRegistrants(data);
    } catch (err) {
      setError(toMessage(err));
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
    if (!name.trim()) return setError("Name is required");
    try {
      setCreating(true);
      const created = await api.createRegistrant({
        name: name.trim(),
        email: email.trim() || null,
        bureau: bureau.trim() || null,
      });
      setRegistrants((r) => [created, ...r]);
      setName("");
      setEmail("");
      setBureau("");
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setCreating(false);
    }
  }

  // --- Derived data ---
  const bureaus = useMemo(() => {
    const set = new Set<string>();
    registrants.forEach((r) => r.bureau && set.add(r.bureau));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [registrants]);

  // Toolbar filter first (global query + bureau dropdown)
  const baseFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return registrants.filter((r) => {
      const bureauOk = bureauFilter === "all" || r.bureau === bureauFilter;
      if (!q) return bureauOk;
      const hay = `${r.id}|${r.name}|${r.email || ""}|${r.bureau || ""}|${
        r.gacha_code || ""
      }|${
        r.gifts && r.gifts.length ? r.gifts.map((g) => g.name).join("; ") : ""
      }`.toLowerCase();
      return bureauOk && hay.includes(q);
    });
  }, [registrants, query, bureauFilter]);

  // Header filters (precise)
  const filtered = useMemo(() => {
    const idf = idFilter.trim().toLowerCase();
    const nf = nameFilter.trim().toLowerCase();
    const gf = giftsFilter.trim().toLowerCase();
    const cf = codeFilter.trim().toLowerCase();
    const ef = emailFilter.trim().toLowerCase();
    const bf = bureauTextFilter.trim().toLowerCase();
    const crf = createdFilter.trim().toLowerCase();

    const ynOk = (val: string | undefined, f: "all" | "yes" | "no") => {
      if (f === "all") return true;
      const isYes = val === "Y";
      return f === "yes" ? isYes : !isYes;
    };

    return baseFiltered.filter((r) => {
      const idOk = !idf || String(r.id).toLowerCase().includes(idf);
      const nameOk = !nf || (r.name || "").toLowerCase().includes(nf);
      const giftsText =
        r.gifts && r.gifts.length ? r.gifts.map((g) => g.name).join("; ") : "";
      const giftsOk = !gf || giftsText.toLowerCase().includes(gf);
      const codeOk = !cf || (r.gacha_code || "").toLowerCase().includes(cf);
      const emailOk = !ef || (r.email || "").toLowerCase().includes(ef);
      const bureauOk = !bf || (r.bureau || "").toLowerCase().includes(bf);
      const createdOk =
        !crf ||
        String(r.created_at || "")
          .toLowerCase()
          .includes(crf);

      const sentOk = ynOk(r.is_send_email as any, sentFilter);
      const verifiedOk = ynOk(r.is_verified as any, verifiedFilter);
      const winOk = ynOk(r.is_win as any, winFilter);

      return (
        idOk &&
        nameOk &&
        giftsOk &&
        codeOk &&
        emailOk &&
        bureauOk &&
        createdOk &&
        sentOk &&
        verifiedOk &&
        winOk
      );
    });
  }, [
    baseFiltered,
    idFilter,
    nameFilter,
    giftsFilter,
    codeFilter,
    emailFilter,
    bureauTextFilter,
    createdFilter,
    sentFilter,
    verifiedFilter,
    winFilter,
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
    const cmpNum = (a?: number | null, b?: number | null) =>
      (a ?? 0) - (b ?? 0);
    const ynRank = (v?: string | null) => (v === "Y" ? 1 : 0); // N/undefined -> 0, Y -> 1

    copy.sort((a, b) => {
      let res = 0;
      if (sortKey === "id") res = cmpNum(a.id as any, b.id as any);
      else if (sortKey === "name") res = cmpStr(a.name, b.name);
      else if (sortKey === "gifts")
        res = (a.gifts?.length ?? 0) - (b.gifts?.length ?? 0);
      else if (sortKey === "code")
        res = cmpStr(a.gacha_code || "", b.gacha_code || "");
      else if (sortKey === "email") res = cmpStr(a.email || "", b.email || "");
      else if (sortKey === "sent")
        res = ynRank(a.is_send_email) - ynRank(b.is_send_email);
      else if (sortKey === "bureau")
        res = cmpStr(a.bureau || "~~~", b.bureau || "~~~"); // empties last
      else if (sortKey === "verified")
        res = ynRank(a.is_verified) - ynRank(b.is_verified);
      else if (sortKey === "win") res = ynRank(a.is_win) - ynRank(b.is_win);
      else if (sortKey === "created")
        res = cmpStr(a.created_at || "", b.created_at || "");
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

  // reset to page 1 on any filter/sort/page-size change
  useEffect(() => {
    setPage(1);
  }, [
    query,
    bureauFilter,
    pageSize,
    idFilter,
    nameFilter,
    giftsFilter,
    codeFilter,
    emailFilter,
    bureauTextFilter,
    createdFilter,
    sentFilter,
    verifiedFilter,
    winFilter,
    sortKey,
    sortDir,
  ]);

  function exportCSV() {
    const headers = [
      "id",
      "name",
      "gifts",
      "gacha_code",
      "email",
      "bureau",
      "is_send_email",
      "is_verified",
      "is_win",
      "created_at",
    ];
    const rows = sorted.map((r) => [
      r.id,
      escapeCSV(r.name || ""),
      escapeCSV(
        r.gifts && r.gifts.length ? r.gifts.map((g) => g.name).join("; ") : ""
      ),
      r.gacha_code || "",
      r.email || "",
      r.bureau || "",
      r.is_send_email || "",
      r.is_verified || "",
      r.is_win || "",
      r.created_at || "",
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join(
      "\n"
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrants_${new Date()
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

  function copy(text: string) {
    navigator.clipboard.writeText(text);
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
      <AdminHeader title="Registrants">
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
          <h2 className="text-lg font-bold">Create registrant</h2>
          <form
            onSubmit={handleCreate}
            className="mt-4 grid gap-3 sm:grid-cols-3"
          >
            <div className="sm:col-span-1">
              <label
                htmlFor="r-name"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Name
              </label>
              <input
                id="r-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Jefferson"
                className={`w-full p-3 rounded-xl bg-white/10 border ${
                  name.trim() ? "border-white/20" : "border-red-400/40"
                } outline-none focus:ring-2 focus:ring-indigo-400/60`}
              />
            </div>
            <div className="sm:col-span-1">
              <label
                htmlFor="r-email"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Email (optional)
              </label>
              <input
                id="r-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                inputMode="email"
              />
            </div>
            <div className="sm:col-span-1">
              <label
                htmlFor="r-bureau"
                className="block text-xs uppercase tracking-wider opacity-80 mb-1"
              >
                Bureau
              </label>
              <input
                id="r-bureau"
                value={bureau}
                onChange={(e) => setBureau(e.target.value)}
                placeholder="e.g., ITX-B"
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button
                className="relative inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-slate-900"
                disabled={creating}
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
                placeholder="Search (name, email, bureau, code)"
                className="w-72 max-w-full p-2.5 pl-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              />
            </div>
            <div>
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
                    active={sortKey === "gifts"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "gifts"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("gifts", true)}
                  >
                    Gifts
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
                    active={sortKey === "sent"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "sent"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("sent", true)}
                  >
                    Emailed
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
                  <Th
                    sortable
                    active={sortKey === "verified"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "verified"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("verified", true)}
                  >
                    Verified
                  </Th>
                  <Th
                    sortable
                    active={sortKey === "win"}
                    dir={sortDir}
                    ariaSort={
                      sortKey === "win"
                        ? sortDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    onClick={() => toggleSort("win", true)}
                  >
                    Win
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
                      value={giftsFilter}
                      onChange={(e) => setGiftsFilter(e.target.value)}
                      placeholder="Filter gifts…"
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
                      value={emailFilter}
                      onChange={(e) => setEmailFilter(e.target.value)}
                      placeholder="Filter email…"
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                    />
                  </th>
                  <th className="p-2">
                    <select
                      value={sentFilter}
                      onChange={(e) => setSentFilter(e.target.value as any)}
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20"
                      title="Emailed status"
                    >
                      <option value="all">All</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </th>
                  <th className="p-2">
                    <input
                      value={bureauTextFilter}
                      onChange={(e) => setBureauTextFilter(e.target.value)}
                      placeholder="Filter bureau…"
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                    />
                  </th>
                  <th className="p-2">
                    <select
                      value={verifiedFilter}
                      onChange={(e) => setVerifiedFilter(e.target.value as any)}
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20"
                      title="Verified status"
                    >
                      <option value="all">All</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </th>
                  <th className="p-2">
                    <select
                      value={winFilter}
                      onChange={(e) => setWinFilter(e.target.value as any)}
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20"
                      title="Win status"
                    >
                      <option value="all">All</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </th>
                  <th className="p-2">
                    <input
                      value={createdFilter}
                      onChange={(e) => setCreatedFilter(e.target.value)}
                      placeholder="Filter created…"
                      className="w-full p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                    />
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  [...Array(pageSize)].map((_, i) => (
                    <tr key={i} className="border-t border-white/10">
                      {[...Array(10)].map((__, j) => (
                        <td key={j} className="p-3">
                          <div className="h-4 w-24 sm:w-32 bg-white/10 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr>
                    <td className="p-6 text-center text-slate-300" colSpan={10}>
                      No registrants found.
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
                      <td className="p-3 min-w-[12rem]">{r.name}</td>
                      <td className="p-3 min-w-[12rem]">
                        {r.gifts && r.gifts.length ? (
                          r.gifts.map((g) => g.name).join(", ")
                        ) : (
                          <span className="opacity-60">—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <span className="font-mono">{r.gacha_code}</span>
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
                      <td className="p-3 min-w-[14rem]">
                        {r.email || <span className="opacity-60">—</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Chip
                            ok={r.is_send_email === "Y"}
                            okText="Sent"
                            noText="Not sent"
                          />
                          <ResendButton
                            id={r.id}
                            onSent={() => {
                              setRegistrants((arr) =>
                                arr.map((x) =>
                                  x.id === r.id
                                    ? { ...x, is_send_email: "Y" }
                                    : x
                                )
                              );
                            }}
                          />
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {r.bureau || <span className="opacity-60">—</span>}
                      </td>
                      <td className="p-3">
                        <Chip
                          ok={r.is_verified === "Y"}
                          okText="Verified"
                          noText="Unverified"
                          okClass="bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                        />
                      </td>
                      <td className="p-3">
                        <Chip
                          ok={r.is_win === "Y"}
                          okText="Winner"
                          noText="—"
                          okClass="bg-amber-400/30 text-amber-950 border-amber-400/50"
                        />
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {new Date(r.created_at || "").toLocaleString()}
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

function Chip({
  ok,
  okText,
  noText,
  okClass,
}: {
  ok: boolean;
  okText: string;
  noText: string;
  okClass?: string;
}) {
  const base = "inline-block px-2 py-1 rounded border text-[11px]";
  return (
    <span
      className={`${base} ${
        ok
          ? okClass ||
            "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
          : "bg-white/10 text-slate-200 border-white/20"
      }`}
    >
      {ok ? okText : noText}
    </span>
  );
}

function ResendButton({ id, onSent }: { id: number; onSent?: () => void }) {
  const [loading, setLoading] = React.useState(false);
  async function handle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await resendVerificationEmail(id);
      if (res && res.ok) {
        if (onSent) onSent();
      } else {
        alert("Failed to resend email");
      }
    } catch (err) {
      alert(
        "Failed to resend email: " +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={handle}
      disabled={loading}
      className="text-[11px] px-2 py-0.5 rounded bg-white/10 border border-white/20 hover:bg-white/15"
    >
      {loading ? "Sending…" : "Resend"}
    </button>
  );
}
