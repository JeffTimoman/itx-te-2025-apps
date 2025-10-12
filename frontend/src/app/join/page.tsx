// "use client";

// import React, { useEffect, useRef, useState } from "react";
// import { getSocket } from "../../lib/socket";

// // --- Types ---
// type PlayerResult = { playerId: string; playerName: string; tapCount: number };
// type FirstTapEvent = {
//   playerId: string;
//   playerName: string;
//   timestamp: number;
// };
// type GameEndedEvent = { results?: PlayerResult[]; winner?: PlayerResult };
// type RoomLike = { host?: string };

// /**
//  * JoinPage — polished UX/UI
//  *
//  * Highlights
//  * - Clean split layout (hero + card) on desktop, single column on mobile
//  * - Smart join form: uppercase room code, inline validation, Enter-to-join
//  * - Subtle toasts, status bar, and keyboard help
//  * - Clear game states with color-safe backgrounds and large typography
//  * - Accessible (labels, roles, focus ring, aria-live)
//  */
// export default function JoinPage() {
//   // --- Core state ---
//   const [roomId, setRoomId] = useState("");
//   const [name, setName] = useState("");
//   const [joined, setJoined] = useState(false);

//   // --- UI/UX state ---
//   const [toast, setToast] = useState<string>("");
//   const [winner, setWinner] = useState<PlayerResult | null>(null);
//   const [hostId, setHostId] = useState<string | null>(null);
//   const [ownId, setOwnId] = useState<string | null>(null);
//   const [bgGreen, setBgGreen] = useState(false);
//   const [bgRed, setBgRed] = useState(false);
//   const [timeLeft, setTimeLeft] = useState<number | null>(null);
//   const [tapDisabled, setTapDisabled] = useState(true);
//   const [isMidJoin, setIsMidJoin] = useState(false);
//   const [isJoining, setIsJoining] = useState(false);

//   // --- timers/refs ---
//   const timerRef = useRef<number | null>(null);
//   const endTsRef = useRef<number | null>(null);
//   const isMidJoinRef = useRef<boolean>(false);
//   const inactivityRef = useRef<number | null>(null);

//   const INACTIVITY_SECONDS = 180;

//   // --- Derived validations ---
//   const cleanRoom = (v: string) =>
//     v
//       .toUpperCase()
//       .replace(/[^A-Z0-9]/g, "")
//       .slice(0, 8);
//   const roomValid = roomId.trim().length >= 4; // relax pattern a bit, still guard
//   const nameValid = name.trim().length >= 2;
//   const canJoin = roomValid && nameValid && !isJoining;

//   // --- Effects: socket wiring ---
//   useEffect(() => {
//     const socket = getSocket();

//     socket.on(
//       "joinedRoom",
//       (data: {
//         roomId: string;
//         playerName: string;
//         playerId?: string;
//         room?: RoomLike;
//       }) => {
//         setJoined(true);
//         setIsJoining(false);
//         setToast(`Joined ${data.roomId} as ${data.playerName}`);
//         setBgGreen(false);
//         setBgRed(false);
//         if (data.playerId) setOwnId(data.playerId);
//         if (data.room?.host) setHostId(data.room.host);

//         if (inactivityRef.current) clearTimeout(inactivityRef.current);
//         inactivityRef.current = window.setTimeout(() => {
//           try {
//             socket.emit("leaveRoom", { roomId: roomId.toUpperCase() });
//           } catch {}
//           setJoined(false);
//           setTapDisabled(true);
//           setToast("Inactive — returned to join");
//         }, INACTIVITY_SECONDS * 1000);
//       }
//     );

//     socket.on("joinRoomError", (err: { message?: string }) => {
//       setIsJoining(false);
//       setToast(err.message || "Failed to join");
//     });

//     socket.on(
//       "gameStarted",
//       (data: {
//         gameState?: { duration?: number };
//         startTime?: number;
//         durationMs?: number;
//         isMidJoin?: boolean;
//       }) => {
//         setToast("Game started");
//         setBgGreen(false);
//         setBgRed(false);
//         setTapDisabled(true);

//         const mid = Boolean(data.isMidJoin);
//         setIsMidJoin(mid);
//         isMidJoinRef.current = mid;
//         setWinner(null);

//         const totalMs = data.durationMs ?? data.gameState?.duration ?? 30000;
//         const serverStart = data.startTime ?? Date.now();

