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
 * GachaPage — code-only reveal with long glitch + toggleable menu
 *
 * 🔧 Packages:
 *   npm i framer-motion canvas-confetti
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

const GLITCH_MS_FIRST = 12000; // ~15s for "Get Winner"
const GLITCH_MS_REFRESH = 2000; // short for "Refresh Winner"
const DECODE_MS_FIRST = 1440; // decode time after long glitch
const DECODE_MS_REFRESH = 900;
const SUFFIX_LEN = 10;

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
  const [revealDone, setRevealDone] = useState(false); // controls when to re-show settings
  const [isMenuOpen, setIsMenuOpen] = useState(false); // NEW: slide-in menu toggle

  // code animation
  const [suffixDisplay, setSuffixDisplay] = useState<string>("**********");
  const [isGlitching, setIsGlitching] = useState(false);
  const scrambleTimer = useRef<number | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  // derived
  const selectedGiftObj = useMemo(
    () => gifts.find((g) => g.id === selectedGift) || null,
    [gifts, selectedGift]
  );

  // helpers
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
    return {
      prefix: pre || "",
      suffix: (suf || "").padEnd(SUFFIX_LEN, "X").slice(0, SUFFIX_LEN),
    };
  }

  // confetti (lazy)
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

  // cleanup
  useEffect(() => {
    return () => {
      if (scrambleTimer.current) window.clearTimeout(scrambleTimer.current);
    };
  }, []);

  // code scramble → long glitch then decode
  function animateSuffixReveal(
    trueSuffix: string,
    spectacular: boolean,
    onDone?: () => void
  ) {
    if (scrambleTimer.current) window.clearTimeout(scrambleTimer.current);

    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const target = (trueSuffix || "")
      .padEnd(SUFFIX_LEN, "X")
      .slice(0, SUFFIX_LEN);

    const GLITCH_MS = spectacular ? GLITCH_MS_FIRST : GLITCH_MS_REFRESH;
    const DECODE_MS = spectacular ? DECODE_MS_FIRST : DECODE_MS_REFRESH;

    setIsGlitching(true);
    setRevealDone(false);

    const start = performance.now();

    const loop = () => {
      const now = performance.now();
      const elapsed = now - start;

      // Phase 1: long glitch (fully random)
      if (elapsed < GLITCH_MS) {
        const scrambled = Array.from(
          { length: SUFFIX_LEN },
          () => alphabet[Math.floor(Math.random() * alphabet.length)]
        ).join("");
        setSuffixDisplay(scrambled);
        scrambleTimer.current = window.setTimeout(loop, spectacular ? 33 : 28);
        return;
      }

      // Phase 2: decode to true value (left-to-right lock-in)
      const decodeElapsed = elapsed - GLITCH_MS;
      const t = Math.min(1, decodeElapsed / DECODE_MS);
      const revealCount = Math.floor(t * target.length);

      const decoded = target
        .split("")
        .map((ch, i) =>
          i < revealCount
            ? ch
            : alphabet[Math.floor(Math.random() * alphabet.length)]
        )
        .join("");

      setSuffixDisplay(decoded);

      if (t < 1) {
        scrambleTimer.current = window.setTimeout(loop, spectacular ? 30 : 24);
      } else {
        setSuffixDisplay(target);
        setIsGlitching(false);
        setRevealDone(true);
        onDone?.(); // fire AFTER reveal completes (confetti happens here)
      }
    };

    loop();
  }

  async function pickRandom(spectacular: boolean) {
    if (!selectedGift) return setError("Select a gift first");
    setError(null);
    setLoading(true);
    setStage("drawing");
    setRevealDone(false);
    setIsGlitching(true);
    setIsMenuOpen(false); // NEW: auto-hide the menu on start

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
      const nextStage = spectacular ? "reveal" : "refresh-reveal";
      setStage(nextStage);

      // confetti AFTER the reveal completes
      animateSuffixReveal(suffix, spectacular, () =>
        burstConfetti(spectacular ? "big" : "small")
      );
    } catch (e) {
      setError(toMsg(e));
      setStage("idle");
      setIsGlitching(false);
      setRevealDone(true);
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
      setRevealDone(true);
      // keep the menu state as-is (remains closed unless user opens)
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }

  const cyberBg =
    "bg-[radial-gradient(1000px_600px_at_50%_-10%,rgba(99,102,241,0.25),transparent),radial-gradient(800px_400px_at_30%_120%,rgba(16,185,129,0.18),transparent)]";

  const { prefix } = splitCode(preview?.gacha_code); // PPPP2025

  return (
    <div
      ref={hostRef}
      className={`min-h-screen ${cyberBg} from-slate-950 via-slate-950 to-slate-950 text-slate-100 relative overflow-hidden`}
    >
      {/* glitch styles */}
      <style>{`
        @keyframes glowPulse {
          0% { text-shadow: 0 0 14px rgba(99,102,241,0.55), 0 0 2px rgba(255,255,255,0.4); }
          50% { text-shadow: 0 0 26px rgba(99,102,241,0.8), 0 0 6px rgba(255,255,255,0.6); }
          100% { text-shadow: 0 0 14px rgba(99,102,241,0.55), 0 0 2px rgba(255,255,255,0.4); }
        }
        @keyframes glitchShift {
          0% { transform: translate(0,0) skew(0deg); filter: hue-rotate(0deg); }
          20% { transform: translate(0.5px,-0.6px) skew(0.1deg); }
          40% { transform: translate(-0.6px,0.4px) skew(-0.15deg); }
          60% { transform: translate(0.4px,0.6px) skew(0.12deg); }
          80% { transform: translate(-0.5px,-0.4px) skew(-0.1deg); }
          100% { transform: translate(0,0) skew(0deg); filter: hue-rotate(0deg); }
        }
        .glitching { animation: glitchShift 120ms infinite steps(2,end); }
        .glow { animation: glowPulse 2.2s ease-in-out infinite; }
      `}</style>

      {/* Header — HIDE IN FULLSCREEN */}
      {!isFullscreen && (
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

              {/* Menu Toggle */}
              <button
                onClick={() => setIsMenuOpen((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 text-xs font-semibold"
              >
                {isMenuOpen ? "Close Menu" : "Open Menu"}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Fullscreen FAB: toggle menu when in fullscreen (sibling to header) */}
      {isFullscreen && (
        <button
          onClick={() => setIsMenuOpen((v) => !v)}
          className="fixed z-[10000] right-4 bottom-4 rounded-full px-4 py-3 bg-indigo-500/95 hover:bg-indigo-500 border border-white/20 shadow-lg text-white text-sm font-semibold"
          aria-label="Toggle Menu"
        >
          {isMenuOpen ? "Close Menu" : "Open Menu"}
        </button>
      )}

      {/* Slide-in Menu (backdrop + panel) — stronger z-index and explicit keys to avoid animation conflicts */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="menu-backdrop"
              onClick={() => setIsMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/40"
            />
            {/* Panel */}
            <motion.aside
              key="menu-panel"
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="fixed left-0 top-0 bottom-0 z-[9999] w-[320px] max-w-[85vw] bg-slate-900/90 border-r border-white/10 backdrop-blur-xl p-6 overflow-y-auto"
            >
              {/* ...controls content stays the same */}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main — FULLY CENTERED STAGE */}
      <main className="px-4 py-8 min-h-screen flex items-center justify-center">
        <section className="relative rounded-2xl p-0 bg-transparent w-full max-w-4xl">
          {/* Neon grid backdrop */}
          <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none bg-[linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:36px_36px]" />

          <div className="w-full grid place-items-center px-4 py-8 text-center">
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
                    Open the menu and press{" "}
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
                  <motion.div
                    layout
                    className="text-sm uppercase tracking-widest text-indigo-200/80 mb-4"
                  >
                    {selectedGiftObj?.name}
                  </motion.div>

                  <div className="mt-1 text-lg md:text-2xl font-mono text-emerald-200/90">
                    {prefix || "PPPP2025"}
                    <span className="opacity-40">-</span>
                  </div>

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
                      className={`inline-block px-5 py-3 rounded-xl border border-white/20 bg-white/5 font-mono text-4xl md:text-6xl tracking-widest select-none ${
                        isGlitching ? "glitching glow" : "glow"
                      }`}
                    >
                      {suffixDisplay}
                    </motion.div>
                  </div>

                  <AnimatePresence>
                    {stage === "reveal" && !revealDone && (
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
                          🎉 Decrypting Winner Code…
                        </motion.div>
                      </motion.div>
                    )}
                    {stage === "refresh-reveal" && !revealDone && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="pointer-events-none fixed inset-0 flex items-center justify-center"
                      >
                        <motion.div className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs text-white/80">
                          Updating…
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="mt-4 text-xs text-slate-300/80">
                    Winner identity is hidden. Open the menu to{" "}
                    <span className="font-semibold">Save Winner</span> or{" "}
                    <span className="font-semibold">Refresh Winner</span>.
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
