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
      // refresh
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
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
              ITX
            </div>
            <h1 className="text-sm sm:text-base font-semibold">Assign Gift</h1>
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
                          {q || bureauFilter !== "all"
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
                Page {pageSafe} / {totalPages} • {filteredRegs.length} result
                {filteredRegs.length === 1 ? "" : "s"}
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

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-200/90 whitespace-nowrap">
      {children}
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
