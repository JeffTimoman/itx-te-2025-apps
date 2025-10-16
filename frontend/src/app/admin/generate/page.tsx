"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminHeader from "../../../components/AdminHeader";

/**
 * GeneratePage — polished registration QR generator
 *
 * UX upgrades
 * - App header with status chip and subtle help text
 * - Bigger, responsive QR with selectable size (256/384/512)
 * - Actions: Regenerate, Copy Link, Open, Download PNG
 * - Loading skeleton and error banner with retry
 * - More robust origin/build helpers and safer env handling
 */
export default function GeneratePage() {
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<number>(384);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  const BACKEND = useMemo(() => process.env.NEXT_PUBLIC_BACKEND_URL || "", []);

  function getOrigin() {
    // Prefer explicit FRONTEND_ORIGIN; fall back to window.location.origin
    const env = (process.env.NEXT_PUBLIC_FRONTEND_ORIGIN || "").trim();
    if (env) return env.replace(/\/$/, "");
    if (typeof window !== "undefined" && window.location?.origin)
      return window.location.origin;
    return ""; // SSR-safe fallback; link will appear once mounted
  }

  const createCode = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = BACKEND.replace(/\/$/, "");
      const resp = await fetch(`${base}/api/registrations/generate`, {
        method: "POST",
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`Failed: ${resp.status} ${txt}`);
      }
      const body = await resp.json();
      const c = body.code as string;
      const origin = getOrigin();
      const path = body.verifyPath || `/registrations/verify/${c}`;
      setVerifyUrl(`${origin}${path}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [BACKEND]);

  useEffect(() => {
    // auto-generate on first load
    createCode();
  }, [createCode]);

  // Auto-refresh effect: when enabled, regenerate every 2 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      // avoid overlapping calls
      if (!loading) void createCode();
    }, 2000);
    return () => clearInterval(id);
  }, [autoRefresh, loading, createCode]);

  function qrSrc(url: string, px: number) {
    const base = BACKEND.replace(/\/$/, "");
    const endpoint = `${base}/api/qr?size=${px}&data=${encodeURIComponent(
      url
    )}`;
    return endpoint;
  }

  async function copyLink() {
    if (!verifyUrl) return;
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setError(null);
    } catch {
      setError("Failed to copy to clipboard");
    }
  }

  function downloadPng() {
    if (!verifyUrl) return;
    const a = document.createElement("a");
    a.href = qrSrc(verifyUrl, size);
    a.download = `registration-qr-${size}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      <AdminHeader title="TE Registration QR">
        <div className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20">
          {loading ? "Generating…" : verifyUrl ? "Ready" : "Idle"}
        </div>
      </AdminHeader>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-slate-300 text-sm">
          Scan this QR to open the verification page, select your name, and
          activate your registration.
        </p>

        {/* Error banner */}
        {error && (
          <div className="mt-4 rounded-2xl p-4 bg-rose-900/40 border border-rose-400/40 text-rose-100 flex items-start justify-between gap-3">
            <div className="text-sm">{error}</div>
            <button
              onClick={createCode}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 border border-white/20"
            >
              Retry
            </button>
          </div>
        )}

        {/* Controls */}
        <section className="mt-6 rounded-2xl p-4 bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">QR size</span>
            <select
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value, 10))}
              className="p-2.5 rounded-xl bg-white/10 border border-white/20"
            >
              {[256, 384, 512].map((n) => (
                <option key={n} value={n}>
                  {n}px
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-indigo-400"
              />
              Auto refresh (2s)
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={createCode}
              disabled={loading}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15 disabled:opacity-50"
            >
              {loading ? "Regenerating…" : "Regenerate"}
            </button>
            <button
              onClick={copyLink}
              disabled={!verifyUrl}
              className="px-3 py-2 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 disabled:opacity-50"
            >
              Copy Link
            </button>
            <a
              href={verifyUrl || undefined}
              target="_blank"
              rel="noreferrer"
              className={`px-3 py-2 rounded-lg border ${
                verifyUrl
                  ? "bg-white/10 border-white/20 hover:bg-white/15"
                  : "opacity-50 pointer-events-none border-white/20"
              }`}
            >
              Open
            </a>
            <button
              onClick={downloadPng}
              disabled={!verifyUrl}
              className="px-3 py-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50"
            >
              Download PNG
            </button>
          </div>
        </section>

        {/* QR + Link */}
        <section className="mt-6 grid place-items-center">
          <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
            {loading ? (
              <div className="h-[256px] w-[256px] sm:h-[320px] sm:w-[320px] bg-white/10 rounded-xl animate-pulse" />
            ) : verifyUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrSrc(verifyUrl, size)}
                  alt="Registration QR"
                  className="mx-auto mb-4 h-auto"
                  style={{ width: size, height: size }}
                />
                <div className="text-center text-sm break-all">
                  Link:{" "}
                  {verifyUrl ? (
                    <a
                      className="text-indigo-300 underline underline-offset-4"
                      href={verifyUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {verifyUrl}
                    </a>
                  ) : (
                    <span className="opacity-60">—</span>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm opacity-80">
                Click Regenerate to get a new QR link.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
