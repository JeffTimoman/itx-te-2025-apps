"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import authFetch from "../../../lib/api/client";
import AdminHeader from "../../../components/AdminHeader";
import { motion, AnimatePresence } from "framer-motion";

// Cross-tab messaging for controller -> display
type GachaMsg =
  | { type: "hello" }
  | { type: "state-request" }
  | { type: "state"; payload: Record<string, unknown> }
  | {
      type: "command";
      cmd:
        | "draw"
        | "refresh"
        | "refresh-slot"
        | "save"
        | "set-winners-count"
        | "set-gift-slot"
        | "toggle-fullscreen"
        | "audio"
        | "reveal-names"; // NEW
      payload?: Record<string, unknown>;
    }
  | { type: "goodbye" };

/**
 * GachaPage — parchment + candlelight + AUDIO (Harry Potter vibe)
 *
 * Audio engine + reveal flow
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

// Shortened timings for snappier winner reveals
const GLITCH_MS_FIRST_PREFIX = 1200;
const GLITCH_MS_FIRST_SUFFIX = 3000;
const GLITCH_MS_REFRESH_PREFIX = 300;
const GLITCH_MS_REFRESH_SUFFIX = 800;

const DECODE_MS_FIRST_PREFIX = 220;
const DECODE_MS_FIRST_SUFFIX = 600;
const DECODE_MS_REFRESH_PREFIX = 120;
const DECODE_MS_REFRESH_SUFFIX = 200;

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

  async ensureCtx() {
    if (!this.ctx) {
      const audioWindow = window as Window & {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctx = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
      if (!Ctx) return;

      this.ctx = new Ctx();
      try {
        if (this.ctx.state === "suspended") await this.ctx.resume();
      } catch {}

      this.masterGain = this.ctx.createGain();
      this.lowpass = this.ctx.createBiquadFilter();
      this.lowpass.type = "lowpass";
      this.lowpass.frequency.value = 18000;

      if (this.lowpass && this.masterGain && this.ctx)
        this.lowpass.connect(this.masterGain);
      if (this.masterGain && this.ctx)
        this.masterGain.connect(this.ctx.destination);

      if (this.masterGain && this.ctx)
        this.masterGain.gain.setValueAtTime(
          this.muted ? 0 : this.volume,
          this.ctx.currentTime
        );

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
            this.buffers[key] = null;
          }
        })
      );
    }

    try {
      if (this.ctx?.state === "suspended") await this.ctx.resume();
    } catch {}
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      } catch {}
      this.masterGain.gain.setValueAtTime(
        m ? 0 : this.volume,
        this.ctx.currentTime
      );
    }
  }

  setVolume(v: number) {
    const vv = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    this.volume = vv;
    if (!this.masterGain || !this.ctx) return;
    try {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    } catch {}
    this.masterGain.gain.setValueAtTime(
      this.muted ? 0 : vv,
      this.ctx.currentTime
    );
  }

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
    g.connect(this.lowpass!);
    o.start();
    o.frequency.exponentialRampToValueAtTime(
      60,
      this.ctx.currentTime + duration
    );
    o.stop(this.ctx.currentTime + duration + 0.05);
  }

  synthTick() {
    if (!this.ctx || !this.lowpass) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g);
    g.connect(this.lowpass!);
    o.start();
    o.stop(this.ctx.currentTime + 0.06);
  }

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

  sweepOpen(ms = 1500) {
    if (!this.ctx || !this.lowpass) return;
    const now = this.ctx.currentTime;
    this.lowpass.frequency.cancelScheduledValues(now);
    this.lowpass.frequency.setValueAtTime(800, now);
    this.lowpass.frequency.exponentialRampToValueAtTime(18000, now + ms / 1000);
  }
}

const audioKit = new AudioKit();

export default function GachaPageMain() {
  // data
  const [gifts, setGifts] = useState<GiftAvail[]>([]);
  const [winnersCount, setWinnersCount] = useState<number>(1);
  const MAX_SLOTS = 4;
  const [selectedGiftsArr, setSelectedGiftsArr] = useState<number[]>([]);
  const [previews, setPreviews] = useState<Array<PreviewWinner | null>>(
    Array(MAX_SLOTS).fill(null)
  );

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

  // NEW: per-slot preview name visibility (externalizable)
  const [showPreviewNameArr, setShowPreviewNameArr] = useState<boolean[]>(
    Array(MAX_SLOTS).fill(false)
  );

  // audio controls
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);

  // code animation
  const [prefixDisplays, setPrefixDisplays] = useState<string[]>(
    Array(MAX_SLOTS).fill("CCCC2025")
  );
  const [suffixDisplays, setSuffixDisplays] = useState<string[]>(
    Array(MAX_SLOTS).fill("**********")
  );
  const [isGlitchingPrefixes, setIsGlitchingPrefixes] = useState<boolean[]>(
    Array(MAX_SLOTS).fill(false)
  );
  const [isGlitchingSuffixes, setIsGlitchingSuffixes] = useState<boolean[]>(
    Array(MAX_SLOTS).fill(false)
  );

  const hostRef = useRef<HTMLDivElement | null>(null);
  const menuFirstButtonRef = useRef<HTMLButtonElement | null>(null);

  // cross-tab
  const chanRef = useRef<BroadcastChannel | null>(null);
  const controlWinRef = useRef<Window | null>(null);
  const handlerRef = useRef<((m: GachaMsg) => Promise<void>) | null>(null);
  const pickRandomRef = useRef<typeof pickRandom | null>(null);
  const pickRandomSlotRef = useRef<typeof pickRandomSlot | null>(null);
  const saveWinnerRef = useRef<typeof saveWinner | null>(null);
  const enterFsRef = useRef<() => Promise<void> | null>(null);
  const exitFsRef = useRef<() => Promise<void> | null>(null);

  // timers
  const prefixTimer = useRef<Array<number | null>>(Array(MAX_SLOTS).fill(null));
  const suffixTimer = useRef<Array<number | null>>(Array(MAX_SLOTS).fill(null));

  // confetti
  const confettiInstanceRef = useRef<
    import("canvas-confetti").ConfettiFn | null
  >(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
      const sorted = (data || []).slice().sort((a: GiftAvail, b: GiftAvail) =>
        String(a.name || "").localeCompare(String(b.name || ""), undefined, {
          sensitivity: "base",
        })
      );
      setGifts(sorted);
      if (
        (!selectedGiftsArr || selectedGiftsArr.length === 0) &&
        sorted.length
      ) {
        const first = sorted[0].id;
        setSelectedGiftsArr(Array(MAX_SLOTS).fill(first));
      }
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }, [selectedGiftsArr]);

  useEffect(() => {
    load();
  }, [load]);

  // fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  useEffect(() => {
    setIsMenuOpen(Boolean(isFullscreen));
  }, [isFullscreen]);

  // —— State publisher: now includes showPreviewNameArr
  const postState = useCallback(() => {
    chanRef.current?.postMessage({
      type: "state",
      payload: {
        gifts,
        winnersCount,
        selectedGiftsArr,
        previews,
        showPreviewNameArr, // NEW
        muted,
        volume,
        isFullscreen,
        loading,
      },
    } as GachaMsg);
  }, [
    gifts,
    winnersCount,
    selectedGiftsArr,
    previews,
    showPreviewNameArr,
    muted,
    volume,
    isFullscreen,
    loading,
  ]);

  function openControlTab() {
    const w = window.open("/admin/gacha/control", "gacha-control");
    controlWinRef.current = w;
    w?.focus();
    setTimeout(() => postState(), 500);
  }

  // —— Command handler: now supports "reveal-names"
  useEffect(() => {
    handlerRef.current = async (m: GachaMsg) => {
      if (m.type !== "command") return;
      try {
        switch (m.cmd) {
          case "draw":
            await pickRandomRef.current?.(Boolean(m.payload?.spectacular));
            break;
          case "refresh":
            await pickRandomRef.current?.(false);
            break;
          case "refresh-slot":
            await pickRandomSlotRef.current?.(
              false,
              Number(m.payload?.slot ?? 0)
            );
            break;
          case "save":
            await saveWinnerRef.current?.();
            break;
          case "set-winners-count":
            setWinnersCount(Number(m.payload?.count ?? 1));
            break;
          case "set-gift-slot": {
            const { slot, giftId } = m.payload || {};
            setSelectedGiftsArr((s) => {
              const c = [...s];
              c[Number(slot)] = Number(giftId);
              return c;
            });
            break;
          }
          case "toggle-fullscreen": {
            if (isFullscreen) await exitFsRef.current?.();
            else await enterFsRef.current?.();
            break;
          }
          case "audio": {
            const { mute, volume: vol } = m.payload || {};
            if (typeof mute === "boolean") {
              setMuted(mute);
              await audioKit.ensureCtx();
              audioKit.setMuted(mute);
            }
            if (typeof vol === "number") {
              const v = Math.max(0, Math.min(1, vol));
              setVolume(v);
              await audioKit.ensureCtx();
              audioKit.setVolume(v);
            }
            break;
          }
          case "reveal-names": {
            // NEW: accept per-slot or all
            const { slot, show, all } = (m.payload || {}) as {
              slot?: number;
              show?: boolean;
              all?: boolean;
            };
            if (typeof slot === "number") {
              setShowPreviewNameArr((arr) => {
                const c = [...arr];
                c[slot] = typeof show === "boolean" ? show : !c[slot];
                return c;
              });
            } else if (typeof all === "boolean") {
              setShowPreviewNameArr((arr) => {
                const c = [...arr];
                for (let i = 0; i < winnersCount; i++) c[i] = all;
                return c;
              });
            }
            break;
          }
          default:
            break;
        }
      } catch {}
      postState();
    };
  }, [isFullscreen, winnersCount, postState]);

  // channel lifecycle
  useEffect(() => {
    const chan = new BroadcastChannel("gacha-control");
    chanRef.current = chan;

    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data as GachaMsg;
      if (!msg) return;
      if (msg.type === "state-request") postState();
      else if (msg.type === "command") void handlerRef.current?.(msg);
    };

    chan.addEventListener("message", onMsg);
    chan.postMessage({ type: "hello" } as GachaMsg);

    return () => {
      try {
        chan.postMessage({ type: "goodbye" } as GachaMsg);
      } catch {}
      chan.removeEventListener("message", onMsg);
      chan.close();
      chanRef.current = null;
    };
  }, [postState]);

  useEffect(() => {
    postState();
  }, [postState]);

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

  function splitCode(code?: string | null): { prefix: string; suffix: string } {
    if (!code) return { prefix: "", suffix: "" };
    const [preRaw = "", sufRaw = ""] = code.split("-");
    const prefix = preRaw.slice(0, 8);
    const digits = (sufRaw.match(/\d/g) || []).join("").slice(0, SUFFIX_LEN);
    const suffix = digits.padEnd(SUFFIX_LEN, "0");
    return { prefix, suffix };
  }

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
    const pTimers = prefixTimer.current.slice();
    const sTimers = suffixTimer.current.slice();
    return () => {
      pTimers.forEach((t) => t && window.clearTimeout(t));
      sTimers.forEach((t) => t && window.clearTimeout(t));
      removeConfettiCanvas();
    };
  }, []);

  const resetGacha = useCallback(() => {
    prefixTimer.current.forEach((t, i) => {
      if (t) window.clearTimeout(t);
      prefixTimer.current[i] = null;
    });
    suffixTimer.current.forEach((t, i) => {
      if (t) window.clearTimeout(t);
      suffixTimer.current[i] = null;
    });
    setPreviews(Array(MAX_SLOTS).fill(null));
    setStage("idle");
    setRevealDone(false);
    setIsGlitchingPrefixes(Array(MAX_SLOTS).fill(false));
    setIsGlitchingSuffixes(Array(MAX_SLOTS).fill(false));
    setPrefixDisplays(Array(MAX_SLOTS).fill("CCCC2025"));
    setSuffixDisplays(Array(MAX_SLOTS).fill("**********"));
    setShowPreviewNameArr(Array(MAX_SLOTS).fill(false));
    removeConfettiCanvas();
    audioKit.stopLoop("drumloop");
  }, []);

  // Per-slot glitch reveal
  function glitchRevealSlot({
    slot,
    target,
    spectacular,
    isDigitsOnly,
    phase,
    onDone,
  }: {
    slot: number;
    target: string;
    spectacular: boolean;
    isDigitsOnly: boolean;
    phase: "prefix" | "suffix";
    onDone?: () => void;
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
    setIsGlitchingPrefixes((p) => {
      const copy = [...p];
      if (phase === "prefix") copy[slot] = true;
      return copy;
    });
    setIsGlitchingSuffixes((p) => {
      const copy = [...p];
      if (phase === "suffix") copy[slot] = true;
      return copy;
    });

    const tick = () => {
      const now = performance.now();
      const elapsed = now - start;

      if (elapsed < GLITCH_MS) {
        const scrambled = Array.from(
          { length: target.length },
          () => alphabet[Math.floor(Math.random() * alphabet.length)]
        ).join("");
        if (phase === "prefix") {
          setPrefixDisplays((s) => {
            const copy = [...s];
            copy[slot] = scrambled;
            return copy;
          });
        } else {
          setSuffixDisplays((s) => {
            const copy = [...s];
            copy[slot] = scrambled;
            return copy;
          });
        }
        const delay = spectacular ? 36 : 28;
        const handle = window.setTimeout(tick, delay);
        if (phase === "prefix") prefixTimer.current[slot] = handle;
        else suffixTimer.current[slot] = handle;
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
      if (phase === "prefix") {
        setPrefixDisplays((s) => {
          const copy = [...s];
          copy[slot] = decoded;
          return copy;
        });
      } else {
        setSuffixDisplays((s) => {
          const copy = [...s];
          copy[slot] = decoded;
          return copy;
        });
      }

      if (t < 1) {
        const delay = spectacular ? 30 : 22;
        const handle = window.setTimeout(tick, delay);
        if (phase === "prefix") prefixTimer.current[slot] = handle;
        else suffixTimer.current[slot] = handle;
      } else {
        if (phase === "prefix") {
          setIsGlitchingPrefixes((p) => {
            const copy = [...p];
            copy[slot] = false;
            return copy;
          });
        }
        if (phase === "suffix") {
          setIsGlitchingSuffixes((p) => {
            const copy = [...p];
            copy[slot] = false;
            return copy;
          });
        }
        onDone?.();
      }
    };

    tick();
  }

  function startRevealSequenceSlot(
    slot: number,
    prefix: string,
    suffix: string,
    spectacular: boolean,
    onDoneAll?: () => void
  ) {
    setRevealDone(false);
    setPrefixDisplays((s) => {
      const copy = [...s];
      copy[slot] = prefix ? "********" : "";
      return copy;
    });
    setSuffixDisplays((s) => {
      const copy = [...s];
      copy[slot] = "**********";
      return copy;
    });
    audioKit.sweepOpen(spectacular ? 2000 : 1000);

    glitchRevealSlot({
      slot,
      target: prefix,
      spectacular,
      isDigitsOnly: false,
      phase: "prefix",
      onDone: () => {
        glitchRevealSlot({
          slot,
          target: suffix,
          spectacular,
          isDigitsOnly: true,
          phase: "suffix",
          onDone: () => {
            audioKit.play(spectacular ? "fanfare" : "chime");
            burstConfetti(spectacular ? "big" : "small");
            onDoneAll?.();
          },
        });
      },
    });
  }

  async function pickRandom(spectacular: boolean) {
    const slots = winnersCount;
    const selection = selectedGiftsArr.slice(0, slots);
    if (selection.length < slots)
      return setError("Select gifts for all winner slots");
    setError(null);
    setLoading(true);
    setStage("drawing");
    setRevealDone(false);
    setIsMenuOpen(false);

    try {
      // Check eligible registrants
      const regRes = await authFetch(`/api/admin/registrants`);
      if (!regRes.ok) throw await regRes.json();
      const regs = (await regRes.json()) as Array<{
        id: number;
        name: string;
        gacha_code?: string | null;
        is_verified?: string | null;
        is_win?: string | null;
      }>;
      const eligible = (regs || []).filter(
        (r) => r.is_verified === "Y" && r.is_win === "N" && r.gacha_code
      );
      if ((eligible || []).length < slots) {
        setError(
          `Not enough eligible registrants (${eligible.length}) for ${slots} winner(s)`
        );
        setStage("idle");
        setLoading(false);
        return;
      }

      // gift availability per selection (allow duplicates)
      const remMap = new Map<number, number>();
      for (const g of gifts)
        remMap.set(g.id, Math.max(0, (g.quantity ?? 0) - (g.awarded ?? 0)));
      const needMap = new Map<number, number>();
      for (const gid of selection)
        needMap.set(gid, (needMap.get(gid) || 0) + 1);
      for (const [gid, need] of needMap.entries()) {
        const avail = remMap.get(gid) || 0;
        if (avail < need) {
          const gname = gifts.find((x) => x.id === gid)?.name || String(gid);
          setError(
            `Not enough quantity for gift "${gname}" (need ${need}, available ${avail})`
          );
          setStage("idle");
          setLoading(false);
          return;
        }
      }

      await audioKit.ensureCtx();
      audioKit.setMuted(muted);
      audioKit.setVolume(volume);
      audioKit.startLoop("drumloop", { gain: spectacular ? 0.8 : 0.6 });
      audioKit.play("whoosh");

      // pick unique winners by calling endpoint multiple times
      const picked: Array<PreviewWinner | null> = Array(MAX_SLOTS).fill(null);
      const pickedIds = new Set<number>();
      for (let i = 0; i < slots; i++) {
        const attempts = 10;
        let found: PreviewWinner | null = null;
        for (let a = 0; a < attempts; a++) {
          const gid = selection[i];
          const res = await authFetch(`/api/admin/gifts/${gid}/random-winner`, {
            method: "POST",
          });
          if (!res.ok) continue;
          const data = (await res.json()) as PreviewWinner;
          if (!data) continue;
          if (!pickedIds.has(data.id)) {
            found = data;
            pickedIds.add(data.id);
            break;
          }
        }
        if (!found) {
          setError("Failed to pick unique winners after several attempts");
          setStage("idle");
          setLoading(false);
          audioKit.stopLoop("drumloop");
          return;
        }
        picked[i] = found;
      }

      setPreviews((p) => {
        const copy = [...p];
        for (let i = 0; i < slots; i++) copy[i] = picked[i];
        return copy;
      });
      // hide names by default
      setShowPreviewNameArr(Array(MAX_SLOTS).fill(false));

      const nextStage = spectacular ? "reveal" : "refresh-reveal";
      setStage(nextStage);

      // start reveals with small stagger
      let finished = 0;
      for (let i = 0; i < slots; i++) {
        const data = picked[i]!;
        const { prefix, suffix } = splitCode(data.gacha_code || "");
        startRevealSequenceSlot(
          i,
          prefix || "********",
          suffix || "0000000000",
          spectacular,
          () => {
            finished += 1;
            if (finished === slots) {
              setRevealDone(true);
              audioKit.stopLoop("drumloop");
            }
          }
        );
        await new Promise((r) => setTimeout(r, 120));
      }
    } catch (e) {
      setError(toMsg(e));
      setStage("idle");
      setIsGlitchingPrefixes(Array(MAX_SLOTS).fill(false));
      setIsGlitchingSuffixes(Array(MAX_SLOTS).fill(false));
      setRevealDone(true);
      audioKit.stopLoop("drumloop");
    } finally {
      setLoading(false);
    }
  }

  async function pickRandomSlot(spectacular: boolean, slot: number) {
    const gid = selectedGiftsArr[slot];
    if (!gid) return setError("Select a gift for this slot");
    setError(null);
    setLoading(true);
    setStage("drawing");
    setRevealDone(false);
    setIsMenuOpen(false);

    try {
      const regRes = await authFetch(`/api/admin/registrants`);
      if (!regRes.ok) throw await regRes.json();
      const regs = (await regRes.json()) as Array<{
        id: number;
        name: string;
        gacha_code?: string | null;
        is_verified?: string | null;
        is_win?: string | null;
      }>;
      const exclude = new Set<number>();
      previews.forEach((p, idx) => {
        if (p && idx !== slot) exclude.add(p.id);
      });
      const eligible = (regs || []).filter(
        (r) =>
          r.is_verified === "Y" &&
          r.is_win === "N" &&
          r.gacha_code &&
          !exclude.has(r.id)
      );
      if ((eligible || []).length < 1) {
        setError(`Not enough eligible registrants to refresh this slot`);
        setStage("idle");
        setLoading(false);
        return;
      }

      const giftObj = gifts.find((g) => g.id === gid);
      const avail = giftObj
        ? Math.max(0, (giftObj.quantity ?? 0) - (giftObj.awarded ?? 0))
        : 0;
      if (avail <= 0) {
        setError(`No remaining quantity for selected gift`);
        setStage("idle");
        setLoading(false);
        return;
      }

      await audioKit.ensureCtx();
      audioKit.setMuted(muted);
      audioKit.setVolume(volume);
      audioKit.startLoop("drumloop", { gain: spectacular ? 0.8 : 0.6 });
      audioKit.play("whoosh");

      const attempts = 10;
      let found: PreviewWinner | null = null;
      for (let a = 0; a < attempts; a++) {
        const res = await authFetch(`/api/admin/gifts/${gid}/random-winner`, {
          method: "POST",
        });
        if (!res.ok) continue;
        const data = (await res.json()) as PreviewWinner;
        if (!data) continue;
        if (!exclude.has(data.id)) {
          found = data;
          break;
        }
      }
      if (!found) {
        setError("Failed to pick a unique winner for this slot");
        setStage("idle");
        setLoading(false);
        audioKit.stopLoop("drumloop");
        return;
      }

      setPreviews((p) => {
        const copy = [...p];
        copy[slot] = found;
        return copy;
      });
      setShowPreviewNameArr((arr) => {
        const c = [...arr];
        c[slot] = false;
        return c;
      });

      const { prefix, suffix } = splitCode(found.gacha_code || "");
      setStage(spectacular ? "reveal" : "refresh-reveal");

      await new Promise<void>((resolve) => {
        startRevealSequenceSlot(
          slot,
          prefix || "********",
          suffix || "0000000000",
          spectacular,
          () => {
            audioKit.stopLoop("drumloop");
            setRevealDone(true);
            resolve();
          }
        );
      });
    } catch (e) {
      setError(toMsg(e));
      setStage("idle");
      setIsGlitchingPrefixes(Array(MAX_SLOTS).fill(false));
      setIsGlitchingSuffixes(Array(MAX_SLOTS).fill(false));
      setRevealDone(true);
      audioKit.stopLoop("drumloop");
    } finally {
      setLoading(false);
    }
  }

  async function saveWinner() {
    const slots = winnersCount;
    const selection = selectedGiftsArr.slice(0, slots);
    const picked = previews.slice(0, slots);
    if (picked.some((p) => !p)) return setError("No preview available");
    setLoading(true);
    setError(null);
    try {
      for (let i = 0; i < slots; i++) {
        const gid = selection[i];
        const registrant_id = picked[i]!.id;
        const res = await authFetch(`/api/admin/gifts/${gid}/save-winner`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrant_id }),
        });
        if (!res.ok) throw await res.json();
        await new Promise((r) => setTimeout(r, 120));
      }
      await load();
      setSuccess("Winners saved.");
      audioKit.play("chime");
      resetGacha();
      setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }

  // Keep refs updated
  (
    pickRandomRef as React.MutableRefObject<
      ((spectacular: boolean) => Promise<void>) | null
    >
  ).current = pickRandom;
  (
    pickRandomSlotRef as React.MutableRefObject<
      ((spectacular: boolean, slot: number) => Promise<void>) | null
    >
  ).current = pickRandomSlot;
  (
    saveWinnerRef as React.MutableRefObject<(() => Promise<void>) | null>
  ).current = saveWinner;
  (enterFsRef as React.MutableRefObject<(() => Promise<void>) | null>).current =
    enterFullscreen;
  (exitFsRef as React.MutableRefObject<(() => Promise<void>) | null>).current =
    exitFullscreen;

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
    try {
      const m = localStorage.getItem("gacha_muted");
      const v = localStorage.getItem("gacha_volume");
      if (m !== null) setMuted(m === "1");
      if (v !== null) setVolume(Number(v));
    } catch {}
    ensureConfettiInstance();
  }, []);

  // Theming tokens
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
        .glow-strong { animation: candleGlow 2.4s ease-in-out infinite; text-shadow: 0 0 28px rgba(212,175,55,0.95), 0 0 8px rgba(255,235,195,0.85); }
        .seal-corners:before, .seal-corners:after { content: ""; position: absolute; width: 18px; height: 18px; background: radial-gradient(circle at 30% 30%, #8b2323, #5c1414 60%, #2d0a0a 100%); border-radius: 50%; box-shadow: 0 0 8px rgba(124,30,30,0.6); }
        .seal-corners:before { top: -10px; left: -10px; }
        .seal-corners:after  { bottom: -10px; right: -10px; }
        .gacha-checkbox { accent-color: #d4af37; }
        .gacha-range { -webkit-appearance: none; appearance: none; background: transparent; }
        .gacha-range:focus { outline: none; }
        .gacha-range::-webkit-slider-runnable-track { height: 8px; background: rgba(212,175,55,0.14); border-radius: 999px; }
        .gacha-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -4px; background: #d4af37; border-radius: 999px; box-shadow: 0 0 8px rgba(212,175,55,0.45); }
        .gacha-range::-moz-range-track { height: 8px; background: rgba(212,175,55,0.14); border-radius: 999px; }
        .gacha-range::-moz-range-thumb { width: 16px; height: 16px; background: #d4af37; border-radius: 999px; box-shadow: 0 0 6px rgba(212,175,55,0.35); border: none; }
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
            onClick={() => openControlTab()}
            className="px-3 py-1.5 rounded-lg bg-[#7c1e1e] hover:bg-[#8f2525] border border-amber-900/40 text-[13px] font-semibold"
          >
            Open Control Tab
          </button>
        </AdminHeader>
      )}

      {/* Menu + everything else unchanged from your version, except the local eye-toggle remains available.
          (It now coexists with external reveal-names commands.) */}

      {/* … [UI below is exactly as in your version, omitted for brevity since logic above is the essential change] … */}

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
