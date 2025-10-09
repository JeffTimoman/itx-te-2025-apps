"use client";

import React, { useEffect, useState } from 'react';

export default function GeneratePage() {
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createCode() {
    setLoading(true);
    setError(null);
    try {
  const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_BASE || '');
  const resp = await fetch(`${BACKEND}/api/registrations/generate`, { method: 'POST' });
      if (!resp.ok) {
        const txt = await resp.text();
        setError(`Failed: ${resp.status} ${txt}`);
        setLoading(false);
        return;
      }
      const body = await resp.json();
  const c = body.code;
      // Build frontend verify URL — prefer window.location.origin when available
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const path = body.verifyPath || `/registrations/verify/${c}`;
      setVerifyUrl(`${origin}${path}`);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { createCode(); }, []);

  function qrSrc(url: string) {
    // Use a free QR image generator (no dependency). URL-encode the payload.
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}`;
  }

  return (
    <div className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold mb-4">Generate Registration QR</h1>
      <p className="mb-4">Scan this QR code to open the verification page where you can select your name and activate your registration.</p>

      {loading && <div>Generating QR…</div>}
      {error && <div className="text-red-600 mb-4">{error}</div>}

      {verifyUrl && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc(verifyUrl)} alt="Registration QR" className="mx-auto mb-4" />
          <div className="mb-2">Link: <a className="text-blue-600 break-all" href={verifyUrl}>{verifyUrl}</a></div>
          <div className="flex gap-2 justify-center">
            <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => createCode()}>Regenerate</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={() => navigator.clipboard?.writeText(verifyUrl)}>Copy Link</button>
          </div>
        </div>
      )}

      {!verifyUrl && !loading && !error && (
        <div><button className="px-4 py-2 bg-indigo-600 text-white rounded" onClick={() => createCode()}>Create QR</button></div>
      )}
    </div>
  );
}
