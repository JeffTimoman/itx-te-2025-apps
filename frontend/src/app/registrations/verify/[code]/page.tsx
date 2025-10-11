"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Registrant = {
  id: number;
  name: string;
  bureau?: string | null;
  gacha_code?: string | null;
};

/**
 * VerifyPage — polished verification flow (single‑use code)
 *
 * UX upgrades
 * - App header with code badge + status chip
 * - Searchable dropdown (client-side filter) + fallback manual ID input
 * - Inline email validation and clearer error/success banners
 * - Loading skeletons, retry fetch, and a soft 15:00 helper countdown
 * - Auto‑redirect to home after success with visual feedback
 */
export default function VerifyPage({ params }: { params: { code: string } }) {
  const code = params.code;
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualId, setManualId] = useState<string>("");

  // soft local countdown (not authoritative; server owns TTL)
  const [secondsLeft, setSecondsLeft] = useState<number>(15 * 60);
  const timerRef = useRef<number | null>(null);

  const emailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);
  const canSubmit = useMemo(() => {
    const idOk = manualMode
      ? !!manualId.trim() && Number(manualId) > 0
      : !!selectedId;
    return idOk && emailValid && !loading;
  }, [manualMode, manualId, selectedId, emailValid, loading]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrants;
    return registrants.filter((r) =>
      `${r.name} ${r.bureau || ""}`.toLowerCase().includes(q)
    );
  }, [registrants, query]);

  async function fetchRegistrants() {
    setFetching(true);
    setFetchErr(null);
    try {
      const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const resp = await fetch(`${BACKEND}/api/registrants/unverified`);
      if (!resp.ok) throw new Error(`Failed ${resp.status}`);
      const data = (await resp.json()) as Registrant[];
      setRegistrants(data || []);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchRegistrants();
    // soft countdown
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const idToSend = manualMode ? Number(manualId) : selectedId;
    if (!idToSend) return setStatus("Please select or enter your ID");
    if (!emailValid) return setStatus("Enter a valid email");
    setLoading(true);
    try {
      const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const resp = await fetch(`${BACKEND}/api/registrations/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          email: email.trim(),
          registrant_id: idToSend,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setStatus(
          (data && (data.error || data.message)) ||
            `Server error ${resp.status}`
        );
      } else {
        const sel = registrants.find((r) => r.id === idToSend);
        const display = sel
          ? `${sel.name}${sel.bureau ? ` — ${sel.bureau}` : ""}`
          : `ID ${idToSend}`;
        setEmail("");
        setSelectedId(null);
        setManualId("");
        setRegistrants([]);
        setStatus(`Verified for ${display}. Redirecting…`);
        setTimeout(() => router.push("/registrations/verify/finish"), 2200);
      }
    } catch {
      setStatus("Network error");
    } finally {
      setLoading(false);
    }
  }

  const mm = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
              VR
            </div>
            <h1 className="text-sm sm:text-base font-semibold">
              Verify Registration
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-lg text-[11px] bg-white/10 border border-white/20 font-mono">
              code: {code}
            </span>
            <span className="px-2 py-1 rounded-lg text-[11px] bg-white/10 border border-white/20">
              {secondsLeft > 0 ? `~${mm}:${ss}` : "expires soon"}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-slate-300 text-sm">
          Select your name and enter your email to get your code for winning prizes.
          This link is single‑use and expires after ~15 minutes.
        </p>

        {status && (
          <div
            className={`mt-4 rounded-2xl p-4 border ${
              status.toLowerCase().startsWith("verified")
                ? "bg-emerald-900/30 border-emerald-400/40 text-emerald-100"
                : "bg-rose-900/30 border-rose-400/40 text-rose-100"
            }`}
          >
            {status}
          </div>
        )}

        {/* Fetch error banner */}
        {fetchErr && (
          <div className="mt-4 rounded-2xl p-4 bg-rose-900/40 border border-rose-400/40 text-rose-100 flex items-center justify-between gap-3">
            <div className="text-sm">
              {fetchErr} — you can still enter your ID manually.
            </div>
            <button
              onClick={fetchRegistrants}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 border border-white/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-6 grid gap-4 rounded-2xl p-6 bg-white/5 border border-white/10"
        >
          {!manualMode ? (
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-wider opacity-80">
                Select your name
              </label>
              <div className="flex gap-2 items-center">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name/biro"
                  className="flex-1 p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                />
                <button
                  type="button"
                  onClick={fetchRegistrants}
                  disabled={fetching}
                  className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 disabled:opacity-50"
                >
                  {fetching ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              <select
                value={selectedId ?? ""}
                onChange={(e) =>
                  setSelectedId(e.target.value ? Number(e.target.value) : null)
                }
                className="p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              >
                <option value="">— Select your name —</option>
                {filtered.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.bureau ? ` — ${r.bureau}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setManualMode(true)}
                className="self-start text-xs opacity-80 hover:opacity-100"
              >
                Can’t find your name? Enter ID instead
              </button>
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="text-xs uppercase tracking-wider opacity-80">
                Enter your registrant ID
              </label>
              <input
                inputMode="numeric"
                value={manualId}
                onChange={(e) =>
                  setManualId(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="e.g., 1024"
                className="p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
              />
              <button
                type="button"
                onClick={() => setManualMode(false)}
                className="self-start text-xs opacity-80 hover:opacity-100"
              >
                Back to list
              </button>
            </div>
          )}

          <div className="grid gap-2">
            <label className="text-xs uppercase tracking-wider opacity-80">
              Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className={`p-3 rounded-xl bg-white/10 border ${
                email
                  ? emailValid
                    ? "border-white/20"
                    : "border-amber-400/50"
                  : "border-white/20"
              } outline-none focus:ring-2 focus:ring-indigo-400/60`}
              inputMode="email"
            />
            {!emailValid && email && (
              <p className="text-[11px] text-amber-200">
                That email doesn’t look right.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setEmail("");
                setSelectedId(null);
                setManualId("");
              }}
              className="px-4 py-2 rounded-lg bg-white/10 border border-white/20"
            >
              Clear
            </button>
            <button
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify & Activate"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
