"use client";

import React, { useEffect, useRef, useState } from "react";
import { getSocket } from "../../lib/socket";

type PlayerResult = { playerId: string; playerName: string; tapCount: number };
type FirstTapEvent = {
  playerId: string;
  playerName: string;
  timestamp: number;
};
type GameEndedEvent = { results?: PlayerResult[]; winner?: PlayerResult };
type RoomLike = { host?: string };

export default function JoinPage() {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  const [toast, setToast] = useState<string>(""); // tiny, unobtrusive message
  const [winner, setWinner] = useState<PlayerResult | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);

  const [ownId, setOwnId] = useState<string | null>(null);
  const [bgGreen, setBgGreen] = useState(false);
  const [bgRed, setBgRed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [tapDisabled, setTapDisabled] = useState(true);
  const [isMidJoin, setIsMidJoin] = useState(false);

  const [leaderboard, setLeaderboard] = useState<PlayerResult[]>([]);

  const timerRef = useRef<number | null>(null);
  const endTsRef = useRef<number | null>(null);
  const isMidJoinRef = useRef<boolean>(false);
  const inactivityRef = useRef<number | null>(null);

  const INACTIVITY_SECONDS = 180;

  useEffect(() => {
    const socket = getSocket();

    socket.on(
      "joinedRoom",
      (data: { roomId: string; playerName: string; playerId?: string; room?: RoomLike }) => {
        setJoined(true);
        setToast(`Joined ${data.roomId} as ${data.playerName}`);
        if (data.playerId) setOwnId(data.playerId);
        if (data.room?.host) setHostId(data.room.host);

        if (inactivityRef.current) clearTimeout(inactivityRef.current);
        inactivityRef.current = window.setTimeout(() => {
          try {
            socket.emit("leaveRoom", { roomId: roomId.toUpperCase() });
          } catch {}
          setJoined(false);
          setTapDisabled(true);
          setToast("Inactive — returned to join");
        }, INACTIVITY_SECONDS * 1000);
      }
    );

    socket.on("joinRoomError", (err: { message?: string }) => {
      setToast(err.message || "Failed to join");
    });

    socket.on(
      "gameStarted",
      (data: {
        gameState?: { duration?: number };
        startTime?: number;
        durationMs?: number;
        isMidJoin?: boolean;
      }) => {
        setToast("Game started");
        setBgGreen(false);
        setTapDisabled(true);

        const mid = Boolean(data.isMidJoin);
        setIsMidJoin(mid);
        isMidJoinRef.current = mid;

        setWinner(null);
        setLeaderboard([]);

        const totalMs = data.durationMs ?? data.gameState?.duration ?? 30000;
        const serverStart = data.startTime ?? Date.now();

        if (totalMs) {
          const endTs = serverStart + totalMs;
          endTsRef.current = endTs;
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          const tick = () => {
            if (!endTsRef.current) return;
            const left = Math.max(0, Math.floor((endTsRef.current - Date.now()) / 1000));
            setTimeLeft(left);
            if (left <= 0 && timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
          };
          tick();
          timerRef.current = window.setInterval(tick, 100);
        }
      }
    );

    socket.on("firstTap", (data: FirstTapEvent) => {
      setWinner({
        playerId: data.playerId,
        playerName: data.playerName,
        tapCount: 1,
      });
      // color: winner green, other active participants red (ignore mid-joiners)
      if (ownId && data.playerId === ownId) {
        setBgGreen(true);
        setBgRed(false);
      } else {
        setBgGreen(false);
        if (!isMidJoinRef.current) setBgRed(true);
      }
      setTapDisabled(true);
      if (inactivityRef.current) {
        clearTimeout(inactivityRef.current);
        inactivityRef.current = null;
      }
    });

    socket.on("disableTaps", () => setTapDisabled(true));

    socket.on("timeExpiredNoTap", () => {
      setToast("No taps — taps open");
      if (!isMidJoinRef.current) setTapDisabled(false);
      // stop tick and immediately show 0
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      endTsRef.current = null;
      setTimeLeft(0);
    });

    socket.on("postTimerOpen", (data: { message?: string }) => {
      setToast(data?.message || "Taps open");
      if (!isMidJoinRef.current) setTapDisabled(false);
      // ensure countdown is cleared and shows 0 immediately
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      endTsRef.current = null;
      setTimeLeft(0);
    });

    socket.on("roundReset", (data: { message?: string }) => {
      setToast(data?.message || "Round reset");
      setWinner(null);
      setBgGreen(false);
      setBgRed(false);
      setLeaderboard([]);
      setTapDisabled(false);
      setIsMidJoin(false);
      isMidJoinRef.current = false;
      setTimeLeft(null);

      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      inactivityRef.current = window.setTimeout(() => {
        try {
          socket.emit("leaveRoom", { roomId: roomId.toUpperCase() });
        } catch {}
        setJoined(false);
        setTapDisabled(true);
        setToast("Inactive — returned to join");
      }, INACTIVITY_SECONDS * 1000);
    });

    socket.on("gameEnded", (data: GameEndedEvent) => {
      setToast(`Winner: ${data.winner?.playerName || "N/A"}`);
      setWinner(data.winner || null);
      setTapDisabled(true);
      if (data.results) {
        const filtered = hostId
          ? data.results.filter((r) => r.playerId !== hostId)
          : data.results;
        setLeaderboard(filtered);
      }
      // color screens: winner green, losers red (unless mid-joiners)
      if (data.winner && ownId) {
        if (data.winner.playerId === ownId) {
          setBgGreen(true);
          setBgRed(false);
        } else {
          if (!isMidJoinRef.current) {
            setBgGreen(false);
            setBgRed(true);
          }
        }
      }
      if (inactivityRef.current) {
        clearTimeout(inactivityRef.current);
        inactivityRef.current = null;
      }
    });

    socket.on("disconnect", () => {
      setJoined(false);
      setTapDisabled(true);
      setToast("Disconnected — rejoin");
    });

    // Admin kicked this client (end game)
    socket.on('kicked', (data: { message?: string }) => {
      setToast(data?.message || 'Kicked from room');
      // cleanup local state and return to join
      setJoined(false);
      setTapDisabled(true);
      setIsMidJoin(false);
      isMidJoinRef.current = false;
      setBgGreen(false);
      setBgRed(false);
      setWinner(null);
      setLeaderboard([]);
      setTimeLeft(null);
    });

    socket.on('roomEnded', (data: { message?: string }) => {
      setToast(data?.message || 'Game ended by admin');
      setJoined(false);
      setTapDisabled(true);
      setIsMidJoin(false);
      isMidJoinRef.current = false;
      setBgGreen(false);
      setBgRed(false);
      setWinner(null);
      setLeaderboard([]);
      setTimeLeft(null);
    });

    socket.on('tapDenied', (data: { message?: string }) => {
      // e.g., 'You cannot tap because you already tapped in the last round'
      setToast(data?.message || 'Tap denied');
      // ensure the client doesn't allow tapping again until reset
      setTapDisabled(true);
    });

    // Inactivity tracking
    const activityEvents = ["mousemove", "keydown", "touchstart", "click"];
    const resetInactivity = () => {
      if (inactivityRef.current) {
        clearTimeout(inactivityRef.current);
        inactivityRef.current = null;
      }
      if (joined) {
        inactivityRef.current = window.setTimeout(() => {
          try {
            socket.emit("leaveRoom", { roomId: roomId.toUpperCase() });
          } catch {}
          setJoined(false);
          setTapDisabled(true);
          setToast("Inactive — returned to join");
        }, INACTIVITY_SECONDS * 1000);
      }
    };
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, resetInactivity)
    );

    const beforeUnloadHandler = () => {
      try {
        socket.emit("leaveRoom", { roomId: roomId.toUpperCase() });
      } catch {}
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);

    return () => {
      socket.off("joinedRoom");
      socket.off("joinRoomError");
      socket.off("gameStarted");
      socket.off("firstTap");
      socket.off("disableTaps");
      socket.off("timeExpiredNoTap");
      socket.off("postTimerOpen");
      socket.off("roundReset");
      socket.off("gameEnded");
  socket.off("disconnect");
  socket.off('kicked');
  socket.off('roomEnded');
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, resetInactivity)
      );
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [name, joined, roomId, hostId, ownId]);

  function handleJoin() {
    if (!roomId || !name) {
      setToast("Enter code & name");
      return;
    }
    getSocket().emit("joinRoom", {
      roomId: roomId.toUpperCase(),
      playerName: name,
    });
  }

  function handleTap() {
    if (tapDisabled) return;
    getSocket().emit("tap", { roomId: roomId.toUpperCase() });
    setTapDisabled(true); // prevent double taps locally
  }

  // Whole-screen pointer handler; ignore taps on inputs/buttons when not joined
  function handlePointerTap(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (!joined) return; // join screen shouldn't trigger taps
    if (
      target &&
      (target.closest("button") ||
        target.closest("input") ||
        target.tagName === "A")
    )
      return;
    if (!tapDisabled) handleTap();
  }

  return (
    <div
      className="w-screen h-dvh min-h-screen min-w-full"
      onPointerDown={handlePointerTap}
      onKeyDown={(e) => {
        if (joined && !tapDisabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleTap();
        }
      }}
      tabIndex={0}
      role="button"
    >
      {!joined ? (
        // FULL-SCREEN JOIN
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-full max-w-sm p-4 flex flex-col gap-2">
            <input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="Game code"
              className="p-3 border rounded"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name (unique)"
              className="p-3 border rounded"
            />
            <button
              onClick={handleJoin}
              className="p-3 rounded bg-blue-600 text-white"
            >
              Join
            </button>
            {toast && <div className="text-xs text-gray-600 mt-1">{toast}</div>}
          </div>
        </div>
      ) : (
        // FULL-SCREEN TAP SURFACE
        <div
          className={`w-full h-full relative select-none transition-colors duration-200 ${
            bgGreen ? "bg-green-500" : bgRed ? "bg-red-600" : "bg-gray-200"
          }`}
        >
          {/* Subtle banners */}
          {isMidJoin && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs bg-yellow-300 text-black rounded">
              Joined mid-round — wait next round
            </div>
          )}
          {toast && (
            <div className="absolute top-3 right-3 px-3 py-1 text-xs bg-black/70 text-white rounded">
              {toast}
            </div>
          )}

          {/* Center status */}
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className={`text-6xl font-extrabold mb-2 ${bgGreen || bgRed ? 'text-white' : 'text-black'}`}>
                {bgGreen
                  ? "You tapped first!"
                  : timeLeft !== null
                  ? `${timeLeft}s`
                  : "Waiting…"}
              </div>
              <div
                className={`text-lg ${
                  tapDisabled ? "text-white/80" : (bgGreen || bgRed ? 'text-white' : 'text-black')
                }`}
              >
                {tapDisabled ? "Tap disabled" : "Tap anywhere"}
              </div>
              {winner && !bgGreen && (
                <div className="text-sm mt-2">
                  Winner: <strong>{winner.playerName}</strong>
                </div>
              )}
              {leaderboard && leaderboard.length > 0 && (
                <div className="text-sm mt-3">
                  <div className="font-semibold">Leaderboard</div>
                  <ol className="list-decimal list-inside text-left inline-block mt-1">
                    {leaderboard.map((r) => (
                      <li key={r.playerId} className="text-sm">{r.playerName} — {r.tapCount}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
