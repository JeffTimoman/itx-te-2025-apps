"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Gift = { id: number; name: string; quantity: number; awarded: number };
type Registrant = {
  id: number;
  name: string;
  bureau?: string | null;
  gacha_code?: string | null;
};

type FetchErr = unknown | { error?: string; message?: string } | string;

type SortKey = "id" | "name" | "bureau" | "code" | null;
type SortDir = "asc" | "desc";

import authFetch from "../../../lib/api/client";

import AdminHeader from "../../../components/AdminHeader";

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

  // Header filters (per-column)
  const [idFilter, setIdFilter] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [bureauTextFilter, setBureauTextFilter] = useState("");
  const [codeFilter, setCodeFilter] = useState("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcut: Ctrl/Cmd + K to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          authFetch("/api/admin/gifts/available"),
          authFetch("/api/admin/registrants"),
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

  // 1) Toolbar filters first (category + global search)
  const baseFiltered = useMemo(() => {
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

  // 2) Header row filters (per column)
  const headerFiltered = useMemo(() => {
    const idf = idFilter.trim().toLowerCase();
    const nf = nameFilter.trim().toLowerCase();
    const bf = bureauTextFilter.trim().toLowerCase();
    const cf = codeFilter.trim().toLowerCase();

    return baseFiltered.filter((r) => {
      const idOk = !idf || String(r.id).toLowerCase().includes(idf);
      const nameOk = !nf || r.name.toLowerCase().includes(nf);
      const bureauOk = !bf || (r.bureau || "").toLowerCase().includes(bf);

      // match against raw and masked code (so user can type what they see)
      const rawCode = (r.gacha_code || "").toLowerCase();
      const masked = maskedCode(r.gacha_code).toLowerCase();
      const codeOk = !cf || rawCode.includes(cf) || masked.includes(cf);

      return idOk && nameOk && bureauOk && codeOk;
    });
  }, [baseFiltered, idFilter, nameFilter, bureauTextFilter, codeFilter]);

  // 3) Sorting
  const sortedRegs = useMemo(() => {
    if (!sortKey) return headerFiltered;
    const copy = [...headerFiltered];

    const cmpStr = (a?: string | null, b?: string | null) => {
      const A = (a || "").toLowerCase();
      const B = (b || "").toLowerCase();
      if (A < B) return -1;
      if (A > B) return 1;
      return 0;
    };
    const cmpNum = (a?: number | null, b?: number | null) =>
      (a ?? 0) - (b ?? 0);

    copy.sort((a, b) => {
      let res = 0;
      if (sortKey === "id") res = cmpNum(a.id, b.id);
      else if (sortKey === "name") res = cmpStr(a.name, b.name);
      else if (sortKey === "bureau")
        res = cmpStr(a.bureau || "~~~", b.bureau || "~~~"); // empties last
      else if (sortKey === "code")
        res = cmpStr(a.gacha_code || "", b.gacha_code || "");
      return sortDir === "asc" ? res : -res;
    });

    return copy;
  }, [headerFiltered, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedRegs.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pagedRegs = useMemo(() => {
    const start = (pageSafe - 1) * pageSize;
    return sortedRegs.slice(start, start + pageSize);
  }, [sortedRegs, pageSafe, pageSize]);

  // Reset page on any filtering/sorting/page size change
  useEffect(() => {
    setPage(1);
  }, [
    q,
    bureauFilter,
    pageSize,
    idFilter,
    nameFilter,
    bureauTextFilter,
    codeFilter,
    sortKey,
    sortDir,
  ]);

  function maskedCode(code?: string | null) {
    if (!code) return "";
    const [pre] = code.split("-");
    return `${pre || ""}-**********`;
    // SUFFIX_LEN=10 assumed
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
      const res = await authFetch(`/api/admin/gifts/${selectedGift}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrant_id: selectedRegistrant }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw body;

      setSuccess("Gift assigned ✔");
  // refresh
  const g = await authFetch("/api/admin/gifts/available");
  if (g.ok) setGifts(await g.json());
  const r = await authFetch("/api/admin/registrants");
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
    setIdFilter("");
    setNameFilter("");
    setBureauTextFilter("");
    setCodeFilter("");
    setSortKey(null);
    setSuccess(null);
    setError(null);
  }

  function copy(text: string) {
    if (!text) return;
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
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* Header */}
      <AdminHeader title="Assign Gift">
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
      </AdminHeader>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 grid lg:grid-cols-2 gap-6 items-start">
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
        <section className="rounded-2xl p-4 sm:p-6 bg-white/5 border border-white/10 space-y-4 flex flex-col min-h-[70vh] min-h-[70svh] min-w-0">
          <h2 className="text-lg font-bold">2) Pick winner</h2>

          {/* === Filters (searchable table) === */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <label className="text-xs opacity-80 block mb-1">
                Search (Ctrl/Cmd + K)
              </label>
              <div className="relative">
                <input
                  ref={searchInputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by ID, name, bureau, or code…"
                  className="w-full p-3 pr-10 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                  aria-label="Search registrants"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-70">
                  ⌘K
                </span>
              </div>
            </div>

            <div className="min-w-[10rem]">
              <label className="text-xs opacity-80 block mb-1">Bureau</label>
              <select
                value={bureauFilter}
                onChange={(e) => setBureauFilter(e.target.value)}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                aria-label="Filter by bureau"
              >
                <option value="all">All bureaus</option>
                {bureaus.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[9rem]">
              <label className="text-xs opacity-80 block mb-1">
                Rows per page
              </label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="w-full p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                aria-label="Rows per page"
              >
                {[5, 10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scroller */}
          <div className="flex-1 min-h-0 rounded-xl border border-white/10">
            <div className="-mx-4 sm:mx-0">
              <div
                className="px-4 h-[56vh] sm:h-auto overflow-x-auto overflow-y-auto"
                style={{
                  WebkitOverflowScrolling: "touch",
                  touchAction: "pan-x pan-y pinch-zoom",
                }}
                role="region"
                aria-label="Registrants table (scroll horizontally on mobile)"
              >
                <table className="w-max sm:w-full text-sm min-w-[640px] table-fixed">
                  <thead className="bg-white/10 sticky top-0 z-10">
                    {/* Sortable head row */}
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
                        Gacha Code
                      </Th>
                      <Th sortable={false} ariaSort="none" title="Not sortable">
                        {/* actions/selection */}
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
                          value={bureauTextFilter}
                          onChange={(e) => setBureauTextFilter(e.target.value)}
                          placeholder="Filter bureau…"
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
                      <th className="p-2 text-slate-300/70 text-[11px]">—</th>
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
                          {q ||
                          bureauFilter !== "all" ||
                          idFilter ||
                          nameFilter ||
                          bureauTextFilter ||
                          codeFilter
                            ? "No results match your filters."
                            : "No registrants found."}
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
                            selectedRegistrant === r.id
                              ? "bg-indigo-500/10"
                              : ""
                          }`}
                        >
                          <td className="p-3 font-mono opacity-80 whitespace-nowrap max-w-[6rem] truncate">
                            <Highlight text={String(r.id)} q={q} />
                          </td>
                          <td className="p-3">
                            <div
                              className="max-w-[14rem] sm:max-w-none truncate"
                              title={r.name}
                            >
                              <Highlight text={r.name} q={q} />
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="max-w-[10rem] truncate break-words">
                              {r.bureau ? (
                                <Highlight text={r.bureau} q={q} />
                              ) : (
                                <span className="opacity-60">—</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="inline-flex items-center gap-2 max-w-[14rem]">
                              <span
                                className="font-mono truncate break-words"
                                title={r.gacha_code || ""}
                              >
                                <Highlight
                                  text={maskedCode(r.gacha_code)}
                                  q={q}
                                />
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-3 py-2 border-t border-white/10 text-xs">
              <div className="opacity-80">
                Page {pageSafe} / {totalPages} • {sortedRegs.length} result
                {sortedRegs.length === 1 ? "" : "s"}
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
            className="sticky bottom-0 mt-3 flex items-center justify-end gap-2 backdrop-blur bg-white/5 border border-white/10 rounded-xl px-3 py-2 pb-[env(safe-area-inset-bottom)]"
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

function Th({
  children,
  sortable,
  active,
  dir,
  onClick,
  ariaSort,
  title,
}: {
  children?: React.ReactNode;
  sortable?: boolean;
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  ariaSort?: "none" | "ascending" | "descending";
  title?: string;
}) {
  const base =
    "p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-200/90 whitespace-nowrap";
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

/** Small helper to highlight the matched part of a string */
function Highlight({ text, q }: { text: string; q: string }) {
  const query = q.trim();
  if (!query) return <>{text}</>;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return <>{text}</>;
  const before = text.slice(0, i);
  const match = text.slice(i, i + query.length);
  const after = text.slice(i + query.length);
  return (
    <>
      {before}
      <mark className="rounded px-0.5 bg-yellow-300/30 text-yellow-100">
        {match}
      </mark>
      {after}
    </>
  );
}
