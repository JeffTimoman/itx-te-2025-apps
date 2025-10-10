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
 * GachaPage — code + menu + sequential glitch (prefix then suffix)
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

// Timings
const GLITCH_MS_FIRST_PREFIX = 2200;
const GLITCH_MS_FIRST_SUFFIX = 8000; // long drum-roll overall, but suffix starts after prefix completes
const GLITCH_MS_REFRESH_PREFIX = 500;
const GLITCH_MS_REFRESH_SUFFIX = 2000;

const DECODE_MS_FIRST_PREFIX = 360;
const DECODE_MS_FIRST_SUFFIX = 1200;
const DECODE_MS_REFRESH_PREFIX = 220;
const DECODE_MS_REFRESH_SUFFIX = 400;

const SUFFIX_LEN = 10; // 10 digits

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
  const [revealDone, setRevealDone] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPreviewName, setShowPreviewName] = useState(false);

  // code animation
  const [prefixDisplay, setPrefixDisplay] = useState<string>("CCCC2025"); // placeholder
  const [suffixDisplay, setSuffixDisplay] = useState<string>("**********");
  const [isGlitchingPrefix, setIsGlitchingPrefix] = useState(false);
  const [isGlitchingSuffix, setIsGlitchingSuffix] = useState(false);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const menuFirstButtonRef = useRef<HTMLButtonElement | null>(null);

  // timers
  const prefixTimer = useRef<number | null>(null);
  const suffixTimer = useRef<number | null>(null);

  // confetti instance (works in fullscreen) — the library's `create` returns a
  // callable instance that we invoke to burst confetti.
  const confettiInstanceRef = useRef<
    import("canvas-confetti").ConfettiFn | null
  >(null);

  // derived
  const selectedGiftObj = useMemo(
    () => gifts.find((g) => g.id === selectedGift) || null,
    [gifts, selectedGift]
  );

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
      if (!selectedGift && data?.length) setSelectedGift(data[0].id);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }, [selectedGift]);

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
      // (re)bind confetti to the fullscreen host element
      await ensureConfettiInstance();
    } catch {}
  }
  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      // (re)bind confetti back to document.body (hostRef still works, keep it consistent)
      await ensureConfettiInstance();
    } catch {}
  }

  // parse code:
  // Expect "<first8>-<10digits>" but we are tolerant: take first segment's first 8 chars;
  // second segment: first 10 digits (pad with X if fewer).
  function splitCode(code?: string | null): { prefix: string; suffix: string } {
    if (!code) return { prefix: "", suffix: "" };
    const [preRaw = "", sufRaw = ""] = code.split("-");
    const prefix = preRaw.slice(0, 8);
    const digits = (sufRaw.match(/\d/g) || []).join("").slice(0, SUFFIX_LEN);
    const suffix = digits.padEnd(SUFFIX_LEN, "0"); // keep digits; pad with zeros
    return { prefix, suffix };
  }

  // confetti bound to hostRef so it renders in fullscreen too
  async function ensureConfettiInstance() {
    const confettiMod = await import("canvas-confetti");

    // Prefer the *actual* fullscreen element if present
    const root =
      (document.fullscreenElement as HTMLElement | null) ??
      hostRef.current ??
      document.body;

    // Recreate every time so the canvas is attached to the correct root
    confettiInstanceRef.current = confettiMod.create(root, {
      resize: true,
      // Workers can be blocked or fail with OffscreenCanvas on some setups
      useWorker: false,
    });
  }


  async function burstConfetti(power: "big" | "small") {
    if (!confettiInstanceRef.current) await ensureConfettiInstance();
    const confetti = confettiInstanceRef.current!;

    const base = {
      spread: power === "big" ? 80 : 55,
      startVelocity: power === "big" ? 55 : 35,
      ticks: power === "big" ? 400 : 250,
      gravity: 0.9,
      zIndex: 2147483647, // make absolutely sure it's on top
    } as const;

    const center = { x: 0.5, y: 0.45 };
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


  // cleanup timers
  useEffect(() => {
    return () => {
      if (prefixTimer.current) window.clearTimeout(prefixTimer.current);
      if (suffixTimer.current) window.clearTimeout(suffixTimer.current);
    };
  }, []);

  // generic glitch helper (used for prefix & suffix)
  function glitchReveal({
    target,
    spectacular,
    isDigitsOnly,
    onFrame,
    onDone,
    phase,
  }: {
    target: string;
    spectacular: boolean;
    isDigitsOnly: boolean;
    onFrame: (s: string) => void;
    onDone?: () => void;
    phase: "prefix" | "suffix";
  }) {
    const alphabetLetters = "ABCDEFGHJKMNPQRSTUVWXYZ";
    const alphabetDigits = "0123456789";
    const alphabetSymbols = "@#$%&*?+-";
    const alphabet = isDigitsOnly
      ? alphabetDigits
      : alphabetLetters + alphabetDigits + alphabetSymbols;

    const GLITCH_MS =
      phase === "prefix"
        ? spectacular
          ? GLITCH_MS_FIRST_PREFIX
          : GLITCH_MS_REFRESH_PREFIX
        : spectacular
        ? GLITCH_MS_FIRST_SUFFIX
        : GLITCH_MS_REFRESH_SUFFIX;

    const DECODE_MS =
      phase === "prefix"
        ? spectacular
          ? DECODE_MS_FIRST_PREFIX
          : DECODE_MS_REFRESH_PREFIX
        : spectacular
        ? DECODE_MS_FIRST_SUFFIX
        : DECODE_MS_REFRESH_SUFFIX;

    const start = performance.now();
    if (phase === "prefix") setIsGlitchingPrefix(true);
    if (phase === "suffix") setIsGlitchingSuffix(true);

    const tick = () => {
      const now = performance.now();
      const elapsed = now - start;

      // Phase 1: pure glitch
      if (elapsed < GLITCH_MS) {
        const scrambled = Array.from(
          { length: target.length },
          () => alphabet[Math.floor(Math.random() * alphabet.length)]
        ).join("");
        onFrame(scrambled);
        const delay = spectacular ? 33 : 28;
        const handle = window.setTimeout(tick, delay);
        if (phase === "prefix") prefixTimer.current = handle;
        else suffixTimer.current = handle;
        return;
      }

      // Phase 2: decode L->R
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

      onFrame(decoded);

      if (t < 1) {
        const delay = spectacular ? 30 : 24;
        const handle = window.setTimeout(tick, delay);
        if (phase === "prefix") prefixTimer.current = handle;
        else suffixTimer.current = handle;
      } else {
        onFrame(target);
        if (phase === "prefix") setIsGlitchingPrefix(false);
        if (phase === "suffix") setIsGlitchingSuffix(false);
        onDone?.();
      }
    };

    tick();
  }

  // Orchestrate sequential glitch: prefix first, then suffix. Confetti after suffix.
  function startRevealSequence(
    prefix: string,
    suffix: string,
    spectacular: boolean
  ) {
    setRevealDone(false);
    // initialize displayed values
    setPrefixDisplay(prefix ? "********" : "");
    setSuffixDisplay("**********");

    glitchReveal({
      target: prefix,
      spectacular,
      isDigitsOnly: false,
      onFrame: setPrefixDisplay,
      phase: "prefix",
      onDone: () => {
        glitchReveal({
          target: suffix,
          spectacular,
          isDigitsOnly: true,
          onFrame: setSuffixDisplay,
          phase: "suffix",
          onDone: () => {
            setRevealDone(true);
            // confetti AFTER suffix completes
            burstConfetti(spectacular ? "big" : "small");
          },
        });
      },
    });
  }

  async function pickRandom(spectacular: boolean) {
    if (!selectedGift) return setError("Select a gift first");
    setError(null);
    setLoading(true);
    setStage("drawing");
    setRevealDone(false);
    setIsMenuOpen(false); // hide menu on start

    try {
      const res = await fetch(
        `/api/admin/gifts/${selectedGift}/random-winner`,
        { method: "POST" }
      );
      if (!res.ok) throw await res.json();
      const data = (await res.json()) as PreviewWinner;
      setPreview(data);

      const { prefix, suffix } = splitCode(data.gacha_code || "");
      const nextStage = spectacular ? "reveal" : "refresh-reveal";
      setStage(nextStage);

      startRevealSequence(
        prefix || "********",
        suffix || "0000000000",
        spectacular
      );
    } catch (e) {
      setError(toMsg(e));
      setStage("idle");
      setIsGlitchingPrefix(false);
      setIsGlitchingSuffix(false);
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
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }

  // accessibility niceties: Esc closes menu & focus first button when opened
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    if (isMenuOpen) {
      document.addEventListener("keydown", onKey);
      setTimeout(() => menuFirstButtonRef.current?.focus(), 0);
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  // Ensure a confetti instance exists at least once
  useEffect(() => {
    ensureConfettiInstance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = (g: GiftAvail) =>
    Math.max(0, (g.quantity ?? 0) - (g.awarded ?? 0));

  const cyberBg =
    "bg-[radial-gradient(1000px_600px_at_50%_-10%,rgba(99,102,241,0.25),transparent),radial-gradient(800px_400px_at_30%_120%,rgba(16,185,129,0.18),transparent)]";

  const { prefix: realPrefix } = splitCode(preview?.gacha_code);

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
                ITX
              </div>
              <h1 className="text-sm sm:text-base font-semibold">
                {"Let's become a winner!"}
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
              <button
                onClick={() => setIsMenuOpen((v) => !v)}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 text-xs font-semibold"
                aria-expanded={isMenuOpen}
                aria-controls="gacha-controls"
              >
                {isMenuOpen ? "Close Menu" : "Open Menu"}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Fullscreen FAB to toggle menu */}
      {isFullscreen && (
        <button
          onClick={() => setIsMenuOpen((v) => !v)}
          className="fixed z-[10000] right-4 bottom-4 rounded-full px-4 py-3 bg-indigo-500/95 hover:bg-indigo-500 border border-white/20 shadow-lg text-white text-sm font-semibold"
          aria-label="Toggle Menu"
          aria-expanded={isMenuOpen}
          aria-controls="gacha-controls"
        >
          {isMenuOpen ? "Close Menu" : "Open Menu"}
        </button>
      )}

      {/* Slide-in Menu (backdrop + panel) */}
      <AnimatePresence initial={false}>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.button
              key="menu-backdrop"
              onClick={() => setIsMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/40"
              aria-label="Close menu"
            />
            {/* Panel */}
            <motion.aside
              key="menu-panel"
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="fixed left-0 top-0 bottom-0 z-[9999] w-[320px] max-w-[85vw] bg-slate-900/90 border-r border-white/10 backdrop-blur-xl p-6 overflow-y-auto"
              role="dialog"
              aria-modal="true"
              aria-label="Gacha Controls"
              id="gacha-controls"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/90">
                    Controls
                  </h2>
                  <button
                    ref={menuFirstButtonRef}
                    onClick={() => setIsMenuOpen(false)}
                    className="px-2.5 py-1 rounded-md bg-white/10 border border-white/20 text-xs hover:bg-white/15"
                  >
                    Close
                  </button>
                </div>

                {error && (
                  <div className="text-xs rounded-md border border-red-400/30 bg-red-500/10 text-red-200 p-2">
                    {error}
                  </div>
                )}

                {/* Gift picker */}
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
                    Gift
                  </div>
                  <div className="space-y-2 max-h-56 overflow-auto pr-1">
                    {loading && (
                      <div className="text-xs text-white/70">Loading…</div>
                    )}
                    {!loading && gifts.length === 0 && (
                      <div className="text-xs text-white/60">
                        No gifts available.
                      </div>
                    )}
                    {gifts.map((g) => {
                      const rem = remaining(g);
                      const disabled = rem <= 0;
                      return (
                        <label
                          key={g.id}
                          className={`flex items-center justify-between gap-2 rounded-md border p-2 text-xs ${
                            selectedGift === g.id
                              ? "border-indigo-400/50 bg-indigo-400/10"
                              : "border-white/10 bg-white/5 hover:bg-white/8"
                          } ${disabled ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="gift"
                              value={g.id}
                              checked={selectedGift === g.id}
                              onChange={() => setSelectedGift(g.id)}
                              disabled={disabled}
                            />
                            <div className="font-medium">{g.name}</div>
                          </div>
                          <div className="tabular-nums text-white/70">
                            {g.awarded}/{g.quantity}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2">
                    <button
                      onClick={load}
                      className="text-xs px-2.5 py-1 rounded-md border border-white/20 bg-white/10 hover:bg-white/15"
                    >
                      Reload Gifts
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-white/10 pt-4">
                  <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
                    Actions
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => pickRandom(true)}
                      disabled={
                        loading ||
                        !selectedGift ||
                        Boolean(
                          selectedGiftObj && remaining(selectedGiftObj) <= 0
                        )
                      }
                      className="px-3 py-2 rounded-md bg-indigo-500/90 hover:bg-indigo-500 border border-indigo-300/30 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Get Winner
                    </button>
                    <button
                      onClick={() => pickRandom(false)}
                      disabled={
                        loading ||
                        !selectedGift ||
                        Boolean(
                          selectedGiftObj && remaining(selectedGiftObj) <= 0
                        )
                      }
                      className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Refresh Winner
                    </button>
                    <button
                      onClick={saveWinner}
                      disabled={loading || !preview || !selectedGift}
                      className="px-3 py-2 rounded-md bg-emerald-500/90 hover:bg-emerald-500 border border-emerald-300/30 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Save Winner
                    </button>
                  </div>
                </div>

                {/* Preview */}
                <div className="border-t border-white/10 pt-4">
                  <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
                    Preview
                  </div>
                  {preview ? (
                    <div className="text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-white/70">Name:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {showPreviewName ? preview.name : "Hidden"}
                          </span>
                          <button
                            onClick={() => setShowPreviewName((v) => !v)}
                            className="px-2 py-0.5 text-xs rounded bg-white/6 border border-white/10"
                          >
                            {showPreviewName ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <div className="font-mono text-[13px] break-words">
                        <span className="text-white/70">Code:</span>{" "}
                        <span className="font-mono">
                          {(() => {
                            const { prefix, suffix } = splitCode(
                              preview.gacha_code
                            );
                            return `${prefix || "********"}-${
                              suffix ? suffix : "**********"
                            }`;
                          })()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-white/60">
                      No winner preview yet.
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main — CENTERED STAGE */}
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

                  {/* PPPP2025-XXXXXXXXXX */}
                  <div className="mt-1 font-mono text-emerald-200/90">
                    <span
                      className={`text-lg md:text-2xl inline-block px-2 ${
                        isGlitchingPrefix ? "glitching glow" : "glow"
                      }`}
                    >
                      {realPrefix ? prefixDisplay : "********"}
                    </span>
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
                        isGlitchingSuffix ? "glitching glow" : "glow"
                      }`}
                    >
                      {suffixDisplay}
                    </motion.div>
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
