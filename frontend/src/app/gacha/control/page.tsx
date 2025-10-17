"use client";
import React, { useEffect, useRef, useState } from "react";
import { GachaCmd, GachaEvent, GACHA_CHANNEL } from "../../../lib/gacha-wire";

export default function ControlPage() {
  const chanRef = useRef<BroadcastChannel | null>(null);
  const [stageReady, setStageReady] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const chan = new BroadcastChannel(GACHA_CHANNEL);
    chanRef.current = chan;
    chan.postMessage({ type: "HELLO", who: "control" } as GachaCmd);
    chan.postMessage({ type: "PING" } as GachaCmd);
    chan.onmessage = (ev: MessageEvent<GachaEvent>) => {
      if (ev.data.type === "PONG") return;
      if (ev.data.type === "STAGE_READY") setStageReady(true);
      if (ev.data.type === "STATE") {
        // optional: mirror stage state
      }
    };
    return () => chan.close();
  }, []);

  const send = (msg: GachaCmd) => chanRef.current?.postMessage(msg);

  return (
    <div className="p-6">
      <div className="mb-4">
        <button onClick={() => send({ type: "ENTER_FULLSCREEN" })} className="px-3 py-1.5 rounded bg-indigo-600 text-white mr-2">Enter Fullscreen</button>
        <button onClick={() => send({ type: "EXIT_FULLSCREEN" })} className="px-3 py-1.5 rounded bg-slate-700 text-white">Exit Fullscreen</button>
        <span className={`ml-2 text-sm ${stageReady ? "text-emerald-500" : "text-yellow-400"}`}>{stageReady ? "Stage Ready" : "Waiting for Stage to arm…"}</span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => send({ type: "DRAW", spectacular: true })} className="px-3 py-1.5 rounded bg-rose-600 text-white">Get Winner(s)</button>
        <button onClick={() => send({ type: "DRAW", spectacular: false })} className="px-3 py-1.5 rounded bg-slate-700 text-white">Refresh Winner(s)</button>
        <button onClick={() => send({ type: "SAVE" })} className="px-3 py-1.5 rounded bg-emerald-600 text-white">Save</button>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={muted} onChange={(e) => { const m = e.currentTarget.checked; setMuted(m); send({ type: "AUDIO_MUTE", value: m }); }} />
          Mute
        </label>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => { const v = Number(e.currentTarget.value); setVolume(v); send({ type: "AUDIO_VOLUME", value: v }); }} />
        <span className="tabular-nums">{Math.round(volume * 100)}</span>
      </div>

      <div className="mt-4 text-sm text-slate-500">Use this Control page to drive the Stage after it has been armed (Start Show).</div>
    </div>
  );
}