//         if (totalMs) {
//           const endTs = serverStart + totalMs;
//           endTsRef.current = endTs;
//           if (timerRef.current) {
//             clearInterval(timerRef.current);
//             timerRef.current = null;
//           }
//           const tick = () => {
//             if (!endTsRef.current) return;
//             const left = Math.max(
//               0,
//               Math.floor((endTsRef.current - Date.now()) / 1000)
//             );
//             setTimeLeft(left);
//             if (left <= 0 && timerRef.current) {
//               clearInterval(timerRef.current);
//               timerRef.current = null;
//             }
//           };
//           tick();
//           timerRef.current = window.setInterval(tick, 100);
//         }
//       }
//     );

//     socket.on("firstTap", (data: FirstTapEvent) => {
//       setWinner({
//         playerId: data.playerId,
//         playerName: data.playerName,
//         tapCount: 1,
//       });
//       if (ownId && data.playerId === ownId) {
//         setBgGreen(true);
//         setBgRed(false);
//       } else {
//         setBgGreen(false);
//         if (!isMidJoinRef.current) setBgRed(true);
//       }
//       setTapDisabled(true);
//       if (inactivityRef.current) {
//         clearTimeout(inactivityRef.current);
//         inactivityRef.current = null;
//       }
//     });

//     socket.on("disableTaps", () => setTapDisabled(true));

//     socket.on("timeExpiredNoTap", () => {
//       setToast("No taps — taps open");
//       if (!isMidJoinRef.current) setTapDisabled(false);
//       if (timerRef.current) {
//         clearInterval(timerRef.current);
//         timerRef.current = null;
//       }
//       endTsRef.current = null;
//       setTimeLeft(0);
//     });

//     socket.on("postTimerOpen", (data: { message?: string }) => {
//       setToast(data?.message || "Taps open");
//       if (!isMidJoinRef.current) setTapDisabled(false);
//       if (timerRef.current) {
//         clearInterval(timerRef.current);
//         timerRef.current = null;
//       }
//       endTsRef.current = null;
//       setTimeLeft(0);
//     });

//     socket.on("roundReset", (data: { message?: string }) => {
//       setToast(data?.message || "Round reset");
//       setWinner(null);
//       setBgGreen(false);
//       setBgRed(false);
//       setTapDisabled(false);
//       setIsMidJoin(false);
//       isMidJoinRef.current = false;
//       setTimeLeft(null);

//       if (inactivityRef.current) clearTimeout(inactivityRef.current);
//       inactivityRef.current = window.setTimeout(() => {
//         try {
//           socket.emit("leaveRoom", { roomId: roomId.toUpperCase() });
//         } catch {}
//         setJoined(false);
//         setTapDisabled(true);
//         setToast("Inactive — returned to join");
//       }, INACTIVITY_SECONDS * 1000);
//     });

//     socket.on("gameEnded", (data: GameEndedEvent) => {
//       setToast(`Winner: ${data.winner?.playerName || "N/A"}`);
//       setWinner(data.winner || null);
//       setTapDisabled(true);
//       if (data.winner && ownId) {
//         if (data.winner.playerId === ownId) {
//           setBgGreen(true);
//           setBgRed(false);
//         } else if (!isMidJoinRef.current) {
//           setBgGreen(false);
//           setBgRed(true);
//         }
//       }
//       if (inactivityRef.current) {
//         clearTimeout(inactivityRef.current);
//         inactivityRef.current = null;
//       }
//     });

//     socket.on("disconnect", () => {
//       setJoined(false);
//       setTapDisabled(true);
//       setToast("Disconnected — rejoin");
//       setIsJoining(false);
//     });

//     socket.on("kicked", (data: { message?: string }) => {
//       setToast(data?.message || "Kicked from room");
//       setJoined(false);
//       setTapDisabled(true);
//       setIsMidJoin(false);
//       isMidJoinRef.current = false;
//       setBgGreen(false);
//       setBgRed(false);
//       setWinner(null);
//       setTimeLeft(null);
//     });

//     socket.on("roomEnded", (data: { message?: string }) => {
//       setToast(data?.message || "Game ended by admin");
//       setJoined(false);
//       setTapDisabled(true);
//       setIsMidJoin(false);
//       isMidJoinRef.current = false;
//       setBgGreen(false);
//       setBgRed(false);
//       setWinner(null);
//       setTimeLeft(null);
//     });

//     socket.on("tapDenied", (data: { message?: string }) => {
//       setToast(data?.message || "Tap denied");
//       setTapDisabled(true);
//     });

//     // Inactivity tracking
//     const activityEvents = ["mousemove", "keydown", "touchstart", "click"];
//     const resetInactivity = () => {
//       if (inactivityRef.current) {
//         clearTimeout(inactivityRef.current);
//         inactivityRef.current = null;
//       }
//       if (joined) {
//         inactivityRef.current = window.setTimeout(() => {
//           try {
//             socket.emit("leaveRoom", { roomId: roomId.toUpperCase() });
//           } catch {}
//           setJoined(false);
//           setTapDisabled(true);
//           setToast("Inactive — returned to join");
//         }, INACTIVITY_SECONDS * 1000);
//       }
//     };
//     activityEvents.forEach((ev) =>
//       window.addEventListener(ev, resetInactivity)
//     );

