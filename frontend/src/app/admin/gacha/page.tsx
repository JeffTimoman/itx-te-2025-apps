"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * GachaPage — ultra‑festive, fullscreen‑ready gift awarding
 *
 * 🔧 Add these packages (once):
 *   npm i framer-motion canvas-confetti
 *
 * UX highlights
 * - Neon, arcade‑style look totally distinct from admin pages
 * - Fullscreen toggle for on‑stage reveals (native Fullscreen API)
 * - Two reveal modes:
 *     1) First draw → spectacular: drum roll + BIG confetti + code "decrypt"
 *     2) Refresh draw → subtle: quick shuffle, light confetti
 * - Code format PPPP2025-XXXXXXXXXX → show only PPPP2025 first, then animate XXXXXXXXXX
 * - Winner may reject → "Refresh Winner" yields milder animation
 */

type GiftAvail = {
  id: number;
  name: string;
  description?: string | null;
  quantity: number;
  awarded: number;
  gift_category_id?: number | null;
};

type PreviewWinner = { id: number; name: string; gacha_code?: string | null };

export default function GachaPage() {
  // data
  const [gifts, setGifts] = useState<GiftAvail[]>([]);
  const [selectedGift, setSelectedGift] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewWinner | null>(null);

  // ui
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<
    "idle" | "drawing" | "reveal" | "refresh-reveal"
  >("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // code animation
  const [suffixDisplay, setSuffixDisplay] = useState<string>("**********");
  const scrambleTimer = useRef<number | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // derived
  const selectedGiftObj = useMemo(
    () => gifts.find((g) => g.id === selectedGift) || null,
    [gifts, selectedGift]
  );

  // load gifts
  const toMsg = (e: unknown) => {
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
    try {
      const res = await fetch("/api/admin/gifts/available");
      if (!res.ok) throw await res.json();
      const data = await res.json();
      setGifts(data || []);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // fullscreen handling
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  async function enterFullscreen() {
    try {
      await hostRef.current?.requestFullscreen();
    } catch {}
  }
  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {}
  }

  // util: parse code
  function splitCode(code?: string | null): { prefix: string; suffix: string } {
    if (!code) return { prefix: "", suffix: "" };
    const [pre, suf] = code.split("-");
    return { prefix: pre || "", suffix: suf || "" };
  }

  // confetti (loaded lazily to avoid SSR hiccups)
  async function burstConfetti(power: "big" | "small") {
    const confetti = (await import("canvas-confetti")).default;
    const base = {
      spread: power === "big" ? 80 : 55,
      startVelocity: power === "big" ? 55 : 35,
      ticks: power === "big" ? 400 : 250,
      gravity: 0.9,
      zIndex: 9999,
    } as const;
    const center = { x: 0.5, y: 0.4 };
    confetti({
      ...base,
      particleCount: power === "big" ? 160 : 60,
      origin: center,
    });
    confetti({
      ...base,
      particleCount: power === "big" ? 120 : 40,
      origin: { x: 0.2, y: 0.6 },
    });
    confetti({
      ...base,
      particleCount: power === "big" ? 120 : 40,
      origin: { x: 0.8, y: 0.6 },
    });
  }

  // code scramble animation → reveals true suffix
  function animateSuffixReveal(trueSuffix: string, spectacular: boolean) {
    if (scrambleTimer.current) window.clearInterval(scrambleTimer.current);
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // friendly chars
    const target = trueSuffix.padEnd(10, "X").slice(0, 10);
    const duration = spectacular ? 3500 : 1400; // ms
    const start = performance.now();

    const tick = () => {
      const now = performance.now();
      const t = Math.min(1, (now - start) / duration);
      const revealCount = Math.floor(t * target.length);
      const scrambled = target
        .split("")
        .map((ch, i) =>
          i < revealCount
            ? ch
            : alphabet[Math.floor(Math.random() * alphabet.length)]
        )
        .join("");
      setSuffixDisplay(scrambled);
      if (t < 1) {
        scrambleTimer.current = window.setTimeout(tick, spectacular ? 30 : 24);
      } else {
        setSuffixDisplay(target);
      }
    };
    tick();
  }

  async function pickRandom(spectacular: boolean) {
    if (!selectedGift) return setError("Select a gift first");
    setError(null);
    setLoading(true);
    setStage("drawing");
    try {
      const res = await fetch(
        `/api/admin/gifts/${selectedGift}/random-winner`,
        { method: "POST" }
      );
      if (!res.ok) throw await res.json();
      const data = (await res.json()) as PreviewWinner;
      setPreview(data);

      // start reveal sequence
      const { suffix } = splitCode(data.gacha_code || "");
      setSuffixDisplay("**********");
      setStage(spectacular ? "reveal" : "refresh-reveal");
      animateSuffixReveal(suffix, spectacular);
      // delayed confetti burst
      setTimeout(
        () => burstConfetti(spectacular ? "big" : "small"),
        spectacular ? 900 : 300
      );
    } catch (e) {
      setError(toMsg(e));
      setStage("idle");
    } finally {
      setLoading(false);
    }
  }

  async function saveWinner() {
    if (!selectedGift || !preview) return setError("No preview available");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/gifts/${selectedGift}/save-winner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrant_id: preview.id }),
      });
      if (!res.ok) throw await res.json();
      await load();
      setPreview(null);
      alert("Winner saved");
      setStage("idle");
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }

  // visuals
  const cyberBg =
    "bg-[radial-gradient(1000px_600px_at_50%_-10%,rgba(99,102,241,0.25),transparent),radial-gradient(800px_400px_at_30%_120%,rgba(16,185,129,0.18),transparent)]";

  const prefix = splitCode(preview?.gacha_code).prefix; // PPPP2025
  const displayName = preview?.name || "";

  return (
    <div
      ref={hostRef}
      className={`min-h-screen ${cyberBg} from-slate-950 via-slate-950 to-slate-950 text-slate-100 relative overflow-hidden`}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
              GA
            </div>
            <h1 className="text-sm sm:text-base font-semibold">
              Gacha • Award Gifts
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                isFullscreen ? exitFullscreen() : enterFullscreen()
              }
              className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15"
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
          </div>
        </div>
      </header>

      {/* Main controls */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-[360px,1fr] gap-6 items-start">
        <section className="rounded-2xl p-6 bg-white/5 border border-white/10 space-y-4">
          <h2 className="text-lg font-bold">Step 1. Select a gift</h2>
          <div>
            <select
              value={selectedGift ?? ""}
              onChange={(e) =>
                setSelectedGift(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full p-3 rounded-xl bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
            >
              <option value="">— Select gift —</option>
              {gifts.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} (awarded {g.awarded}/{g.quantity})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => pickRandom(true)}
              disabled={!selectedGift || loading}
              className="px-3 py-2 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 disabled:opacity-50 font-semibold"
            >
              Get Winner
            </button>
            <button
              onClick={() => pickRandom(false)}
              disabled={!selectedGift || loading}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 disabled:opacity-50"
            >
              Refresh Winner
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPreview(null)}
              disabled={!preview}
              className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 disabled:opacity-50"
            >
              Clear Preview
            </button>
            <button
              onClick={saveWinner}
              disabled={!preview || loading}
              className="px-3 py-2 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 font-semibold"
            >
              Save Winner
            </button>
          </div>

          {error && <div className="text-sm text-rose-300">{error}</div>}
          {loading && <div className="text-xs opacity-80">Working…</div>}
        </section>

        {/* Stage area */}
        <section className="relative rounded-2xl p-0 bg-transparent min-h-[420px]">
          {/* Neon grid backdrop */}
          <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none bg-[linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:36px_36px]" />

          <div className="h-full w-full grid place-items-center px-4 py-8 text-center">
            <AnimatePresence mode="wait">
              {!preview ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="text-slate-300"
                >
                  <div className="text-4xl font-black tracking-tight">
                    Ready to draw
                  </div>
                  <p className="mt-2 opacity-80">
                    Select a gift and press{" "}
                    <span className="font-semibold">Get Winner</span>.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full"
                >
                  {/* Gift name */}
                  <motion.div
                    layout
                    className="text-sm uppercase tracking-widest text-indigo-200/80 mb-4"
                  >
                    {selectedGiftObj?.name}
                  </motion.div>

                  {/* Winner name */}
                  <motion.div
                    layout
                    className="text-5xl md:text-7xl font-black"
                  >
                    <span className="[text-shadow:_0_0_20px_rgba(99,102,241,0.6)]">
                      {displayName}
                    </span>
                  </motion.div>

                  {/* Code prefix (always shown) */}
                  <div className="mt-3 text-lg md:text-2xl font-mono text-emerald-200/90">
                    {prefix || "PPPP2025"}
                    <span className="opacity-40">-</span>
                    <span className="opacity-60">
                      {stage === "idle" ? "**********" : null}
                    </span>
                  </div>

                  {/* Animated suffix */}
                  <div className="mt-2">
                    <motion.div
                      key={suffixDisplay}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className="inline-block px-4 py-2 rounded-xl border border-white/20 bg-white/5 font-mono text-3xl md:text-5xl tracking-widest"
                    >
                      {suffixDisplay}
                    </motion.div>
                  </div>

                  {/* Spectacle overlay for first reveal */}
                  <AnimatePresence>
                    {stage === "reveal" && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none fixed inset-0 flex items-center justify-center"
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),transparent_60%)]" />
                        <motion.div
                          initial={{ scale: 0.9 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 200,
                            damping: 12,
                          }}
                          className="px-5 py-2 rounded-xl bg-indigo-500/20 border border-indigo-300/30 text-indigo-100 text-sm uppercase tracking-widest"
                        >
                          🎉 Winner Revealed!
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Subtext */}
                  <div className="mt-4 text-xs text-slate-300/80">
                    If the winner declines the prize, use{" "}
                    <span className="font-semibold">Refresh Winner</span> for a
                    new draw (mild animation).
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
}
