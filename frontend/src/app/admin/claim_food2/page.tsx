"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';

// authFetch helper used across admin pages (default export)
import authFetch from "../../../lib/api/client";

export default function ClaimFoodScannerPage() {
  type WindowWithBD = Window & { BarcodeDetector?: unknown };
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [lastDetected, setLastDetected] = useState<string>('');
  const [popup, setPopup] = useState<null | { code: string; voucher: Record<string, unknown>; claimed?: boolean }>(null); // { code, voucher }
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Start camera
  const startCamera = useCallback(async () => {
    setStatusMessage('Requesting camera permission...');
    try {
      const constraints = { video: { facingMode: 'environment' }, audio: false };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  if (videoRef.current) (videoRef.current as HTMLVideoElement).srcObject = stream;
      setScanning(true);
      setStatusMessage('Scanning...');
    } catch (err) {
      console.error('Camera start failed', err);
      setStatusMessage('Camera permission denied or unavailable');
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    try {
      const v = videoRef.current;
      const stream = v && (v as HTMLVideoElement).srcObject as MediaStream | null;
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach((t: MediaStreamTrack) => t.stop());
      }
      if (v) (v as HTMLVideoElement).srcObject = null;
    } catch (e) { console.warn('stopCamera error', e); }
    setScanning(false);
    setStatusMessage('Stopped');
  }, []);

  // Validate code with backend
  async function validateCode(code: string) {
    try {
      const res = await authFetch(`/api/admin/food-vouchers/${encodeURIComponent(code)}`);
      if (!res.ok) return { ok: false, error: res.error || 'Invalid response' };
      return { ok: true, voucher: res.voucher };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  // Claim code with backend
  async function claimCode(code: string) {
    try {
      const res = await authFetch(`/api/admin/food-vouchers/${encodeURIComponent(code)}/claim`, { method: 'POST', body: JSON.stringify({}) });
      if (!res.ok) return { ok: false, error: res.error || 'Claim failed' };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  }

  // Handle a detected code
  const onDetected = useCallback(async (raw: string) => {
    const code = String(raw || '').trim();
    if (!code) return;
    if (code === lastDetected) return; // avoid duplicates
    setLastDetected(code);
    setStatusMessage(`Detected: ${code} — validating...`);
    const v = await validateCode(code);
    if (!v.ok) {
      setStatusMessage(`Invalid voucher: ${v.error || 'not found'}`);
      // continue scanning after brief pause
      setTimeout(() => setLastDetected(''), 1200);
      return;
    }
    // show popup: claim or cancel
    setPopup({ code, voucher: v.voucher });
  }, [lastDetected]);

  // Claim button handler
  const onClaim = useCallback(async () => {
    if (!popup || !popup.code) return;
    setStatusMessage('Claiming...');
    const r = await claimCode(popup.code);
    if (!r.ok) {
      setStatusMessage(`Claim failed: ${r.error || 'error'}`);
      // clear popup and continue
      setTimeout(() => { setPopup(null); setLastDetected(''); setStatusMessage('Scanning...'); }, 1200);
      return;
    }
    // Show small success message
    setStatusMessage('Claim successful 🎉');
    setPopup({ ...(popup as object), claimed: true });
    setTimeout(() => { setPopup(null); setLastDetected(''); setStatusMessage('Scanning...'); }, 1200);
  }, [popup]);

  // Scanning loop using BarcodeDetector when available, otherwise sample canvas for QR/barcode library
  useEffect(() => {
    let interval: number | null = null;

    async function loop() {
      const video = videoRef.current as HTMLVideoElement | null;
      if (!video) return;
      // BarcodeDetector API
      const BD = (window as WindowWithBD).BarcodeDetector;
      if (BD) {
        try {
          type BDConstructor = new (opts: unknown) => { detect: (v: HTMLVideoElement) => Promise<unknown[]> };
          const detector = new (BD as unknown as BDConstructor)({ formats: ['code_128','code_39','ean_13','qr_code'] });
          const barcodes = await detector.detect(video as HTMLVideoElement);
          if (barcodes && barcodes.length > 0) {
            const b = barcodes[0] as Record<string, unknown>;
            const val = String((b['rawValue'] || b['rawText'] || b['raw_data'] || ''));
            onDetected(val);
          }
        } catch (e) {
          console.warn('Barcode detect error', e);
        }
      } else {
        // Fallback is left unimplemented: most modern mobile browsers support BarcodeDetector.
      }
    }

    if (scanning) {
      interval = window.setInterval(loop, 700);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [scanning, onDetected]);

  useEffect(() => {
    // Autostart camera when component mounts
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold">Food Voucher Scanner</h2>
      <div className="mt-3">
        <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', maxHeight: 480, background: '#000' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="mt-3">
        <div className="text-sm text-gray-600">{statusMessage}</div>
        <div className="flex gap-2 mt-2">
          <button className="px-3 py-2 bg-amber-800 text-white rounded" onClick={() => { if (scanning) stopCamera(); else startCamera(); }}>{scanning ? 'Stop' : 'Start'}</button>
          <button className="px-3 py-2 border rounded" onClick={() => { setLastDetected(''); setPopup(null); setStatusMessage('Scanning...'); }}>Reset</button>
        </div>
      </div>

      {/* Popup */}
      {popup && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 absolute inset-0"></div>
          <div className="bg-white rounded-lg p-4 z-10 pointer-events-auto w-[90%] max-w-md">
            <h3 className="font-bold">Voucher detected</h3>
            <p className="mt-2">Code: <strong>{popup.code}</strong></p>
            <p className="mt-1 text-sm text-gray-600">Status: {popup.voucher.is_claimed === 'Y' ? 'Already claimed' : 'Not claimed'}</p>
            <div className="mt-3 flex gap-2 justify-end">
              <button className="px-3 py-2 border rounded" onClick={() => { setPopup(null); setLastDetected(''); setStatusMessage('Scanning...'); }}>Cancel</button>
              {popup.voucher.is_claimed !== 'Y' && (
                <button className="px-3 py-2 bg-amber-800 text-white rounded" onClick={onClaim}>Claim</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