//     const beforeUnloadHandler = () => {
//       try {
//         socket.emit("leaveRoom", { roomId: roomId.toUpperCase() });
//       } catch {}
//     };
//     window.addEventListener("beforeunload", beforeUnloadHandler);

//     return () => {
//       socket.off("joinedRoom");
//       socket.off("joinRoomError");
//       socket.off("gameStarted");
//       socket.off("firstTap");
//       socket.off("disableTaps");
//       socket.off("timeExpiredNoTap");
//       socket.off("postTimerOpen");
//       socket.off("roundReset");
//       socket.off("gameEnded");
//       socket.off("disconnect");
//       socket.off("kicked");
//       socket.off("roomEnded");
//       socket.off("tapDenied");
//       activityEvents.forEach((ev) =>
//         window.removeEventListener(ev, resetInactivity)
//       );
//       window.removeEventListener("beforeunload", beforeUnloadHandler);
//       if (inactivityRef.current) clearTimeout(inactivityRef.current);
//       if (timerRef.current) clearInterval(timerRef.current);
//     };
//   }, [name, joined, roomId, hostId, ownId]);

//   // --- Actions ---
//   function handleJoin() {
//     if (!roomValid || !nameValid) {
//       setToast("Enter a valid code & name");
//       return;
//     }
//     setIsJoining(true);
//     getSocket().emit("joinRoom", {
//       roomId: roomId.toUpperCase(),
//       playerName: name.trim(),
//     });
//   }

//   function handleTap() {
//     if (tapDisabled) return;
//     getSocket().emit("tap", { roomId: roomId.toUpperCase() });
//     setTapDisabled(true);
//   }

//   // Whole-screen pointer handler; ignore taps on inputs/buttons when not joined
//   function handlePointerTap(e: React.PointerEvent<HTMLDivElement>) {
//     const target = e.target as HTMLElement;
//     if (!joined) return;
//     if (
//       target &&
//       (target.closest("button") ||
//         target.closest("input") ||
//         target.tagName === "A")
//     )
//       return;
//     if (!tapDisabled) handleTap();
//   }

//   // --- UI ---
//   return (
//     <div
//       className="w-screen h-dvh min-h-screen min-w-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100"
//       onPointerDown={handlePointerTap}
//       onKeyDown={(e) => {
//         const isSpace = e.key === " " || e.code === "Space";

//         if (!joined) {
//           // Only Enter submits the join form; Space should type spaces normally
//           if (e.key === "Enter") {
//             const active = document.activeElement as HTMLElement | null;
//             if (
//               active &&
//               (active.tagName === "INPUT" || active.tagName === "BUTTON")
//             ) {
//               e.preventDefault();
//               if (canJoin) handleJoin();
//             }
//           }
//           return; // ignore Space before joined
//         }

//         // After joined: Space/Enter = tap
//         if (!tapDisabled && (isSpace || e.key === "Enter")) {
//           e.preventDefault();
//           handleTap();
//         }
//       }}
//       tabIndex={0}
//       role="application"
//       aria-label="Tap game"
//     >
//       {/* Top Status Bar */}
//       <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/5 bg-white/0 border-b border-white/10">
//         <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
//               ITX
//             </div>
//             <div className="text-sm opacity-80">
//               {joined ? (
//                 <span>
//                   Room{" "}
//                   <span className="font-semibold tracking-wider">
//                     {roomId || "—"}
//                   </span>{" "}
//                   • You: <span className="font-semibold">{name || "—"}</span>
//                 </span>
//               ) : (
//                 <span className="opacity-80">
//                   Application Var For ITX - Join Room to Play!
//                 </span>
//               )}
//             </div>
//           </div>
//           <div className="text-xs opacity-70 hidden sm:block">
//             {joined
//               ? tapDisabled
//                 ? "Tap disabled"
//                 : "Tap anywhere • Space/Enter"
//               : "Ask the code to Panitia TE."}
//           </div>
//         </div>
//       </header>

