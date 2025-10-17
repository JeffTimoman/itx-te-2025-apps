"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import AdminHeader from "../../../components/AdminHeader";
import authFetch from "../../../lib/api/client";

/**
 * ClaimFoodScannerPage — styled like RegistrantsAdminPage
 * Improvements:
 * - Uses AdminHeader & glassy UI
 * - Clean camera lifecycle with pause/resume, auto-pause on popup
 * - Single BarcodeDetector instance (if available), jsQR fallback (lazy import)
 * - Throttled scans, duplicate suppression with cooldown window
 * - Tab visibility handling (auto-pause when hidden)
 * - Robust status messaging + toasts-like chips
 */
export default function ClaimFoodScannerPage() {
  type WindowWithBD = Window & { BarcodeDetector?: unknown };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  interface BarcodeDetectorLike {
    detect(source: HTMLVideoElement): Promise<Array<Record<string, unknown>>>;
  }
  type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

  const detectorRef = useRef<BarcodeDetectorLike | null>(null); // BarcodeDetector instance
  const intervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  type JsQRFn = (
    data: Uint8ClampedArray,
    width: number,
    height: number
  ) => { data: string } | null;

  const jsqrRef = useRef<JsQRFn | null>(null); // jsQR module
  // When the user explicitly stops the camera, set this to true so we don't
  // auto-restart (visibility / other handlers). Cleared when user starts.
  const userStopRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [paused, setPaused] = useState(false); // logical pause without tearing down UI
  const [lastDetected, setLastDetected] = useState<string>("");
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  const [popup, setPopup] = useState<null | {
    code: string;
    voucher: Record<string, unknown>;
    claimed?: boolean;
  }>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [busy, setBusy] = useState(false); // prevents concurrent validate/claim

  // --- Utils ---
  const now = () => Date.now();
  const setStatus = (msg: string) => setStatusMessage(msg);

  function clearTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  const ensureDetector = useCallback(async () => {
    // Force jsQR fallback on mobile devices (many mobile browsers have
    // unreliable BarcodeDetector implementations). We detect mobile via
    // a simple UA check.
    function isMobileUA() {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent || "";
      return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    }
    if (isMobileUA()) {
      console.debug("scanner:force jsQR on mobile UA");
      return null;
    }
    if (detectorRef.current) return detectorRef.current;
    const BD = (window as WindowWithBD).BarcodeDetector;
    if (BD) {
      try {
        const Ctor = BD as unknown as BarcodeDetectorCtor;
        detectorRef.current = new Ctor({
          formats: ["code_128", "code_39", "ean_13", "qr_code"],
        });
        return detectorRef.current;
      } catch {
        // If creation fails, fall through to jsQR fallback
        detectorRef.current = null;
      }
    }
    return null;
  }, []);

  // Camera controls are defined after the scanner loop to avoid hook dependency ordering issues

  // --- Backend ---
  function getMsgFromUnknown(d: unknown): string | undefined {
    if (!d || typeof d !== 'object') return undefined;
    const o = d as Record<string, unknown>;
    if (typeof o.error === 'string') return o.error;
    if (typeof o.message === 'string') return o.message;
    return undefined;
  }

  function getVoucherFromUnknown(d: unknown): Record<string, unknown> | undefined {
    if (!d || typeof d !== 'object') return undefined;
    const o = d as Record<string, unknown>;
    if (o.voucher && typeof o.voucher === 'object') return o.voucher as Record<string, unknown>;
    // if object itself resembles voucher, return it
    return o as Record<string, unknown>;
  }

  function voucherIsClaimed(v?: Record<string, unknown> | null): boolean {
    if (!v || typeof v !== "object") return false;
    const val = v["is_claimed"];
    return String(val ?? "") === "Y";
  }

  // pauseCamera is defined later with camera controls

  const validateCode = useCallback(async (code: string) => {
    try {
      const res = await authFetch(
        `/api/admin/food-vouchers/${encodeURIComponent(code)}`
      );
        let data: unknown = null;
        try {
          data = await res.json();
        } catch {
          // not JSON — try to read as text for debugging
          try {
            const txt = await res.text();
            data = { message: txt };
          } catch {
            data = null;
          }
        }
      if (!res.ok)
        return {
          ok: false,
          error: getMsgFromUnknown(data) || `${res.status} ${res.statusText}`,
        } as const;
      return {
        ok: true,
        voucher: (getVoucherFromUnknown(data) as Record<string, unknown>),
      } as const;
    } catch (err) {
      return { ok: false, error: String(err) } as const;
    }
  }, []);

  const claimCode = useCallback(async (code: string) => {
    try {
      const res = await authFetch(
        `/api/admin/food-vouchers/${encodeURIComponent(code)}/claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        try {
          const txt = await res.text();
          data = { message: txt };
        } catch {
          data = null;
        }
      }
      if (!res.ok)
        return {
          ok: false,
          error: getMsgFromUnknown(data) || `${res.status} ${res.statusText}`,
        } as const;
      return { ok: true, data } as const;
    } catch (err) {
      return { ok: false, error: String(err) } as const;
    }
  }, []);

  // pauseRef will be assigned to the real pauseCamera after camera controls
  const pauseRef = useRef<() => void>(() => {});

  // onDetected is stored in a ref so the scanner loop can call it without
  // creating circular hook dependencies. The function itself can use
  // stable callbacks like validateCode and will call pauseRef.current()
  const onDetectedRef = useRef<((raw: string) => Promise<void>) | null>(null);
  onDetectedRef.current = async (raw: string) => {
    console.debug("scanner:onDetectedRef", raw);
    const code = String(raw || "").trim();
    if (!code) return;
    // suppress duplicates & rapid fire
    const t = now();
    if (code === lastDetected && t < cooldownUntil) return;
    setLastDetected(code);
    setCooldownUntil(t + 1500);

    if (busy) return; // guard
    setBusy(true);
    setStatus(`Detected: ${code} — validating…`);
    const v = await validateCode(code);
    setBusy(false);

    if (!v.ok) {
      setStatus(`Invalid voucher: ${v.error || "not found"}`);
      return; // loop continues
    }
    // Open popup and pause camera until decision. We both
    // (a) perform an immediate inline pause to avoid races where pauseRef
    //     hasn't been assigned yet (effects run after render), and
    // (b) call pauseRef.current() for the canonical implementation.
    setPopup({ code, voucher: v.voucher });
    // immediate inline pause
    try {
      clearTimer();
      const s = streamRef.current;
      if (s) s.getVideoTracks().forEach((t) => (t.enabled = false));
      setPaused(true);
      setStatus("Paused");
    } catch {
      // ignore
    }
    // canonical pause (if present)
    try {
      pauseRef.current();
    } catch {
      // ignore
    }
  };

  // --- Scanner loop (throttled) ---
  const loop = useCallback(async () => {
    console.debug("scanner:loop entry", { scanning, paused });
    if (!scanning || paused) return;
    const video = videoRef.current;
    if (!video) return;

    // Prefer native API
    const detector = await ensureDetector();
    if (detector) {
      console.debug("scanner:using BarcodeDetector");
      try {
        const barcodes = await detector.detect(video);
        if (barcodes && barcodes.length > 0) {
          const b0 = barcodes[0] as Record<string, unknown>;
          const val = String(
            (b0.rawValue as string) || (b0.rawText as string) || (b0.raw_data as string) || ""
          );
          if (val && onDetectedRef.current) onDetectedRef.current(val);
        }
      } catch {
        // if detect fails repeatedly, fall back later
      }
      return;
    }

    // Fallback: jsQR (lazy load once)
      try {
        console.debug("scanner:using jsQR fallback");
        if (!jsqrRef.current) {
          const mod = await import("jsqr");
          // prefer default export if present, otherwise module itself is the function
          const maybe = (mod as { default?: JsQRFn }).default ?? (mod as unknown as JsQRFn);
          jsqrRef.current = maybe;
        }
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      if (!w || !h) return; // not ready yet

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const result = jsqrRef.current(imgData.data, w, h);
      if (result?.data && onDetectedRef.current) onDetectedRef.current(String(result.data));
      } catch {
        // ignore
      }
  }, [paused, scanning, ensureDetector]);

  // --- Camera controls (defined after loop) ---
  const startCamera = useCallback(async () => {
    if (userStopRef.current) return; // respect user stop
    console.debug("scanner:startCamera (attempt)");
    setStatus("Requesting camera permission…");
    try {
      const constraints = {
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      } as MediaStreamConstraints;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setScanning(true);
      setPaused(false);
      setStatus("Scanning…");
  console.debug("scanner:camera started", { video: !!videoRef.current, stream: !!streamRef.current });
      // start the scan loop
      clearTimer();
      intervalRef.current = window.setInterval(loop, 500);
    } catch (err) {
      console.error("Camera start failed", err);
      setStatus("Camera permission denied or unavailable");
      setScanning(false);
      setPaused(false);
    }
  }, [loop]);

  const stopCamera = useCallback(() => {
    console.debug("scanner:stopCamera");
    clearTimer();
    try {
      const s = streamRef.current;
      if (s) s.getTracks().forEach((t) => t.stop());
    } catch (e) {
      console.warn("stopCamera error", e);
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current = null;
    setScanning(false);
    setPaused(false);
    setStatus("Stopped");
  }, []);

  const pauseCamera = useCallback(() => {
    // Pause scanning loop & mute camera without fully tearing down
    clearTimer();
    const s = streamRef.current;
    if (s) s.getVideoTracks().forEach((t) => (t.enabled = false));
    setPaused(true);
    setStatus("Paused");
  }, []);

  const resumeCamera = useCallback(() => {
    const s = streamRef.current;
    if (!s) {
      // If stream is gone (e.g., tab suspended), restart fully
      if (!userStopRef.current) startCamera();
      return;
    }
    s.getVideoTracks().forEach((t) => (t.enabled = true));
    setPaused(false);
    setStatus("Scanning…");
    // resume loop
    clearTimer();
    intervalRef.current = window.setInterval(loop, 500);
  }, [startCamera, loop]);

  // ensure pauseRef.current points to the active pauseCamera implementation
  useEffect(() => {
    pauseRef.current = pauseCamera;
  }, [pauseCamera]);

  // spin was removed — we directly manage interval via clearTimer + setInterval

  // --- Lifecycle ---
  // start camera once on mount; avoid including startCamera/stopCamera in deps
  // because their identities change when loop/paused/scanning change which
  // would cause automatic restarts. We want mount-only behavior here.
  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // auto-pause when tab hidden; resume when visible
    function handleVis() {
      if (document.hidden) {
        if (scanning && !paused) pauseCamera();
      } else {
        if (scanning && paused && !popup) resumeCamera();
      }
    }
    document.addEventListener("visibilitychange", handleVis);
    return () => document.removeEventListener("visibilitychange", handleVis);
  }, [pauseCamera, resumeCamera, scanning, paused, popup]);

  // --- Popup actions ---
  const onCancel = useCallback(() => {
    setPopup(null);
    setStatus("Scanning…");
    setLastDetected("");
    if (scanning) resumeCamera();
  }, [resumeCamera, scanning]);

  const onClaim = useCallback(async () => {
    if (!popup?.code || busy) return;
    setBusy(true);
    setStatus("Claiming…");
    const r = await claimCode(popup.code);
    setBusy(false);
    if (!r.ok) {
      setStatus(`Claim failed: ${r.error || "error"}`);
      // stay paused but allow retry/close
      return;
    }
    setStatus("Claim successful 🎉");
    setPopup((prev) => (prev ? { ...prev, claimed: true } : prev));
    // After a short moment, close & resume
    setTimeout(() => {
      setPopup(null);
      setLastDetected("");
      setStatus("Scanning…");
      if (scanning) resumeCamera();
    }, 900);
  }, [popup, busy, resumeCamera, scanning, claimCode]);

  // --- UI ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      <AdminHeader title="Food Voucher Scanner">
        <button
          onClick={() => {
            if (scanning) {
              userStopRef.current = true;
              stopCamera();
            } else {
              userStopRef.current = false;
              startCamera();
            }
          }}
          className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15"
        >
          {scanning ? "Stop" : "Start"}
        </button>
        <button
          onClick={() => {
            setLastDetected("");
            setPopup(null);
            setStatus("Scanning…");
            if (scanning && paused && !popup) resumeCamera();
          }}
          className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15"
        >
          Reset
        </button>
      </AdminHeader>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Camera card */}
        <section className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="text-sm opacity-80">
              {paused ? "Paused" : scanning ? "Live" : "Idle"} ·{" "}
              {statusMessage || (scanning ? "Scanning…" : "")}
            </div>
            <div className="flex gap-2">
              {scanning && !paused ? (
                <button
                  onClick={pauseCamera}
                  className="text-[11px] px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/15"
                >
                  Pause
                </button>
              ) : (
                <button
                  onClick={resumeCamera}
                  className="text-[11px] px-2 py-1 rounded bg-white/10 border border-white/20 hover:bg-white/15"
                >
                  Resume
                </button>
              )}
            </div>
          </div>
          <div className="bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full max-h-[480px] object-contain bg-black"
            />
          </div>
        </section>

        {/* Tips card */}
        <section className="rounded-2xl p-4 border border-white/10 bg-white/5 text-sm text-slate-200/90">
          <div className="font-semibold mb-1">Tips</div>
          <ul className="list-disc pl-5 space-y-1 opacity-90">
            <li>Ensure good lighting and keep the code within the frame.</li>
            <li>
              We auto-pause the camera when a voucher is detected so you can
              decide to claim or cancel.
            </li>
            <li>Duplicate scans are throttled for 1.5s to avoid spam.</li>
          </ul>
        </section>
      </main>

      {/* Popup */}
      {popup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 text-slate-100 shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Voucher detected</h3>
              <button
                onClick={onCancel}
                className="text-xs px-2 py-1 rounded-lg bg-white/10 border border-white/20 hover:bg-white/15"
              >
                Close
              </button>
            </div>
            <div className="p-5 space-y-2">
              <div className="text-sm opacity-80">Code</div>
              <div className="font-mono break-all text-base">{popup.code}</div>
              <div className="text-sm opacity-80 mt-3">Status</div>
              <VoucherStatus voucher={popup.voucher} claimed={popup.claimed} />
            </div>
            <div className="p-5 border-t border-white/10 flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="text-[11px] px-3 py-1.5 rounded bg-white/10 border border-white/20 hover:bg-white/15"
              >
                Cancel
              </button>
              {!(voucherIsClaimed(popup.voucher) || popup.claimed) && (
                <button
                  onClick={onClaim}
                  disabled={busy}
                  className="relative inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-semibold bg-amber-500/90 hover:bg-amber-500 disabled:opacity-50"
                >
                  {busy && (
                    <span className="absolute left-3 h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  )}
                  {busy ? "Claiming…" : "Claim"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VoucherStatus({
  voucher,
  claimed,
}: {
  voucher: Record<string, unknown>;
  claimed?: boolean;
}) {
  const already = String(voucher?.["is_claimed"] || "") === "Y";
  const isClaimed = already || !!claimed;
  return (
    <span
      className={`inline-block px-2 py-1 rounded border text-[11px] ${
        isClaimed
          ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
          : "bg-white/10 text-slate-200 border-white/20"
      }`}
    >
      {isClaimed ? "Already claimed" : "Not claimed"}
    </span>
  );
}
