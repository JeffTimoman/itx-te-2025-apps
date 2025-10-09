"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "../../../lib/socket";

type Player = { id: string; name: string };
type Room = {
  id: string;
  players: Record<string, Player>;
  host?: string;
  allowJoins?: boolean;
};

type LogItem = { ts: number; text: string };

/**
 * AdminPage — revamped control center
 *
 * UX highlights
 * - Guided create flow with inline validation & loading state
 * - Two‑column dashboard: Controls (left) • Players & Events (right)
 * - Prominent room code with copy button + join toggle badge
 * - Duration presets + custom input, guarded actions
 * - Sticky action bar on mobile; responsive & accessible
 */
export default function AdminPage() {
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);
  const [name, setName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [firstTap, setFirstTap] = useState<{
    playerId: string;
    playerName: string;
  } | null>(null);
  const [allowJoins, setAllowJoins] = useState<boolean>(true);

  const [toast, setToast] = useState<string>("");
  const [logs, setLogs] = useState<LogItem[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const customDurationRef = useRef<HTMLInputElement | null>(null);

  const addLog = (text: string) =>
    setLogs((l) => [{ ts: Date.now(), text }, ...l].slice(0, 200));
  const setMessage = (m: string) => {
    setToast(m);
    addLog(m);
  };

  // Derived
  const canCreate = useMemo(
    () => name.trim().length >= 2 && !isCreating,
    [name, isCreating]
  );
  const durationPresets = [1, 2, 3, 5, 8, 10, 15, 20, 25, 30];

  useEffect(() => {
    const socket = getSocket();

    socket.on("roomCreated", (data: { roomId: string; room: Room }) => {
      setIsCreating(false);
      setCreatedRoom(data.room);
      const room = data.room;
      const playersList = room?.players
        ? Object.values(room.players).filter((p) => p.id !== room.host)
        : [];
      setPlayers(playersList);
      if (typeof room.allowJoins === "boolean") setAllowJoins(room.allowJoins);
      setMessage(`Room ${data.roomId} created`);
    });

    socket.on("playerJoined", (data: { playerName: string; room?: Room }) => {
      setMessage(`${data.playerName} joined`);
      const room = data.room;
      if (room?.players) {
        const playersList = Object.values(room.players).filter(
          (p) => p.id !== room.host
        );
        setPlayers(playersList);
      }
    });

    socket.on("playerLeft", (data: { room?: Room }) => {
      const room = data.room;
      if (room?.players) {
        const playersList = Object.values(room.players).filter(
          (p) => p.id !== room.host
        );
        setPlayers(playersList);
      }
      setMessage("A player left");
    });

    socket.on("gameStarted", () => {
      setIsStarting(false);
      setMessage("Game started");
    });

    socket.on("firstTap", (data: { playerId: string; playerName: string }) => {
      setMessage(`${data.playerName} tapped first!`);
      setFirstTap({ playerId: data.playerId, playerName: data.playerName });
    });

    socket.on("gameEnded", (data: { winner?: { playerName?: string } }) => {
      setIsEnding(false);
      setMessage(`Game ended. Winner: ${data.winner?.playerName || "N/A"}`);
    });

    socket.on("roundReset", (data: { message?: string; room?: Room }) => {
      setIsResetting(false);
      setMessage(data.message || "Round reset");
      setFirstTap(null);
      const room = data.room;
      if (room?.players) {
        const playersList = Object.values(room.players).filter(
          (p) => p.id !== room.host
        );
        setPlayers(playersList);
        if (typeof room.allowJoins === "boolean")
          setAllowJoins(room.allowJoins);
      }
    });

    socket.on("roomEnded", (data: { message?: string; room?: Room }) => {
      setIsEnding(false);
      setMessage(data.message || "Room ended");
      setFirstTap(null);
      const room = data.room;
      if (!room || !room.players) {
        setPlayers([]);
        setCreatedRoom(null);
      } else {
        const playersList = Object.values(room.players).filter(
          (p) => p.id !== room.host
        );
        setPlayers(playersList);
        if (typeof room.allowJoins === "boolean")
          setAllowJoins(room.allowJoins);
      }
    });

    socket.on(
      "allowJoinsChanged",
      (data: { allowJoins: boolean; room?: Room }) => {
        setAllowJoins(Boolean(data.allowJoins));
        setMessage(data.allowJoins ? "Joins enabled" : "Joins disabled");
        const room = data.room;
        if (room?.players) {
          const playersList = Object.values(room.players).filter(
            (p) => p.id !== room.host
          );
          setPlayers(playersList);
        }
      }
    );

    socket.on("endGameAck", () => {
      setIsEnding(false);
      setMessage("Game ended");
    });

    socket.on("endGameError", (err: { message?: string }) => {
      setIsEnding(false);
      setMessage(err.message || "Failed to end game");
    });

    return () => {
      socket.off("roomCreated");
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("gameStarted");
      socket.off("firstTap");
      socket.off("gameEnded");
      socket.off("roundReset");
      socket.off("roomEnded");
      socket.off("allowJoinsChanged");
      socket.off("endGameAck");
      socket.off("endGameError");
    };
  }, []);

  // Actions
  function handleCreate() {
    if (!canCreate) {
      setMessage("Enter your name (min 2 chars)");
      return;
    }
    setIsCreating(true);
    getSocket().emit("createRoom", { playerName: name.trim() });
  }

  function startWithDuration(durationSeconds: number) {
    if (!createdRoom) {
      setMessage("Create a room first");
      return;
    }
    setIsStarting(true);
    getSocket().emit("startGame", {
      roomId: createdRoom.id,
      duration: durationSeconds,
    });
  }

  function handleStartCustom() {
    const raw = customDurationRef.current?.value || "";
    const val = Math.max(1, Math.min(120, parseInt(raw, 10)));
    if (Number.isNaN(val)) {
      setMessage("Enter a valid number between 1–120");
      return;
    }
    startWithDuration(val);
  }

  function handleReset() {
    if (!createdRoom) return;
    setIsResetting(true);
    getSocket().emit("resetRound", { roomId: createdRoom.id });
  }

  function handleToggleAllowJoins() {
    if (!createdRoom) return;
    getSocket().emit("setAllowJoins", {
      roomId: createdRoom.id,
      allow: !allowJoins,
    });
  }

  function handleEnd() {
    if (!createdRoom) return;
    const ok = window.confirm("End the current game for everyone?");
    if (!ok) return;
    setIsEnding(true);
    getSocket().emit("endGame", { roomId: createdRoom.id });
  }

  function handleLeave() {
    if (!createdRoom) return;
    const ok = window.confirm(
      "Leave the room? This ends the game and kicks players."
    );
    if (!ok) return;
    setIsEnding(true);
    getSocket().emit("endGame", { roomId: createdRoom.id });
    // Optimistic local clear (server will also emit roomEnded)
    setCreatedRoom(null);
    setPlayers([]);
    setFirstTap(null);
    setAllowJoins(true);
    setIsEnding(false);
    setMessage("You left the game and returned to create view");
  }

  function copyCode() {
    if (!createdRoom?.id) return;
    navigator.clipboard.writeText(createdRoom.id).then(
      () => setMessage("Room code copied"),
      () => setMessage("Failed to copy")
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
              ITX
            </div>
            <div className="text-sm opacity-80">
              Admin Panel {createdRoom ? `• Room ${createdRoom.id}` : ""}
            </div>
          </div>
          {toast && (
            <div className="text-xs px-3 py-1 rounded-full bg-white/15 border border-white/20">
              {toast}
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-6">
        {/* LEFT: Controls */}
        <section className="space-y-6">
          {!createdRoom ? (
            <div className="rounded-2xl p-6 bg-white/5 border border-white/10">
              <h2 className="text-xl font-bold">Create room</h2>
              <p className="text-sm text-slate-300 mt-1">
                Enter Room ID. You'll be the host.
              </p>
              <div className="mt-4 grid gap-3">
                <label
                  className="text-xs uppercase tracking-wider opacity-80"
                  htmlFor="admin-name"
                >
                  Room ID
                </label>
                <input
                  id="admin-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., GAME1"
                  className={`w-full p-3 rounded-xl bg-white/10 border ${
                    canCreate ? "border-white/20" : "border-red-400/40"
                  } outline-none focus:ring-2 focus:ring-indigo-400/60`}
                />
                <button
                  onClick={handleCreate}
                  disabled={!canCreate}
                  className="relative inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-slate-900"
                >
                  {isCreating && (
                    <span className="absolute left-4 h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  )}
                  {isCreating ? "Creating…" : "Create room"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-6 bg-white/5 border border-white/10 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wider opacity-80">
                    Room code
                  </div>
                  <div className="mt-1 text-3xl font-black tracking-wider font-mono">
                    {createdRoom.id}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyCode}
                    className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm hover:bg-white/15"
                  >
                    Copy
                  </button>
                  <span
                    className={`px-3 py-2 rounded-lg text-xs border ${
                      allowJoins
                        ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                        : "bg-rose-500/20 border-rose-400/40 text-rose-200"
                    }`}
                  >
                    {allowJoins ? "Joins enabled" : "Joins disabled"}
                  </span>
                </div>
              </div>

              {/* Start controls */}
              <div>
                <div className="text-xs uppercase tracking-wider opacity-80">
                  Start a round
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {durationPresets.map((s) => (
                    <button
                      key={s}
                      onClick={() => startWithDuration(s)}
                      disabled={isStarting}
                      className="px-3 py-2 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 disabled:opacity-50 text-sm"
                    >
                      {s}s
                    </button>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    ref={customDurationRef}
                    placeholder="Custom (1–120 s)"
                    inputMode="numeric"
                    className="w-40 p-2 rounded-lg bg-white/10 border border-white/20 outline-none focus:ring-2 focus:ring-indigo-400/60"
                  />
                  <button
                    onClick={handleStartCustom}
                    disabled={isStarting}
                    className="px-3 py-2 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 disabled:opacity-50 text-sm"
                  >
                    Start
                  </button>
                  {isStarting && (
                    <span className="text-xs opacity-80">Starting…</span>
                  )}
                </div>
              </div>

              {/* Round controls */}
              <div className="grid sm:grid-cols-2 gap-2">
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="px-4 py-2 rounded-lg bg-amber-400/90 hover:bg-amber-400 text-black font-semibold disabled:opacity-50"
                >
                  Reset round
                </button>
                <button
                  onClick={handleEnd}
                  disabled={isEnding}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 font-semibold disabled:opacity-50"
                >
                  End game
                </button>
                <button
                  onClick={handleLeave}
                  className="px-4 py-2 rounded-lg bg-rose-400/80 hover:bg-rose-400 font-semibold"
                >
                  Leave room
                </button>
                <button
                  onClick={handleToggleAllowJoins}
                  className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 font-semibold hover:bg-white/15"
                >
                  {allowJoins ? "Disable joins" : "Enable joins"}
                </button>
              </div>

              {firstTap && (
                <div className="mt-2 text-sm">
                  First tap this round: <strong>{firstTap.playerName}</strong>
                </div>
              )}
            </div>
          )}

          {/* Event log */}
          <div className="rounded-2xl p-6 bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Recent events</h3>
              <button
                onClick={() => setLogs([])}
                className="text-xs opacity-70 hover:opacity-100"
              >
                Clear
              </button>
            </div>
            <ul className="mt-3 max-h-60 overflow-auto pr-1 space-y-1 text-xs">
              {logs.length === 0 && (
                <li className="opacity-60">No events yet.</li>
              )}
              {logs.map((l) => (
                <li key={l.ts} className="opacity-90">
                  <span className="opacity-60 mr-2">
                    {new Date(l.ts).toLocaleTimeString()}
                  </span>
                  {l.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* RIGHT: Players */}
        <section className="rounded-2xl p-6 bg-white/5 border border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Players ({players.length})</h2>
            {createdRoom && (
              <div className="text-xs opacity-80">
                Host: <span className="font-semibold">you</span>
              </div>
            )}
          </div>

          {players.length === 0 ? (
            <p className="mt-4 text-sm text-slate-300">
              No players yet. Share the room code so others can join.
            </p>
          ) : (
            <ul className="mt-4 grid sm:grid-cols-2 lg:grid-cols-2 gap-2">
              {players.map((p) => (
                <li
                  key={p.id}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3"
                >
                  <div className="h-8 w-8 rounded-full bg-indigo-400/30 grid place-content-center font-semibold">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-[11px] opacity-70 truncate">
                      {p.id}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Sticky helper for small screens */}
      <div className="lg:hidden fixed bottom-3 inset-x-0 px-4">
        {createdRoom ? (
          <div className="mx-auto max-w-md bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-2 grid grid-cols-4 gap-2">
            <button
              onClick={() => startWithDuration(5)}
              className="px-2 py-2 rounded-lg bg-indigo-500/90 text-xs"
            >
              Start 5s
            </button>
            <button
              onClick={handleReset}
              className="px-2 py-2 rounded-lg bg-amber-400/90 text-black text-xs"
            >
              Reset
            </button>
            <button
              onClick={handleEnd}
              className="px-2 py-2 rounded-lg bg-rose-600 text-xs"
            >
              End
            </button>
            <button
              onClick={handleToggleAllowJoins}
              className="px-2 py-2 rounded-lg bg-white/10 border border-white/20 text-xs"
            >
              {allowJoins ? "Disable" : "Enable"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