//       {/* Main */}
//       {!joined ? (
//         <main className="mx-auto max-w-5xl px-4 py-8 md:py-14 grid md:grid-cols-2 gap-8 items-center">
//           {/* Hero */}
//           <section className="hidden md:block">
//             <div className="rounded-3xl p-8 bg-white/5 border border-white/10 shadow-2xl">
//               <h1 className="text-3xl font-extrabold tracking-tight">
//                 ITX - Team Engagement VAR
//               </h1>
//               <p className="mt-3 text-sm leading-relaxed text-slate-300">
//                 App developed for the Team Engagement of ITX.
//               </p>
//               <ul className="mt-6 space-y-2 text-sm text-slate-300">
//                 <li>
//                   • Press <span className="font-semibold">Enter</span> or{" "}
//                   <span className="font-semibold">Space</span> to tap
//                 </li>
//                 <li>• Inactive players auto-leave after 3 minutes</li>
//                 <li>• Mid-joiners wait for the next round</li>
//               </ul>
//             </div>
//           </section>

//           {/* Join Card */}
//           <section>
//             <div className="rounded-3xl p-6 md:p-8 bg-white/5 border border-white/10 shadow-2xl">
//               <h2 className="text-xl font-bold">Join a Room</h2>
//               <p className="mt-1 text-sm text-slate-300">
//                 Ask the host for the code to play games.
//               </p>

//               <div className="mt-6 grid gap-4">
//                 <div>
//                   <label
//                     htmlFor="room"
//                     className="block text-xs uppercase tracking-wider opacity-80 mb-1"
//                   >
//                     Game code
//                   </label>
//                   <input
//                     id="room"
//                     value={roomId}
//                     onChange={(e) => setRoomId(cleanRoom(e.target.value))}
//                     placeholder="e.g., 4F7K"
//                     inputMode="text"
//                     className={`w-full p-3 rounded-xl bg-white/10 border ${
//                       roomValid ? "border-white/20" : "border-red-400/40"
//                     } outline-none focus:ring-2 focus:ring-indigo-400/60`}
//                     aria-invalid={!roomValid}
//                     aria-describedby={!roomValid ? "room-error" : undefined}
//                   />
//                   {!roomValid && (
//                     <p id="room-error" className="mt-1 text-xs text-red-300">
//                       Code must be at least 4 characters (letters/numbers).
//                     </p>
//                   )}
//                 </div>

//                 <div>
//                   <label
//                     htmlFor="name"
//                     className="block text-xs uppercase tracking-wider opacity-80 mb-1"
//                   >
//                     Your name (unique)
//                   </label>
//                   <input
//                     id="name"
//                     value={name}
//                     onChange={(e) => setName(e.target.value)}
//                     placeholder="e.g., U081591 - Jeff"
//                     className={`w-full p-3 rounded-xl bg-white/10 border ${
//                       nameValid ? "border-white/20" : "border-red-400/40"
//                     } outline-none focus:ring-2 focus:ring-indigo-400/60`}
//                     aria-invalid={!nameValid}
//                     aria-describedby={!nameValid ? "name-error" : undefined}
//                   />
//                   {!nameValid && (
//                     <p id="name-error" className="mt-1 text-xs text-red-300">
//                       Name must be at least 2 characters.
//                     </p>
//                   )}
//                 </div>

//                 <button
//                   onClick={handleJoin}
//                   disabled={!canJoin}
//                   className="relative inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold bg-indigo-500/90 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-slate-900 transition"
//                 >
//                   {isJoining && (
//                     <span className="absolute left-4 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
//                   )}
//                   {isJoining ? "Joining…" : "Join"}
//                 </button>

//                 {toast && (
//                   <div
//                     className="text-xs text-slate-200/90 mt-1"
//                     role="status"
//                     aria-live="polite"
//                   >
//                     {toast}
//                   </div>
//                 )}
//               </div>
//             </div>
//           </section>
//         </main>
//       ) : (
//         // --- Play Surface ---
//         <main className="relative w-full h-[calc(100dvh-56px)] select-none">
//           <div
//             className={`absolute inset-0 transition-colors duration-300 ${
//               bgGreen
//                 ? "bg-emerald-600"
//                 : bgRed
//                 ? "bg-rose-600"
//                 : "bg-slate-800"
//             }`}
//           />

//           {/* subtle vignette */}
//           <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12),transparent_60%)]" />

//           {/* Mid-join banner */}
//           {isMidJoin && (
//             <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs bg-amber-300 text-black rounded-full border border-amber-500/50 shadow">
//               Joined mid-round — wait next round
//             </div>
//           )}

//           {/* Toast (top-right) */}
//           {toast && (
//             <div className="absolute top-3 right-3 px-3 py-1 text-xs bg-white/20 text-white rounded-full border border-white/30 backdrop-blur">
//               {toast}
//             </div>
//           )}

