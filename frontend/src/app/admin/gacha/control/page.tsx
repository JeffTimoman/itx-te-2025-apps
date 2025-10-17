"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// Minimal control UI that communicates with the display via BroadcastChannel
export default function GachaControlPage() {
  const chanRef = useRef<BroadcastChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [statePayload, setStatePayload] = useState<Record<string, unknown> | null>(null);
  const [winnersCount, setWinnersCount] = useState<number>(1);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);

  useEffect(() => {
    const chan = new BroadcastChannel("gacha-control");
    chanRef.current = chan;

    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data as any;
      if (!msg) return;
      if (msg.type === "hello") setConnected(true);
      if (msg.type === "goodbye") setConnected(false);
      if (msg.type === "state") setStatePayload(msg.payload || null);
    };

    chan.addEventListener("message", onMsg);
    // request initial state
    chan.postMessage({ type: "state-request" });

    return () => {
      try {
        chan.postMessage({ type: "goodbye" });
      } catch {}
      chan.removeEventListener("message", onMsg);
      chan.close();
      chanRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!statePayload) return;
    const payload = statePayload as any;
    setWinnersCount(Number(payload.winnersCount ?? 1));
    setMuted(Boolean(payload.muted));
    setVolume(Number(payload.volume ?? 0.9));
  }, [statePayload]);

  const send = (msg: unknown) => {
    try {
      chanRef.current?.postMessage(msg);
    } catch {}
  };

  const draw = (spectacular = true) => send({ type: "command", cmd: "draw", payload: { spectacular } });
  const refresh = () => send({ type: "command", cmd: "refresh" });
  const save = () => send({ type: "command", cmd: "save" });
  const toggleFs = () => send({ type: "command", cmd: "toggle-fullscreen" });
  const setWinners = (n: number) => send({ type: "command", cmd: "set-winners-count", payload: { count: n } });
  const setAudio = (m: boolean, v?: number) => send({ type: "command", cmd: "audio", payload: { mute: m, volume: v } });

  const gifts = useMemo(() => (statePayload?.gifts as any[]) || [], [statePayload]);

  return (
    <div className="min-h-screen p-6 bg-gray-900 text-white">
      <h1 className="text-xl font-semibold mb-4">Gacha Control</h1>
      <div className="mb-3">Status: {connected ? "Connected" : "Unavailable"}</div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <button onClick={() => draw(true)} className="px-3 py-2 bg-amber-600 rounded">Draw (Spectacular)</button>
        <button onClick={() => draw(false)} className="px-3 py-2 bg-amber-400 rounded">Draw (Quick)</button>
        <button onClick={refresh} className="px-3 py-2 bg-slate-700 rounded">Refresh</button>
        <button onClick={save} className="px-3 py-2 bg-emerald-600 rounded">Save Winners</button>
        <button onClick={toggleFs} className="px-3 py-2 bg-indigo-600 rounded">Toggle Fullscreen</button>
      </div>

      <div className="mb-4">
        <label className="block mb-1">Winners</label>
        <div className="flex gap-2">
          {[1,2,3,4].map(n => (
            <button key={n} onClick={() => setWinners(n)} className={`px-3 py-1 rounded ${winnersCount===n? 'bg-amber-600' : 'bg-slate-700'}`}>{n}</button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block mb-1">Audio</label>
        <div className="flex items-center gap-2">
          <button onClick={() => { setMuted(!muted); setAudio(!muted, volume); }} className={`px-3 py-1 rounded ${muted? 'bg-amber-600' : 'bg-slate-700'}`}>{muted? 'Muted' : 'Unmuted'}</button>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => { const v = Number(e.currentTarget.value); setVolume(v); setAudio(muted, v); }} />
        </div>
      </div>

      <div className="mb-4">
        <label className="block mb-2">Gifts</label>
        <div className="max-h-48 overflow-auto bg-slate-800 p-2 rounded">
          {gifts.length === 0 && <div className="text-slate-400 text-sm">No gifts found</div>}
          {gifts.map((g: any, idx: number) => (
            <div key={g.id ?? idx} className="flex items-center justify-between text-sm py-1 border-b border-slate-700">
              <div>{g.name}</div>
              <div className="tabular-nums">{Math.max(0, (g.quantity ?? 0) - (g.awarded ?? 0))}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-sm text-slate-400">
        <div>Latest state payload:</div>
        <pre className="mt-2 max-h-48 overflow-auto text-xs bg-black/30 p-2 rounded">{JSON.stringify(statePayload, null, 2)}</pre>
      </div>
    </div>
  );
}
