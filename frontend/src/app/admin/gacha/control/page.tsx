"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/** Types mirrored from display */
type GiftAvail = {
  id: number;
  name: string;
  description?: string | null;
  quantity: number;
  awarded: number;
  gift_category_id?: number | null;
};
type PreviewWinner = { id: number; name: string; gacha_code?: string | null };

type DisplayState = {
  gifts?: GiftAvail[];
  winnersCount?: number;
  selectedGiftsArr?: number[];
  previews?: Array<PreviewWinner | null>;
  showPreviewNameArr?: boolean[]; // NEW
  muted?: boolean;
  volume?: number;
  isFullscreen?: boolean;
  loading?: boolean;
};

type ControlMsg =
  | { type: "hello" }
  | { type: "goodbye" }
  | { type: "state-request" }
  | { type: "state"; payload?: DisplayState }
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
    };

export default function GachaControlPage() {
  const chanRef = useRef<BroadcastChannel | null>(null);

  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<DisplayState>({});
  const [localWinners, setLocalWinners] = useState<number>(1);
  const [localMuted, setLocalMuted] = useState<boolean>(false);
  const [localVolume, setLocalVolume] = useState<number>(0.9);

  const gifts = useMemo(() => state.gifts ?? [], [state.gifts]);
  const winnersCount = useMemo(
    () => Number(state.winnersCount ?? localWinners ?? 1),
    [state.winnersCount, localWinners]
  );
  const selectedGiftsArr = useMemo(
    () => state.selectedGiftsArr ?? [],
    [state.selectedGiftsArr]
  );
  const previews = useMemo(
    () => state.previews ?? [],
    [state.previews]
  );
  const nameShown = useMemo(
    () => state.showPreviewNameArr ?? [],
    [state.showPreviewNameArr]
  );

  const remain = (g?: GiftAvail) =>
    Math.max(0, ((g?.quantity ?? 0) - (g?.awarded ?? 0)));

  const canDraw = useMemo(() => {
    if (state.loading) return false;
    if (!gifts.length) return false;
    const slots = winnersCount;
    const sel = selectedGiftsArr.slice(0, slots);
    if (sel.length < slots) return false;
    for (let i = 0; i < sel.length; i++) {
      const g = gifts.find(x => x.id === sel[i]);
      if (!g || remain(g) <= 0) return false;
    }
    return true;
  }, [state.loading, gifts, winnersCount, selectedGiftsArr]);

  const canSave = useMemo(() => {
    const slots = winnersCount;
    return (
      !state.loading &&
      previews.slice(0, slots).every(Boolean) &&
      selectedGiftsArr.slice(0, slots).length === slots
    );
  }, [state.loading, previews, winnersCount, selectedGiftsArr]);

  // Channel lifecycle
  useEffect(() => {
    const chan = new BroadcastChannel("gacha-control");
    chanRef.current = chan;

    const onMsg = (ev: MessageEvent) => {
      const msg = ev.data as ControlMsg;
      if (!msg) return;
      if (msg.type === "hello") setConnected(true);
      if (msg.type === "goodbye") setConnected(false);
      if (msg.type === "state") {
        const p = msg.payload ?? {};
        setState(p);
        if (typeof p.winnersCount === "number") setLocalWinners(p.winnersCount);
        if (typeof p.muted === "boolean") setLocalMuted(p.muted);
        if (typeof p.volume === "number") setLocalVolume(p.volume);
      }
    };

    chan.addEventListener("message", onMsg);
    chan.postMessage({ type: "state-request" } as ControlMsg);

    return () => {
      try { chan.postMessage({ type: "goodbye" } as ControlMsg); } catch {}
      chan.removeEventListener("message", onMsg);
      chan.close();
      chanRef.current = null;
    };
  }, []);

  const send = (msg: ControlMsg) => {
    try { chanRef.current?.postMessage(msg); } catch {}
  };

  // Commands
  const draw = (spectacular: boolean) =>
    send({ type: "command", cmd: "draw", payload: { spectacular } });

  const refreshAll = () => send({ type: "command", cmd: "refresh" });

  const refreshSlot = (slot: number) =>
    send({ type: "command", cmd: "refresh-slot", payload: { slot } });

  const save = () => send({ type: "command", cmd: "save" });

  const toggleFs = () => send({ type: "command", cmd: "toggle-fullscreen" });

  const setWinners = (count: number) => {
    setLocalWinners(count);
    send({ type: "command", cmd: "set-winners-count", payload: { count } });
  };

  const setGiftForSlot = (slot: number, giftId: number) =>
    send({ type: "command", cmd: "set-gift-slot", payload: { slot, giftId } });

  const setAudio = (mute: boolean, volume?: number) =>
    send({ type: "command", cmd: "audio", payload: { mute, volume } });

  // NEW: names reveal commands
  const revealAll = (all: boolean) =>
    send({ type: "command", cmd: "reveal-names", payload: { all } });

  const toggleSlotName = (slot: number) =>
    send({
      type: "command",
      cmd: "reveal-names",
      payload: { slot } // display will toggle if show is undefined
    });

  // UI
  return (
    <div className="min-h-screen p-6 bg-[#1b1410] text-amber-100">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold font-[Cinzel,serif]">Gacha Control</h1>
        <div className="text-sm">
          Status:&nbsp;
          <span className={connected ? "text-emerald-300" : "text-amber-400 opacity-80"}>
            {connected ? "Connected" : "Unavailable"}
          </span>
        </div>
      </header>

      {/* Top actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <button
          onClick={() => draw(true)}
          disabled={!canDraw}
          className={`px-3 py-2 rounded border text-sm ${canDraw
              ? "bg-[#7c1e1e] hover:bg-[#8f2525] border-amber-900/40"
              : "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"}`}
        >
          Draw (Spectacular)
        </button>
        <button
          onClick={() => draw(false)}
          disabled={!canDraw}
          className={`px-3 py-2 rounded border text-sm ${canDraw
              ? "bg-amber-950/30 hover:bg-amber-950/40 border-amber-900/40"
              : "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"}`}
        >
          Draw (Quick)
        </button>
        <button
          onClick={refreshAll}
          className="px-3 py-2 rounded border text-sm bg-amber-950/20 hover:bg-amber-950/30 border-amber-900/40"
        >
          Refresh All
        </button>
        <button
          onClick={save}
          disabled={!canSave}
          className={`px-3 py-2 rounded border text-sm ${canSave
              ? "bg-emerald-600 hover:bg-emerald-600/90 border-emerald-700/40"
              : "bg-white/5 border-white/10 opacity-60 cursor-not-allowed"}`}
        >
          Save Winners
        </button>
        <button
          onClick={toggleFs}
          className="px-3 py-2 rounded border text-sm bg-indigo-600/90 hover:bg-indigo-600"
        >
          Toggle Fullscreen
        </button>

        {/* NEW: global show/hide names */}
        <div className="flex gap-2">
          <button
            onClick={() => revealAll(true)}
            className="px-3 py-2 rounded border text-sm bg-amber-950/30 hover:bg-amber-950/40 border-amber-900/40"
            title="Show all names"
          >
            Show Names
          </button>
          <button
            onClick={() => revealAll(false)}
            className="px-3 py-2 rounded border text-sm bg-amber-950/20 hover:bg-amber-950/30 border-amber-900/40"
            title="Hide all names"
          >
            Hide Names
          </button>
        </div>
      </div>

      {/* Winners & gifts */}
      <section className="mb-6">
        <div className="text-xs uppercase tracking-wider text-amber-300/70 mb-2">
          Winners & Gifts
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm">Winners:</span>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setWinners(n)}
              className={`px-2 py-1 rounded text-sm ${
                winnersCount === n ? "bg-amber-700 text-amber-100" : "bg-amber-950/20"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Per-slot selectors */}
        <div className="grid gap-2 sm:max-h-60 sm:overflow-auto pr-1">
          {Array.from({ length: winnersCount }).map((_, i) => {
            const giftId = selectedGiftsArr[i];
            const current = gifts.find((g) => g.id === giftId);
            const shown = Boolean(nameShown[i]);
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-900/40 bg-amber-950/20 p-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="text-amber-300/80">Slot {i + 1}</div>
                  <select
                    value={giftId ?? ""}
                    onChange={(e) =>
                      setGiftForSlot(i, Number(e.currentTarget.value))
                    }
                    className="bg-amber-950/10 px-2 py-1 rounded"
                  >
                    {gifts.map((g) => {
                      const r = remain(g);
                      return (
                        <option key={g.id} value={g.id} disabled={r <= 0}>
                          {g.name} ({r})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {/* NEW: per-slot show/hide name */}
                  <button
                    onClick={() => toggleSlotName(i)}
                    className="px-2 py-1 rounded border border-amber-900/40 bg-amber-950/30 hover:bg-amber-950/40 text-xs"
                    title={shown ? "Hide name" : "Show name"}
                  >
                    {shown ? "Hide Name" : "Show Name"}
                  </button>

                  <button
                    onClick={() => refreshSlot(i)}
                    className="px-2 py-1 rounded border border-amber-900/40 bg-amber-950/30 hover:bg-amber-950/40 text-xs"
                    title="Refresh this slot"
                  >
                    Refresh
                  </button>

                  <div className="tabular-nums text-amber-200/80 text-xs">
                    {current ? `${current.awarded}/${current.quantity}` : "\u00A0"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Audio */}
      <section className="mb-6">
        <div className="text-xs uppercase tracking-wider text-amber-300/70 mb-2">
          Audio
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[#d4af37]"
              checked={Boolean(state.muted ?? localMuted)}
              onChange={(e) => {
                const m = e.currentTarget.checked;
                setLocalMuted(m);
                setAudio(m, state.volume ?? localVolume);
              }}
            />
            Mute
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={Number(state.volume ?? localVolume)}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              setLocalVolume(v);
              setAudio(Boolean(state.muted ?? localMuted), v);
            }}
            className="w-56"
            aria-label="Volume"
          />
          <span className="text-sm tabular-nums w-10 text-right">
            {Math.round(100 * Number(state.volume ?? localVolume))}
          </span>
        </div>
      </section>

      {/* Preview (read-only mirror) */}
      <section className="mb-6">
        <div className="text-xs uppercase tracking-wider text-amber-300/70 mb-2">
          Preview
        </div>
        {Array.from({ length: winnersCount }).map((_, i) => {
          const p = previews[i] || null;
          const code = (() => {
            const raw = p?.gacha_code || "";
            const [preRaw = "", sufRaw = ""] = raw.split("-");
            const prefix = preRaw.slice(0, 8) || "********";
            const digits = (sufRaw.match(/\d/g) || []).join("").slice(0, 10);
            const suffix = (digits || "").padEnd(10, "0") || "**********";
            return `${prefix}-${suffix}`;
          })();
          return (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-md border border-amber-900/40 bg-amber-950/10 p-2 text-sm mb-2"
            >
              <div className="text-amber-200/80">
                <span className="opacity-80 mr-2">Slot {i + 1}</span>
                <span className="font-mono">{code}</span>
              </div>
              <div className="text-amber-100/90 font-medium">
                {nameShown[i] ? (p?.name ?? "") : ""}
              </div>
            </div>
          );
        })}
      </section>

      {/* Raw state (debug) */}
      <section className="text-xs text-amber-300/80">
        <div>Latest state payload:</div>
        <pre className="mt-2 max-h-64 overflow-auto text-[11px] bg-black/30 p-2 rounded border border-amber-900/40">
          {JSON.stringify(state, null, 2)}
        </pre>
      </section>
    </div>
  );
}
