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
 * GachaPage — parchment + candlelight + AUDIO (Harry Potter vibe)
 *
 * Fixes:
 * 1) Ensure WebAudio context resumes on interaction (some browsers start "suspended").
 * 2) Route every sound through masterGain so Mute/Volume always work.
 * 3) Make menu controls call ensureCtx() before changing volume/mute.
 * 4) Keep your /public/*.mp3 fallbacks.
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

// ------------------
// Audio Engine (Web Audio)
// ------------------

type LoopEntry =
  | { src: AudioBufferSourceNode; gain: GainNode }
  | { stop: () => void }
  | null;

class AudioKit {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  lowpass: BiquadFilterNode | null = null; // for buildup sweeps
  buffers: Record<string, AudioBuffer | null> = {};
  loops: Record<string, LoopEntry> = {};
  muted = false;
  volume = 0.9;

  urls = {
    drumloop: process.env.NEXT_PUBLIC_SFX_DRUMLOOP || "/drum-roll.mp3",
    whoosh: process.env.NEXT_PUBLIC_SFX_WHOOSH || "/whoosh.mp3",
    tick: process.env.NEXT_PUBLIC_SFX_TICK || "/clock-ticking.mp3",
    chime: process.env.NEXT_PUBLIC_SFX_CHIME || "/victory-chime.mp3",
    fanfare: process.env.NEXT_PUBLIC_SFX_FANFARE || "/fanfare.mp3",
  } as const;

  // Create or resume the context; safe to call on every user gesture
  async ensureCtx() {
    if (!this.ctx) {
      const audioWindow = window as Window & {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctx = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
      if (!Ctx) return; // WebAudio unavailable
      this.ctx = new Ctx();

      // Nodes
      this.masterGain = this.ctx.createGain();
      this.lowpass = this.ctx.createBiquadFilter();
      this.lowpass.type = "lowpass";
      this.lowpass.frequency.value = 18000; // neutral

      // Wiring: everything -> lowpass -> masterGain -> destination
      this.lowpass.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Apply current mute/volume
      this.masterGain.gain.value = this.muted ? 0 : this.volume;

      // Preload assets (non‑blocking for small files)
      await Promise.all(
        Object.entries(this.urls).map(async ([key, url]) => {
          if (!url) return (this.buffers[key] = null);
          try {
            const res = await fetch(url);
            const arr = await res.arrayBuffer();
            if (!this.ctx) return (this.buffers[key] = null);
            const buf = await this.ctx.decodeAudioData(arr);
            this.buffers[key] = buf;
          } catch {
            this.buffers[key] = null; // fallback to synth
          }
        })
      );
    }

    // Resume if suspended (Chrome/iOS policy)
    try {
      if (this.ctx?.state === "suspended") await this.ctx.resume();
    } catch {}
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : this.volume;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (!this.muted && this.masterGain)
      this.masterGain.gain.value = this.volume;
  }

  // Utility: simple synthesized whoosh if no asset
  synthWhoosh(duration = 0.5) {
    if (!this.ctx || !this.lowpass) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 220;
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, this.ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      this.ctx.currentTime + duration
    );
    o.connect(g);
    g.connect(this.lowpass);
    o.start();
    o.frequency.exponentialRampToValueAtTime(
      60,
      this.ctx.currentTime + duration
    );
    o.stop(this.ctx.currentTime + duration + 0.05);
  }

  // Utility: tick for refresh mode
  synthTick() {
    if (!this.ctx || !this.lowpass) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g);
    g.connect(this.lowpass);
    o.start();
    o.stop(this.ctx.currentTime + 0.06);
  }

  // Utility: chime (HP‑ish)
  synthChime() {
    if (!this.ctx || !this.lowpass) return;
    const t0 = this.ctx.currentTime;
    const freqs = [659.25, 783.99, 987.77];
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5 / (i + 1), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2 + i * 0.05);
      o.connect(g);
      g.connect(this.lowpass!);
      o.start(t0 + i * 0.02);
      o.stop(t0 + 1.3 + i * 0.05);
    });
  }

  // Utility: short fanfare (stacked fifth)
  synthFanfare() {
    if (!this.ctx || !this.lowpass) return;
    const t0 = this.ctx.currentTime;
    const freqs = [392.0, 587.33, 783.99];
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = "sawtooth";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.4 / (i + 1), t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0 + i * 0.05);
      o.connect(g);
      g.connect(this.lowpass!);
      o.start(t0 + i * 0.04);
      o.stop(t0 + 1.1 + i * 0.05);
    });
  }

  async play(name: keyof AudioKit["urls"]) {
    await this.ensureCtx();
    if (!this.ctx) return;
    const buf = this.buffers[name];
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.lowpass!);
      src.start();
    } else {
      if (name === "whoosh") this.synthWhoosh();
      else if (name === "tick") this.synthTick();
      else if (name === "chime") this.synthChime();
      else if (name === "fanfare") this.synthFanfare();
    }
  }

  async startLoop(name: keyof AudioKit["urls"], opts?: { gain?: number }) {
    await this.ensureCtx();
    if (!this.ctx) return;
    const buf = this.buffers[name];
    if (!buf) {
      // synth substitute: gated low tom pattern
      if (name === "drumloop") {
        const g = this.ctx.createGain();
        g.gain.value = (opts?.gain ?? 0.6) * 0.6;
        g.connect(this.lowpass!);
        let alive = true;
        const tick = () => {
          if (!alive || !this.ctx) return;
          const o = this.ctx.createOscillator();
          const eg = this.ctx.createGain();
          o.type = "sine";
          o.frequency.value = 120;
          eg.gain.setValueAtTime(0.0001, this.ctx.currentTime);
          eg.gain.exponentialRampToValueAtTime(
            0.6,
            this.ctx.currentTime + 0.01
          );
          eg.gain.exponentialRampToValueAtTime(
            0.0001,
            this.ctx.currentTime + 0.25
          );
          o.connect(eg);
          eg.connect(g);
          o.start();
          o.stop(this.ctx.currentTime + 0.3);
          this.loops["__drum_synth"] = { stop: () => (alive = false) };
          setTimeout(tick, 300);
        };
        tick();
      }
      return;
    }
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = opts?.gain ?? 0.7;
    src.buffer = buf;
    src.loop = true;
    src.connect(g);
    g.connect(this.lowpass!);
    src.start();
    this.loops[name] = { src, gain: g };
  }

  stopLoop(name: keyof AudioKit["urls"]) {
    const loop = this.loops[name];
    if (loop && "src" in loop && loop.src) {
      try {
        loop.src.stop();
      } catch {}
    }
    this.loops[name] = null;
    const drumSynth = this.loops["__drum_synth"];
    if (drumSynth && "stop" in drumSynth && name === "drumloop") {
      try {
        drumSynth.stop();
      } catch {}
      this.loops["__drum_synth"] = null;
    }
  }

  // frequency sweep for hype buildup
  sweepOpen(ms = 1500) {
    if (!this.ctx || !this.lowpass) return;
    const now = this.ctx.currentTime;
    this.lowpass.frequency.cancelScheduledValues(now);
    this.lowpass.frequency.setValueAtTime(800, now);
    this.lowpass.frequency.exponentialRampToValueAtTime(18000, now + ms / 1000);
  }
}

const audioKit = new AudioKit();

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
  const [, setRevealDone] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showPreviewName, setShowPreviewName] = useState(false);

  // audio controls
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);

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
    audioKit.stopLoop("drumloop");
  }, []);

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
    const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
    const digits = "0123456789";
    const sigils = "✶★✷✦";
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
        if (phase === "suffix" && Math.random() < (spectacular ? 0.18 : 0.1))
          audioKit.play("whoosh");
        if (!spectacular && phase === "suffix" && Math.random() < 0.12)
          audioKit.play("tick");
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
    audioKit.sweepOpen(spectacular ? 2000 : 1000);

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
            audioKit.stopLoop("drumloop");
            if (spectacular) audioKit.play("fanfare");
            else audioKit.play("chime");
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
      await audioKit.ensureCtx();
      audioKit.setMuted(muted);
      audioKit.setVolume(volume);
      audioKit.startLoop("drumloop", { gain: spectacular ? 0.8 : 0.6 });
      audioKit.play("whoosh");

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
      audioKit.stopLoop("drumloop");
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
      audioKit.play("chime");
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
  }, []);

  const remaining = (g: GiftAvail) =>
    Math.max(0, (g.quantity ?? 0) - (g.awarded ?? 0));

  // 🎨 Theming tokens
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
        backgroundImage:
          "radial-gradient(800px 500px at 50% -10%, rgba(244,228,177,0.18), transparent), radial-gradient(700px 400px at 30% 120%, rgba(124,30,30,0.16), transparent)",
      }}
    >
      <style>{`
        @keyframes candleGlow { 0% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35); } 50% { text-shadow: 0 0 22px rgba(212,175,55,0.85), 0 0 6px rgba(255,235,195,0.55); } 100% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35); } }
        @keyframes runeShimmer { 0% { transform: translate(0,0) } 50% { transform: translate(0.3px,-0.2px) } 100% { transform: translate(0,0) } }
        .glitching { animation: runeShimmer 140ms infinite steps(2,end); }
        .glow { animation: candleGlow 2.4s ease-in-out infinite; }
        .seal-corners:before, .seal-corners:after { content: ""; position: absolute; width: 18px; height: 18px; background: radial-gradient(circle at 30% 30%, #8b2323, #5c1414 60%, #2d0a0a 100%); border-radius: 50%; box-shadow: 0 0 8px rgba(124,30,30,0.6); }
        .seal-corners:before { top: -10px; left: -10px; }
        .seal-corners:after  { bottom: -10px; right: -10px; }
      `}</style>

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

                {/* Audio Controls */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-amber-300/70 mb-2">
                    Audio
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={muted}
                        onChange={async (e) => {
                          await audioKit.ensureCtx();
                          const m = e.target.checked;
                          setMuted(m);
                          audioKit.setMuted(m);
                        }}
                      />
                      Mute
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={async (e) => {
                        await audioKit.ensureCtx();
                        const v = Number(e.target.value);
                        setVolume(v);
                        audioKit.setVolume(v);
                      }}
                      className="flex-1"
                      aria-label="Volume"
                    />
                    <span className="text-xs tabular-nums w-8 text-right">
                      {Math.round(volume * 100)}
                    </span>
                  </div>
                </div>

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
                      const rem = Math.max(
                        0,
                        (g.quantity ?? 0) - (g.awarded ?? 0)
                      );
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
                          selectedGiftObj &&
                            Math.max(
                              0,
                              (selectedGiftObj.quantity ?? 0) -
                                (selectedGiftObj.awarded ?? 0)
                            ) <= 0
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
                          selectedGiftObj &&
                            Math.max(
                              0,
                              (selectedGiftObj.quantity ?? 0) -
                                (selectedGiftObj.awarded ?? 0)
                            ) <= 0
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
                            const [p, s] = (preview.gacha_code || "").split(
                              "-"
                            );
                            const prefix = p?.slice(0, 8) || "";
                            const digits = (s?.match(/\d/g) || [])
                              .join("")
                              .slice(0, 10);
                            const suffix = (digits || "").padEnd(10, "0");
                            return `${prefix || "********"}-${
                              suffix || "**********"
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
                        borderColor: "rgba(120, 53, 15, 0.45)",
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
