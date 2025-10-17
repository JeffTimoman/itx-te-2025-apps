"use client";
import React, { useEffect, useRef, useState } from "react";
import { GachaCmd, GachaEvent, GACHA_CHANNEL, GachaAPI } from "../../../lib/gacha-wire";

export default function StagePage() {
  const chanRef = useRef<BroadcastChannel | null>(null);
  const [armed, setArmed] = useState(false);
  const [stageReady, setStageReady] = useState(false);

  useEffect(() => {
    const chan = new BroadcastChannel(GACHA_CHANNEL);
    chanRef.current = chan;
    chan.postMessage({ type: "HELLO", who: "stage" } as GachaCmd);
    chan.onmessage = async (ev: MessageEvent<GachaCmd>) => {
      const msg = ev.data;
      if (!armed) return;
  const api = (window as unknown as { __gacha_api__?: GachaAPI }).__gacha_api__;
      switch (msg.type) {
        case "PING":
          chan.postMessage({ type: "PONG" } as GachaEvent);
          break;
        case "ENTER_FULLSCREEN":
          api?.enterFullscreen?.();
          break;
        case "EXIT_FULLSCREEN":
          api?.exitFullscreen?.();
          break;
        case "DRAW":
          api?.pickRandom?.(msg.spectacular);
          break;
        case "DRAW_SLOT":
          api?.pickRandomSlot?.(msg.spectacular, msg.slot);
          break;
        case "SAVE":
          api?.saveWinner?.();
          break;
        case "SET_WINNERS_COUNT":
          api?.setWinnersCount?.(msg.value);
          break;
        case "SET_GIFT_FOR_SLOT":
          api?.setGiftForSlot?.(msg.slot, msg.giftId);
          break;
        case "AUDIO_MUTE":
          api?.setMuted?.(msg.value);
          break;
        case "AUDIO_VOLUME":
          api?.setVolume?.(msg.value);
          break;
      }
    };
    return () => { chan.close(); };
  }, [armed]);

  async function arm() {
    // Must be user gesture here
    const api = (window as unknown as { __gacha_api__?: GachaAPI }).__gacha_api__;
    try {
      await api?.ensureCtx?.();
      await api?.enterFullscreen?.();
      setArmed(true);
      chanRef.current?.postMessage({ type: "STAGE_READY" } as GachaEvent);
      setStageReady(true);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {!armed ? (
        <div className="text-center">
          <div className="mb-4 text-lg font-semibold">Stage — Arm for remote control</div>
          <button onClick={arm} className="px-6 py-3 rounded bg-amber-600 text-white">Start Show (Allow Fullscreen & Audio)</button>
          <div className="mt-3 text-sm text-slate-400">After arming, use the Control tab to drive the show.</div>
        </div>
      ) : (
        <div className="text-center">
          <div className="text-emerald-400 font-semibold">Stage armed</div>
      <div className="text-sm text-slate-400">Listening for commands on channel gacha</div>
        </div>
      )}
    </div>
  );
}