//           {/* Center status */}
//           <div className="h-full w-full grid place-items-center">
//             <div className="text-center px-6">
//               <div
//                 className={`text-6xl md:text-7xl font-black tracking-tight drop-shadow-sm ${
//                   bgGreen || bgRed ? "text-white" : "text-white"
//                 }`}
//               >
//                 {bgGreen
//                   ? "You tapped first!"
//                   : timeLeft !== null
//                   ? `${timeLeft}s`
//                   : "Waiting…"}
//               </div>
//               <div
//                 className={`mt-3 text-base md:text-lg ${
//                   tapDisabled ? "text-white/80" : "text-white"
//                 }`}
//               >
//                 {tapDisabled ? "Tap disabled" : "Tap anywhere (Space/Enter)"}
//               </div>
//               {winner && !bgGreen && (
//                 <div className="mt-2 text-sm text-white/90">
//                   Winner: <strong>{winner.playerName}</strong>
//                 </div>
//               )}

//               {/* Progress bar when countdown active */}
//               {typeof timeLeft === "number" && (
//                 <div className="mt-6 h-2 w-[min(80vw,680px)] bg-white/15 rounded-xl overflow-hidden">
//                   <div
//                     className="h-full bg-white/80 transition-all"
//                     style={{
//                       width: `${Math.max(
//                         0,
//                         Math.min(
//                           100,
//                           ((timeLeft ?? 0) * 100) /
//                             Math.max(
//                               1,
//                               endTsRef.current
//                                 ? Math.ceil(
//                                     (endTsRef.current - Date.now()) / 1000
//                                   ) + (timeLeft ?? 0)
//                                 : timeLeft ?? 0
//                             )
//                         )
//                       )}%`,
//                     }}
//                   />
//                 </div>
//               )}
//             </div>
//           </div>
//         </main>
//       )}

//       {/* Bottom helper bar */}
//       <footer className="fixed bottom-0 inset-x-0 z-20 pointer-events-none">
//         <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between text-[11px] text-white/70">
//           <div className="pointer-events-auto">
//             {joined ? (
//               <span>Inactive auto-leave in {INACTIVITY_SECONDS / 60} min</span>
//             ) : (
//               <span>Panitia TE ITX 2025</span>
//             )}
//           </div>
//           <div className="hidden sm:block pointer-events-auto opacity-80">
//             Var For ITX
//           </div>
//         </div>
//       </footer>
//     </div>
//   );
// }

"use client";

import React, { useEffect, useRef, useState } from "react";
import { getSocket } from "../../lib/socket";

// --- Types ---
type PlayerResult = { playerId: string; playerName: string; tapCount: number };
type FirstTapEvent = {
  playerId: string;
  playerName: string;
  timestamp: number;
};
type GameEndedEvent = { results?: PlayerResult[]; winner?: PlayerResult };
type RoomLike = { host?: string };

/**
 * JoinPage — Hogwarts Edition (enchanted parchment + candlelight)
 *
 * Visual tweaks only; socket/game logic preserved.
 * Optional (fonts):
 *   <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600..900&family=Crimson+Pro:wght@400;600;700&display=swap" rel="stylesheet">
 */
