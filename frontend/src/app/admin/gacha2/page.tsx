"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import authFetch from "../../../lib/api/client";
import AdminHeader from "../../../components/AdminHeader";
import { motion, AnimatePresence } from "framer-motion";

/**
 * GachaPage — Harry Potter skin (parchment + candlelight)
 *
 * Fonts (optional but recommended):
 *   <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600..900&family=Crimson+Pro:wght@400;600;700&display=swap" rel="stylesheet">
 *
 * Packages:
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

// Timings (unchanged)
const GLITCH_MS_FIRST_PREFIX = 2200;
const GLITCH_MS_FIRST_SUFFIX = 8000;
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
  const [success, setSuccess] = useState<string | null>(null);
  const [stage, setStage] = useState<
    "idle" | "drawing" | "reveal" | "refresh-reveal"
  >("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPreviewName, setShowPreviewName] = useState(false);

  // code animation
  const [prefixDisplay, setPrefixDisplay] = useState<string>("CCCC2025");
  const [suffixDisplay, setSuffixDisplay] = useState<string>("**********");
  const [isGlitchingPrefix, setIsGlitchingPrefix] = useState(false);
  const [isGlitchingSuffix, setIsGlitchingSuffix] = useState(false);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const menuFirstButtonRef = useRef<HTMLButtonElement | null>(null);

  // timers
  const prefixTimer = useRef<number | null>(null);
  const suffixTimer = useRef<number | null>(null);

  // confetti instance (works in fullscreen)
  const confettiInstanceRef = useRef<
    import("canvas-confetti").ConfettiFn | null
  >(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
      const res = await authFetch("/api/admin/gifts/available");
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
      await ensureConfettiInstance();
    } catch {}
  }
  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      await ensureConfettiInstance();
    } catch {}
  }

  // parse code
  function splitCode(code?: string | null): { prefix: string; suffix: string } {
    if (!code) return { prefix: "", suffix: "" };
    const [preRaw = "", sufRaw = ""] = code.split("-");
    const prefix = preRaw.slice(0, 8);
    const digits = (sufRaw.match(/\d/g) || []).join("").slice(0, SUFFIX_LEN);
    const suffix = digits.padEnd(SUFFIX_LEN, "0");
    return { prefix, suffix };
  }

  // confetti bound to hostRef so it renders in fullscreen too
  async function ensureConfettiInstance() {
    const confettiMod = await import("canvas-confetti");

    const root =
      (document.fullscreenElement as HTMLElement | null) ??
      hostRef.current ??
      document.body;

    if (confettiCanvasRef.current?.parentNode) {
      confettiCanvasRef.current.parentNode.removeChild(
        confettiCanvasRef.current
      );
    }
    confettiCanvasRef.current = null;

    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "2147483647";
    root.appendChild(canvas);
    confettiCanvasRef.current = canvas;

    confettiInstanceRef.current = confettiMod.create(canvas, {
      resize: true,
      useWorker: false,
    });
  }

  function removeConfettiCanvas() {
    if (confettiCanvasRef.current?.parentNode) {
      confettiCanvasRef.current.parentNode.removeChild(
        confettiCanvasRef.current
      );
    }
    confettiCanvasRef.current = null;
    confettiInstanceRef.current = null;
  }

  async function burstConfetti(power: "big" | "small") {
    if (!confettiInstanceRef.current) await ensureConfettiInstance();
    const confetti = confettiInstanceRef.current!;

    const base = {
      spread: power === "big" ? 75 : 50,
      startVelocity: power === "big" ? 52 : 32,
      ticks: power === "big" ? 360 : 220,
      gravity: 0.9,
      zIndex: 2147483647,
      scalar: power === "big" ? 1 : 0.9,
      // Warm magical palette: gold, parchment, burgundy, emerald
      colors: ["#d4af37", "#f4e4b1", "#7c1e1e", "#276749"],
    } as const;

    const center = { x: 0.5, y: 0.45 };
    confetti({
      ...base,
      particleCount: power === "big" ? 140 : 60,
      origin: center,
    });
    confetti({
      ...base,
      particleCount: power === "big" ? 100 : 40,
      origin: { x: 0.22, y: 0.6 },
    });
    confetti({
      ...base,
      particleCount: power === "big" ? 100 : 40,
      origin: { x: 0.78, y: 0.6 },
    });
  }

  // cleanup timers
  useEffect(() => {
    return () => {
      if (prefixTimer.current) window.clearTimeout(prefixTimer.current);
      if (suffixTimer.current) window.clearTimeout(suffixTimer.current);
      removeConfettiCanvas();
    };
  }, []);

  const resetGacha = useCallback(() => {
    if (prefixTimer.current) window.clearTimeout(prefixTimer.current);
    if (suffixTimer.current) window.clearTimeout(suffixTimer.current);
    setPreview(null);
    setStage("idle");
    setRevealDone(false);
    setIsGlitchingPrefix(false);
    setIsGlitchingSuffix(false);
    setPrefixDisplay("CCCC2025");
    setSuffixDisplay("**********");
    setShowPreviewName(false);
    removeConfettiCanvas();
  }, []);

  // arcane shimmer (renamed but keeps same logic)
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
    // Keep ASCII for clarity; add a few gentle sigils without breaking legibility
    const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
    const digits = "0123456789";
    const sigils = "✶★✷✦"; // occasional sparkles while scrambling
    const alphabet = isDigitsOnly ? digits : letters + digits + sigils;

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

      if (elapsed < GLITCH_MS) {
        const scrambled = Array.from(
          { length: target.length },
          () => alphabet[Math.floor(Math.random() * alphabet.length)]
        ).join("");
        onFrame(scrambled);
        const delay = spectacular ? 36 : 28;
        const handle = window.setTimeout(tick, delay);
        if (phase === "prefix") prefixTimer.current = handle;
        else suffixTimer.current = handle;
        return;
      }

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
        const delay = spectacular ? 30 : 22;
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

  function startRevealSequence(
    prefix: string,
    suffix: string,
    spectacular: boolean
  ) {
    setRevealDone(false);
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
    setIsMenuOpen(false);

    try {
      const res = await authFetch(
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
      const res = await authFetch(
        `/api/admin/gifts/${selectedGift}/save-winner`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrant_id: preview.id }),
        }
      );
      if (!res.ok) throw await res.json();
      await load();
      setSuccess("Winner saved.");
      resetGacha();
      setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }

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

  useEffect(() => {
    ensureConfettiInstance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = (g: GiftAvail) =>
    Math.max(0, (g.quantity ?? 0) - (g.awarded ?? 0));

  const { prefix: realPrefix } = splitCode(preview?.gacha_code);

  // 🎨 Theming tokens (tailwind classes)
  const parchmentBg =
    "bg-[radial-gradient(1400px_800px_at_50%_-10%,rgba(244,228,177,0.2),transparent),radial-gradient(900px_520px_at_30%_120%,rgba(107,46,46,0.18),transparent)]";
  const frameBorder = "border-[3px] border-[#7c1e1e]/50 rounded-[22px]";
  const panelGlass =
    "bg-[rgba(36,24,19,0.72)] border border-amber-900/30 backdrop-blur-md";

  return (
    <div
      ref={hostRef}
      className={`min-h-screen ${parchmentBg} from-[#1b1410] via-[#1b1410] to-[#1b1410] text-amber-100 relative overflow-hidden`}
      style={{
        // subtle vignette
        backgroundImage:
          "radial-gradient(800px 500px at 50% -10%, rgba(244,228,177,0.18), transparent), radial-gradient(700px 400px at 30% 120%, rgba(124,30,30,0.16), transparent)",
      }}
    >
      {/* Enchanted styles */}
      <style>{`
        /* candlelike shimmer */
        @keyframes candleGlow {
          0% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35); }
          50% { text-shadow: 0 0 22px rgba(212,175,55,0.85), 0 0 6px rgba(255,235,195,0.55); }
          100% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35); }
        }
        /* subtle parchment jitter + hue twinkle */
        @keyframes runeShimmer {
          0% { transform: translate(0,0) skew(0deg); filter: hue-rotate(0deg) saturate(105%); }
          25% { transform: translate(0.4px,-0.4px) skew(0.1deg); }
          50% { transform: translate(-0.4px,0.3px) skew(-0.08deg); }
          75% { transform: translate(0.3px,0.4px) skew(0.06deg); }
          100% { transform: translate(0,0) skew(0deg); filter: hue-rotate(0deg) saturate(105%); }
        }
        .glitching { animation: runeShimmer 140ms infinite steps(2,end); }
        .glow { animation: candleGlow 2.4s ease-in-out infinite; }

        /* wax-seal corners */
        .seal-corners:before,
        .seal-corners:after {
          content: "";
          position: absolute;
          width: 18px; height: 18px;
          background: radial-gradient(circle at 30% 30%, #8b2323, #5c1414 60%, #2d0a0a 100%);
          border-radius: 50%;
          box-shadow: 0 0 8px rgba(124,30,30,0.6);
        }
        .seal-corners:before { top: -10px; left: -10px; }
        .seal-corners:after  { bottom: -10px; right: -10px; }
      `}</style>

      {/* Header — hidden in fullscreen */}
      {!isFullscreen && (
        <AdminHeader title={"Accio Winner!"}>
          <button
            onClick={() =>
              isFullscreen ? exitFullscreen() : enterFullscreen()
            }
            className="px-3 py-1.5 rounded-lg border border-amber-900/40 bg-amber-950/30 text-[13px] hover:bg-amber-950/40"
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-[#7c1e1e] hover:bg-[#8f2525] border border-amber-900/40 text-[13px] font-semibold"
            aria-expanded={isMenuOpen}
            aria-controls="gacha-controls"
          >
            {isMenuOpen ? "Close Menu" : "Open Menu"}
          </button>
        </AdminHeader>
      )}

      {/* Fullscreen FAB */}
      {isFullscreen && (
        <button
          onClick={() => setIsMenuOpen((v) => !v)}
          className="fixed z-[10000] right-4 bottom-4 rounded-full p-3 bg-[rgba(36,24,19,0.75)] border border-amber-900/40 shadow-lg text-amber-100 opacity-85 hover:opacity-100 backdrop-blur-md"
          aria-label={isMenuOpen ? "Close Menu" : "Open Menu"}
          aria-expanded={isMenuOpen}
          aria-controls="gacha-controls"
        >
          {isMenuOpen ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="12" x2="20" y2="12"></line>
              <line x1="4" y1="18" x2="20" y2="18"></line>
            </svg>
          )}
        </button>
      )}

      {/* Menu */}
      <AnimatePresence initial={false}>
        {isMenuOpen && (
          <>
            <motion.button
              key="menu-backdrop"
              onClick={() => setIsMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/40"
              aria-label="Close menu"
            />
            <motion.aside
              key="menu-panel"
              initial={{ x: -340, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -340, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className={`fixed left-0 top-0 bottom-0 z-[9999] w-[320px] max-w-[85vw] ${panelGlass} p-6 overflow-y-auto`}
              role="dialog"
              aria-modal="true"
              aria-label="Gacha Controls"
              id="gacha-controls"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-amber-100/90 font-[Cinzel,serif]">
                    Enchanted Controls
                  </h2>
                  <button
                    ref={menuFirstButtonRef}
                    onClick={() => setIsMenuOpen(false)}
                    className="px-2.5 py-1 rounded-md border border-amber-900/40 bg-amber-950/30 text-xs hover:bg-amber-950/40"
                  >
                    Close
                  </button>
                </div>

                {error && (
                  <div className="text-xs rounded-md border border-red-900/40 bg-red-950/30 text-red-200 p-2">
                    {error}
                  </div>
                )}

                {/* Gift picker */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-amber-300/70 mb-2">
                    Gift
                  </div>
                  <div className="space-y-2 max-h-56 overflow-auto pr-1">
                    {loading && (
                      <div className="text-xs text-amber-200/80">Loading…</div>
                    )}
                    {!loading && gifts.length === 0 && (
                      <div className="text-xs text-amber-200/70">
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
                            disabled ? "opacity-60" : ""
                          } ${
                            selectedGift === g.id
                              ? "border-amber-500/50 bg-amber-900/20"
                              : "border-amber-900/30 bg-amber-950/10 hover:bg-amber-950/20"
                          }`}
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
                            <div className="font-medium font-[Crimson Pro,serif]">
                              {g.name}
                            </div>
                          </div>
                          <div className="tabular-nums text-amber-200/80">
                            {g.awarded}/{g.quantity}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <div className="mt-2">
                    <button
                      onClick={load}
                      className="text-xs px-2.5 py-1 rounded-md border border-amber-900/40 bg-amber-950/30 hover:bg-amber-950/40"
                    >
                      Reload Gifts
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-amber-900/40 pt-4">
                  <div className="text-[11px] uppercase tracking-wider text-amber-300/70 mb-2">
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
                      className="px-3 py-2 rounded-md bg-[#7c1e1e] hover:bg-[#8f2525] border border-amber-900/40 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
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
                      className="px-3 py-2 rounded-md bg-amber-950/30 hover:bg-amber-950/40 border border-amber-900/40 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Refresh Winner
                    </button>
                    <button
                      onClick={saveWinner}
                      disabled={loading || !preview || !selectedGift}
                      className="px-3 py-2 rounded-md bg-emerald-700/80 hover:bg-emerald-700 border border-emerald-900/40 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Save Winner
                    </button>
                  </div>
                </div>

                {/* Preview */}
                <div className="border-t border-amber-900/40 pt-4">
                  <div className="text-[11px] uppercase tracking-wider text-amber-300/70 mb-2">
                    Preview
                  </div>
                  {preview ? (
                    <div className="text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-amber-200/80">Name:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium font-[Crimson Pro,serif]">
                            {showPreviewName ? preview.name : "Hidden"}
                          </span>
                          <button
                            onClick={() => setShowPreviewName((v) => !v)}
                            className="px-2 py-0.5 text-xs rounded border border-amber-900/40 bg-amber-950/20 hover:bg-amber-950/30"
                          >
                            {showPreviewName ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <div className="font-mono text-[13px] break-words">
                        <span className="text-amber-200/80">Code:</span>{" "}
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
                    <div className="text-xs text-amber-200/70">
                      No winner preview yet.
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Stage */}
      <main className="px-4 py-8 min-h-screen flex items-center justify-center">
        <section className={`relative w-full max-w-4xl p-0 bg-transparent`}>
          {/* Ornate frame */}
          <div
            className={`absolute inset-0 -z-10 opacity-[0.12] pointer-events-none bg-[linear-gradient(0deg,rgba(212,175,55,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.18)_1px,transparent_1px)] bg-[size:42px_42px]`}
          />
          <div className={`relative ${frameBorder} seal-corners`} />

          <div className="w-full grid place-items-center px-4 py-8 text-center">
            <AnimatePresence mode="wait">
              {!preview ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="text-amber-200/90"
                >
                  <div className="text-4xl font-black tracking-tight font-[Cinzel,serif]">
                    Ready your wands
                  </div>
                  <p className="mt-2 opacity-85 font-[Crimson Pro,serif]">
                    Check your owl-post for the{" "}
                    <span className="font-semibold">Winner’s Code</span>.
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
                    className="text-lg md:text-2xl font-bold tracking-wider text-amber-100 drop-shadow mb-4 font-[Cinzel,serif]"
                  >
                    {selectedGiftObj?.name}
                  </motion.div>

                  {/* Prefix */}
                  <div className="mt-1 font-mono text-amber-300/95">
                    <span
                      className={`text-xl md:text-3xl inline-block px-2 ${
                        isGlitchingPrefix ? "glitching glow" : "glow"
                      }`}
                    >
                      {(() => {
                        const { prefix } = splitCode(preview?.gacha_code);
                        return prefix ? prefixDisplay : "********";
                      })()}
                    </span>
                    <span className="opacity-50">-</span>
                  </div>

                  {/* Suffix scroll */}
                  <div className="mt-3">
                    <motion.div
                      key={suffixDisplay}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                      className={`inline-block px-6 py-4 rounded-2xl font-mono text-4xl md:text-6xl tracking-[0.2em] select-none text-amber-50 shadow-xl ${panelGlass} ${
                        isGlitchingSuffix ? "glitching glow" : "glow"
                      }`}
                      style={{
                        borderWidth: 2,
                        borderColor: "rgba(120, 53, 15, 0.45)", // amber-900-ish
                      }}
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

      {/* Soft success banner */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10001] px-4 py-2 rounded-lg bg-[#7c1e1e] border border-amber-900/40 text-amber-100 shadow-lg font-[Crimson Pro,serif]"
            role="status"
            aria-live="polite"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
