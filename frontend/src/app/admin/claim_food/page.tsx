"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import AdminHeader from "../../../components/AdminHeader";
import authFetch from "../../../lib/api/client";

/**
 * ClaimFoodScannerPage — working Barcode + QR scanner
 * Strategy:
 * 1) Try native BarcodeDetector each tick (fast, low-CPU) if available
 * 2) Otherwise start a continuous ZXing session (@zxing/browser) once
 * Cleanup & pause/resume are handled correctly.
 */
export default function ClaimFoodScannerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ZXing (browser) controls + reader
  const zxingReaderRef = useRef<any | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);
  const zxingStartedRef = useRef(false);

  // Native detector
  interface BarcodeDetectorLike {
    detect(source: CanvasImageSource): Promise<Array<{ rawValue?: string }>>;
  }
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const detectorReadyRef = useRef(false);

  // User action to prevent auto-restart after Stop
  const userStopRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lastDetected, setLastDetected] = useState<string>("");
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);

  const [popup, setPopup] = useState<null | {
    code: string;
    voucher: Record<string, unknown>;
    claimed?: boolean;
  }>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const now = () => Date.now();
  const setStatus = (msg: string) => setStatusMessage(msg);

  function clearTimer() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // -------- Backend helpers --------
  function getMsgFromUnknown(d: unknown): string | undefined {
    if (!d || typeof d !== "object") return undefined;
    const o = d as Record<string, unknown>;
    if (typeof o.error === "string") return o.error;
    if (typeof o.message === "string") return o.message;
    return undefined;
  }

  function getVoucherFromUnknown(
    d: unknown
  ): Record<string, unknown> | undefined {
    if (!d || typeof d !== "object") return undefined;
    const o = d as Record<string, unknown>;
    if (o.voucher && typeof o.voucher === "object")
      return o.voucher as Record<string, unknown>;
    return o as Record<string, unknown>;
  }

  function voucherIsClaimed(v?: Record<string, unknown> | null): boolean {
    if (!v || typeof v !== "object") return false;
    const val = v["is_claimed"];
    return String(val ?? "") === "Y";
  }

  const validateCode = useCallback(async (code: string) => {
    try {
      const res = await authFetch(
        `/api/admin/food-vouchers/${encodeURIComponent(code)}`
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
      return { ok: true, voucher: getVoucherFromUnknown(data)! } as const;
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

  // Pause ref for use inside onDetected
  const pauseRef = useRef<() => void>(() => {});

  const onDetectedRef = useRef<((raw: string) => Promise<void>) | null>(null);
  onDetectedRef.current = async (raw: string) => {
    const code = String(raw || "").trim();
    if (!code) return;
    const t = now();
    if (code === lastDetected && t < cooldownUntil) return;

    setLastDetected(code);
    setCooldownUntil(t + 1500);

    if (busy) return;
    setBusy(true);
    setStatus(`Detected: ${code} — validating…`);
    const v = await validateCode(code);
    setBusy(false);

    if (!v.ok) {
      setStatus(`Invalid voucher: ${v.error || "not found"}`);
      return;
    }

    // Open popup and pause
    setPopup({ code, voucher: v.voucher });
    // inline pause
    try {
      clearTimer();
      const s = streamRef.current;
      if (s) s.getVideoTracks().forEach((t) => (t.enabled = false));
      // stop ZXing loop while paused
      stopZxing();
      setPaused(true);
      setStatus("Paused");
    } catch {}
    // canonical pause
    try {
      pauseRef.current();
    } catch {}
  };

  // ---------- Native BarcodeDetector init (once) ----------
  useEffect(() => {
    (async () => {
      try {
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          // @ts-ignore
          const supported =
            await window.BarcodeDetector.getSupportedFormats?.().catch(
              () => []
            );
          const wanted = [
            "code_128",
            "code_39",
            "ean_13",
            "ean_8",
            "upc_a",
            "upc_e",
            "itf",
            "codabar",
            "qr_code",
            "pdf417",
            "aztec",
            "data_matrix",
          ];
          const formats = supported?.length
            ? wanted.filter((f) => supported.includes(f))
            : wanted;
          // @ts-ignore
          detectorRef.current = new window.BarcodeDetector({ formats });
          detectorReadyRef.current = true;
          console.debug("BarcodeDetector ready with formats:", formats);
        } else {
          console.debug(
            "BarcodeDetector not available; will use ZXing fallback."
          );
        }
      } catch (e) {
        console.debug(
          "BarcodeDetector init failed; will use ZXing fallback.",
          e
        );
        detectorRef.current = null;
        detectorReadyRef.current = false;
      }
    })();
  }, []);

  // ---------- ZXing start/stop helpers (continuous session) ----------
  const startZxing = useCallback(async () => {
    if (zxingStartedRef.current) return;
    try {
      const mod = await import("@zxing/browser"); // <- correct package for browser usage
      const Reader = mod.BrowserMultiFormatReader;
      const reader = new Reader(undefined, 250); // 250ms between attempts
      zxingReaderRef.current = reader;

      // Start continuous decode from the *existing* video element/stream
      // decodeFromVideoDevice(null, video, callback) creates a loop and returns controls.stop()
      const controls = await reader.decodeFromVideoDevice(
        null,
        videoRef.current as HTMLVideoElement,
        (result: any, err: any) => {
          if (result?.getText) {
            const text = result.getText();
            onDetectedRef.current?.(String(text));
          } else if (result?.text) {
            onDetectedRef.current?.(String(result.text));
          }
          // ignore NotFoundException errors; they just mean "no code this frame"
        }
      );

      zxingControlsRef.current = controls;
      zxingStartedRef.current = true;
      console.debug("ZXing continuous session started");
    } catch (e) {
      console.debug("ZXing start failed", e);
      // If ZXing cannot start, keep silent; native detector may still work.
    }
  }, []);

  const stopZxing = useCallback(() => {
    try {
      zxingControlsRef.current?.stop();
    } catch {}
    try {
      zxingReaderRef.current?.reset?.();
    } catch {}
    zxingControlsRef.current = null;
    zxingReaderRef.current = null;
    zxingStartedRef.current = false;
  }, []);

  // ---------- Scan loop (native detector path only) ----------
  const loop = useCallback(async () => {
    if (!scanning || paused) return;
    const video = videoRef.current;
    if (!video) return;

    // Try native detector first (cheap & fast)
    if (detectorReadyRef.current && detectorRef.current) {
      try {
        const results = await detectorRef.current.detect(video);
        if (results?.length && onDetectedRef.current) {
          const best = results[0];
          onDetectedRef.current(String(best.rawValue || ""));
          return;
        }
      } catch (e) {
        // ignore this tick
      }
    } else {
      // If native detector isn't available, ensure ZXing continuous session is running
      if (!zxingStartedRef.current) {
        startZxing();
      }
    }
  }, [paused, scanning, startZxing]);

  // ---------- Camera controls ----------
  const startCamera = useCallback(async () => {
    if (userStopRef.current) return;
    setStatus("Requesting camera permission…");
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setScanning(true);
      setPaused(false);
      setStatus("Scanning…");

      clearTimer();
      // Kick off the native-detector tick; if not available, loop will start ZXing once
      intervalRef.current = window.setInterval(loop, 300);
    } catch (err) {
      console.error("Camera start failed", err);
      setStatus("Camera permission denied or unavailable");
      setScanning(false);
      setPaused(false);
    }
  }, [loop]);

  const stopCamera = useCallback(() => {
    clearTimer();
    stopZxing();
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
  }, [stopZxing]);

  const pauseCamera = useCallback(() => {
    clearTimer();
    stopZxing();
    const s = streamRef.current;
    if (s) s.getVideoTracks().forEach((t) => (t.enabled = false));
    setPaused(true);
    setStatus("Paused");
  }, [stopZxing]);

  const resumeCamera = useCallback(() => {
    const s = streamRef.current;
    if (!s) {
      if (!userStopRef.current) startCamera();
      return;
    }
    s.getVideoTracks().forEach((t) => (t.enabled = true));
    setPaused(false);
    setStatus("Scanning…");
    clearTimer();
    intervalRef.current = window.setInterval(loop, 300);
    // If native detector isn’t available, loop will ensure ZXing is running
  }, [startCamera, loop]);

  useEffect(() => {
    pauseRef.current = pauseCamera;
  }, [pauseCamera]);

  // Mount / unmount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab visibility auto-pause/resume
  useEffect(() => {
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

  // ---------- Popup actions ----------
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
      return;
    }
    setStatus("Claim successful 🎉");
    setPopup((prev) => (prev ? { ...prev, claimed: true } : prev));
    setTimeout(() => {
      setPopup(null);
      setLastDetected("");
      setStatus("Scanning…");
      if (scanning) resumeCamera();
    }, 900);
  }, [popup, busy, resumeCamera, scanning, claimCode]);

  // ---------- UI ----------
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