export default function JoinPage() {
  // --- Core state ---
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  // --- UI/UX state ---
  const [toast, setToast] = useState<string>("");
  const [winner, setWinner] = useState<PlayerResult | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [ownId, setOwnId] = useState<string | null>(null);
  const [bgGreen, setBgGreen] = useState(false);
  const [bgRed, setBgRed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [tapDisabled, setTapDisabled] = useState(true);
  const [isMidJoin, setIsMidJoin] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // --- timers/refs ---
  const timerRef = useRef<number | null>(null);
  const endTsRef = useRef<number | null>(null);
  const isMidJoinRef = useRef<boolean>(false);
  const inactivityRef = useRef<number | null>(null);

  const INACTIVITY_SECONDS = 180;

  // --- Derived validations ---
  const cleanRoom = (v: string) =>
    v
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
  const roomValid = roomId.trim().length >= 4;
  const nameValid = name.trim().length >= 2;
  const canJoin = roomValid && nameValid && !isJoining;

  // --- Effects: socket wiring ---
  useEffect(() => {
    const socket = getSocket();

    socket.on(
      "joinedRoom",
      (data: {
        roomId: string;
        playerName: string;
        playerId?: string;
        room?: RoomLike;
      }) => {
        setJoined(true);
        setIsJoining(false);
        setToast(`Entered Chamber ${data.roomId} as ${data.playerName}`);
        setBgGreen(false);
        setBgRed(false);
        if (data.playerId) setOwnId(data.playerId);
        if (data.room?.host) setHostId(data.room.host);

        if (inactivityRef.current) clearTimeout(inactivityRef.current);
        inactivityRef.current = window.setTimeout(() => {
          try {
            socket.emit("leaveRoom", { roomId: roomId.toUpperCase() });
          } catch {}
          setJoined(false);
          setTapDisabled(true);
          setToast("Inactive — returned to Great Hall");
        }, INACTIVITY_SECONDS * 1000);
      }
    );

    socket.on("joinRoomError", (err: { message?: string }) => {
      setIsJoining(false);
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
        setToast("Duel has begun");
        setBgGreen(false);
        setBgRed(false);
        setTapDisabled(true);

        const mid = Boolean(data.isMidJoin);
        setIsMidJoin(mid);
        isMidJoinRef.current = mid;
        setWinner(null);

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
            const left = Math.max(
              0,
              Math.floor((endTsRef.current - Date.now()) / 1000)
            );
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
      setToast("No spell cast — wands ready");
      if (!isMidJoinRef.current) setTapDisabled(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      endTsRef.current = null;
      setTimeLeft(0);
    });

    socket.on("postTimerOpen", (data: { message?: string }) => {
      setToast(data?.message || "Wands ready");
      if (!isMidJoinRef.current) setTapDisabled(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      endTsRef.current = null;
      setTimeLeft(0);
    });

    socket.on("roundReset", (data: { message?: string }) => {
      setToast(data?.message || "Round reset");
      setWinner(null);
      setBgGreen(false);
      setBgRed(false);
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
        setToast("Inactive — returned to Great Hall");
      }, INACTIVITY_SECONDS * 1000);
    });

    socket.on("gameEnded", (data: GameEndedEvent) => {
      setToast(`Victor: ${data.winner?.playerName || "N/A"}`);
      setWinner(data.winner || null);
      setTapDisabled(true);
      if (data.winner && ownId) {
        if (data.winner.playerId === ownId) {
          setBgGreen(true);
          setBgRed(false);
        } else if (!isMidJoinRef.current) {
          setBgGreen(false);
          setBgRed(true);
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
      setToast("Connection lost — rejoin");
      setIsJoining(false);
    });

    socket.on("kicked", (data: { message?: string }) => {
      setToast(data?.message || "Removed from chamber");
      setJoined(false);
      setTapDisabled(true);
      setIsMidJoin(false);
      isMidJoinRef.current = false;
      setBgGreen(false);
      setBgRed(false);
      setWinner(null);
      setTimeLeft(null);
    });

    socket.on("roomEnded", (data: { message?: string }) => {
      setToast(data?.message || "Duel ended by host");
      setJoined(false);
      setTapDisabled(true);
      setIsMidJoin(false);
      isMidJoinRef.current = false;
      setBgGreen(false);
      setBgRed(false);
      setWinner(null);
      setTimeLeft(null);
    });

    socket.on("tapDenied", (data: { message?: string }) => {
      setToast(data?.message || "Spell fizzled");
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
          setToast("Inactive — returned to Great Hall");
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
      socket.off("kicked");
      socket.off("roomEnded");
      socket.off("tapDenied");
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, resetInactivity)
      );
      window.removeEventListener("beforeunload", beforeUnloadHandler);
      if (inactivityRef.current) clearTimeout(inactivityRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [name, joined, roomId, hostId, ownId]);

  // --- Actions ---
  function handleJoin() {
    if (!roomValid || !nameValid) {
      setToast("Enter a valid code & name");
      return;
    }
    setIsJoining(true);
    getSocket().emit("joinRoom", {
      roomId: roomId.toUpperCase(),
      playerName: name.trim(),
    });
  }

  function handleTap() {
    if (tapDisabled) return;
    getSocket().emit("tap", { roomId: roomId.toUpperCase() });
    setTapDisabled(true);
  }

  // Whole-screen pointer handler; ignore taps on inputs/buttons when not joined
  function handlePointerTap(e: React.PointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (!joined) return;
    if (
      target &&
      (target.closest("button") ||
        target.closest("input") ||
        target.tagName === "A")
    )
      return;
    if (!tapDisabled) handleTap();
  }

  // --- Theming tokens ---
  const parchmentBg =
    "bg-[radial-gradient(1300px_700px_at_50%_-10%,rgba(244,228,177,0.20),transparent),radial-gradient(900px_520px_at_30%_120%,rgba(124,30,30,0.16),transparent)]";
  const glass =
    "bg-[rgba(36,24,19,0.72)] border border-amber-900/30 backdrop-blur-md";
  const burgundyBtn =
    "bg-[#7c1e1e] hover:bg-[#8f2525] border border-amber-900/40";

  // --- UI ---
  return (
    <div
      className={`w-screen h-dvh min-h-screen min-w-full ${parchmentBg} text-amber-100`}
      onPointerDown={handlePointerTap}
      onKeyDown={(e) => {
        const isSpace = e.key === " " || e.code === "Space";

        if (!joined) {
          if (e.key === "Enter") {
            const active = document.activeElement as HTMLElement | null;
            if (
              active &&
              (active.tagName === "INPUT" || active.tagName === "BUTTON")
            ) {
              e.preventDefault();
              if (canJoin) handleJoin();
            }
          }
          return;
        }

        if (!tapDisabled && (isSpace || e.key === "Enter")) {
          e.preventDefault();
          handleTap();
        }
      }}
      tabIndex={0}
      role="application"
      aria-label="Tap game"
      style={{
        backgroundColor: "#1b1410",
        backgroundImage:
          "radial-gradient(800px 500px at 50% -10%, rgba(244,228,177,0.18), transparent), radial-gradient(700px 400px at 30% 120%, rgba(124,30,30,0.16), transparent)",
      }}
    >
      <style>{`
        @keyframes candleGlow { 0% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35);} 50% { text-shadow: 0 0 22px rgba(212,175,55,0.85), 0 0 6px rgba(255,235,195,0.55);} 100% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35);} }
        .glow { animation: candleGlow 2.4s ease-in-out infinite; }
      `}</style>

      {/* Top Status Bar */}
      <header className="sticky top-0 z-20 supports-[backdrop-filter]:bg-amber-950/20 backdrop-blur border-b border-amber-900/40">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#7c1e1e]/70 border border-amber-900/40 grid place-content-center text-sm font-black font-[Cinzel,serif]">
              HP
            </div>
            <div className="text-sm opacity-85 font-[Crimson Pro,serif]">
              {joined ? (
                <span>
                  Chamber{" "}
                  <span className="font-semibold tracking-wider">
                    {roomId || "—"}
                  </span>{" "}
                  • Wizard: <span className="font-semibold">{name || "—"}</span>
                </span>
              ) : (
                <span className="opacity-85">
                  Hogwarts Tap Duel — Enter Chamber to Play!
                </span>
              )}
            </div>
          </div>
          <div className="text-xs opacity-80 hidden sm:block font-[Crimson Pro,serif]">
            {joined
              ? tapDisabled
                ? "Wands sheathed"
                : "Tap anywhere • Space/Enter"
              : "Ask the Prefects for the code."}
          </div>
        </div>
      </header>

      {/* Main */}
      {!joined ? (
        <main className="mx-auto max-w-5xl px-4 py-8 md:py-14 grid md:grid-cols-2 gap-8 items-center">
          {/* Hero */}
          <section className="hidden md:block">
            <div className={`rounded-3xl p-8 ${glass} shadow-2xl`}>
              <h1 className="text-3xl font-extrabold tracking-tight font-[Cinzel,serif]">
                Hogwarts Tap Duel
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-amber-200/90 font-[Crimson Pro,serif]">
                A friendly duel of reflexes. First to cast wins.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-amber-200/90 font-[Crimson Pro,serif]">
                <li>
                  • Press <span className="font-semibold">Enter</span> or{" "}
                  <span className="font-semibold">Space</span> to cast
                </li>
                <li>• Inactive wizards auto-leave after 3 minutes</li>
                <li>• Mid-joiners wait for the next round</li>
              </ul>
            </div>
          </section>

          {/* Join Card */}
          <section>
            <div className={`rounded-3xl p-6 md:p-8 ${glass} shadow-2xl`}>
              <h2 className="text-xl font-bold font-[Cinzel,serif]">
                Enter a Chamber
              </h2>
              <p className="mt-1 text-sm text-amber-200/90 font-[Crimson Pro,serif]">
                Ask the host for the code to duel.
              </p>

              <div className="mt-6 grid gap-4">
                <div>
                  <label
                    htmlFor="room"
                    className="block text-[11px] uppercase tracking-wider text-amber-300/80 mb-1"
                  >
                    Chamber code
                  </label>
                  <input
                    id="room"
                    value={roomId}
                    onChange={(e) => setRoomId(cleanRoom(e.target.value))}
                    placeholder="e.g., 4F7K"
                    inputMode="text"
                    className={`w-full p-3 rounded-xl bg-amber-950/20 border ${
                      roomValid ? "border-amber-900/40" : "border-red-900/50"
                    } outline-none focus:ring-2 focus:ring-amber-400/60`}
                    aria-invalid={!roomValid}
                    aria-describedby={!roomValid ? "room-error" : undefined}
                  />
                  {!roomValid && (
                    <p
                      id="room-error"
                      className="mt-1 text-xs text-red-300 font-[Crimson Pro,serif]"
                    >
                      Code must be at least 4 characters (letters/numbers).
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className="block text-[11px] uppercase tracking-wider text-amber-300/80 mb-1"
                  >
                    Your name (unique)
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., U081591 - Jeff"
                    className={`w-full p-3 rounded-xl bg-amber-950/20 border ${
                      nameValid ? "border-amber-900/40" : "border-red-900/50"
                    } outline-none focus:ring-2 focus:ring-amber-400/60`}
                    aria-invalid={!nameValid}
                    aria-describedby={!nameValid ? "name-error" : undefined}
                  />
                  {!nameValid && (
                    <p
                      id="name-error"
                      className="mt-1 text-xs text-red-300 font-[Crimson Pro,serif]"
                    >
                      Name must be at least 2 characters.
                    </p>
                  )}
                </div>

                <button
                  onClick={handleJoin}
                  disabled={!canJoin}
                  className={`relative inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold ${burgundyBtn} disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-400 focus-visible:ring-offset-[#1b1410] transition`}
                >
                  {isJoining && (
                    <span className="absolute left-4 inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-100/80 border-t-transparent" />
                  )}
                  {isJoining ? "Entering…" : "Enter"}
                </button>

                {toast && (
                  <div
                    className="text-xs text-amber-100/90 mt-1 font-[Crimson Pro,serif]"
                    role="status"
                    aria-live="polite"
                  >
                    {toast}
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      ) : (
        // --- Play Surface ---
        <main className="relative w-full h-[calc(100dvh-56px)] select-none">
          <div
            className={`absolute inset-0 transition-colors duration-300 ${
              bgGreen
                ? "bg-emerald-700"
                : bgRed
                ? "bg-rose-700"
                : "bg-[#2a211d]"
            }`}
          />

          {/* subtle vignette */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,228,177,0.18),transparent_60%)]" />

          {/* Mid-join banner */}
          {isMidJoin && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs bg-amber-300 text-black rounded-full border border-amber-500/50 shadow font-[Crimson Pro,serif]">
              Joined mid-round — wait next round
            </div>
          )}

          {/* Toast (top-right) */}
          {toast && (
            <div className="absolute top-3 right-3 px-3 py-1 text-xs bg-amber-950/40 text-amber-100 rounded-full border border-amber-900/40 backdrop-blur font-[Crimson Pro,serif]">
              {toast}
            </div>
          )}

          {/* Center status */}
          <div className="h-full w-full grid place-items-center">
            <div className="text-center px-6">
              <div
                className={`text-6xl md:text-7xl font-black tracking-tight drop-shadow-sm glow font-[Cinzel,serif]`}
              >
                {bgGreen
                  ? "You cast first!"
                  : timeLeft !== null
                  ? `${timeLeft}s`
                  : "Awaiting…"}
              </div>
              <div
                className={`mt-3 text-base md:text-lg font-[Crimson Pro,serif] ${
                  tapDisabled ? "text-amber-100/80" : "text-amber-100"
                }`}
              >
                {tapDisabled ? "Wands sheathed" : "Tap anywhere (Space/Enter)"}
              </div>
              {winner && !bgGreen && (
                <div className="mt-2 text-sm text-amber-100/90 font-[Crimson Pro,serif]">
                  Victor: <strong>{winner.playerName}</strong>
                </div>
              )}

              {/* Progress bar when countdown active */}
              {typeof timeLeft === "number" && (
                <div className="mt-6 h-2 w-[min(80vw,680px)] bg-amber-950/30 rounded-xl overflow-hidden border border-amber-900/40">
                  <div
                    className="h-full bg-amber-200 transition-all"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          ((timeLeft ?? 0) * 100) /
                            Math.max(
                              1,
                              endTsRef.current
                                ? Math.ceil(
                                    (endTsRef.current - Date.now()) / 1000
                                  ) + (timeLeft ?? 0)
                                : timeLeft ?? 0
                            )
                        )
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* Bottom helper bar */}
      <footer className="fixed bottom-0 inset-x-0 z-20 pointer-events-none">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between text-[11px] text-amber-100/80">
          <div className="pointer-events-auto font-[Crimson Pro,serif]">
            {joined ? (
              <span>
                Auto-leave in {INACTIVITY_SECONDS / 60} min of inactivity
              </span>
            ) : (
              <span>Hogwarts Games Committee</span>
            )}
          </div>
          <div className="hidden sm:block pointer-events-auto opacity-85 font-[Cinzel,serif]">
            Tap Duel
          </div>
        </div>
      </footer>
    </div>
  );
}
