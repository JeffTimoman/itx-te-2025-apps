// ...removed stray JSX inserted above 'use client' to fix top-level syntax

// export default function GachaPage() {
//   // data
//   const [gifts, setGifts] = useState<GiftAvail[]>([]);
//   const [selectedGift, setSelectedGift] = useState<number | null>(null);
//   const [preview, setPreview] = useState<PreviewWinner | null>(null);

//   // ui
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [success, setSuccess] = useState<string | null>(null); // ✅ soft message instead of alert
//   const [stage, setStage] = useState<
//     "idle" | "drawing" | "reveal" | "refresh-reveal"
//   >("idle");
//   const [isFullscreen, setIsFullscreen] = useState(false);
//   const [revealDone, setRevealDone] = useState(false);
//   const [isMenuOpen, setIsMenuOpen] = useState(false);
//   const [showPreviewName, setShowPreviewName] = useState(false);

//   // code animation
//   const [prefixDisplay, setPrefixDisplay] = useState<string>("CCCC2025"); // placeholder
//   const [suffixDisplay, setSuffixDisplay] = useState<string>("**********");
//   const [isGlitchingPrefix, setIsGlitchingPrefix] = useState(false);
//   const [isGlitchingSuffix, setIsGlitchingSuffix] = useState(false);

//   const hostRef = useRef<HTMLDivElement | null>(null);
//   const menuFirstButtonRef = useRef<HTMLButtonElement | null>(null);

//   // timers
//   const prefixTimer = useRef<number | null>(null);
//   const suffixTimer = useRef<number | null>(null);

//   // confetti instance (works in fullscreen)
//   const confettiInstanceRef = useRef<
//     import("canvas-confetti").ConfettiFn | null
//   >(null);
//   const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

//   // derived
//   const selectedGiftObj = useMemo(
//     () => gifts.find((g) => g.id === selectedGift) || null,
//     [gifts, selectedGift]
//   );

//   const toMsg = (e: unknown) => {
//     if (typeof e === "string") return e;
//     if (!e || typeof e !== "object") return String(e);
//     const obj = e as Record<string, unknown>;
//     if (typeof obj.error === "string") return obj.error;
//     if (typeof obj.message === "string") return obj.message;
//     try {
//       return JSON.stringify(obj);
//     } catch {
//       return String(obj);
//     }
//   };

//   const load = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await authFetch("/api/admin/gifts/available");
//       if (!res.ok) throw await res.json();
//       const data = await res.json();
//       setGifts(data || []);
//       if (!selectedGift && data?.length) setSelectedGift(data[0].id);
//     } catch (e) {
//       setError(toMsg(e));
//     } finally {
//       setLoading(false);
//     }
//   }, [selectedGift]);

//   useEffect(() => {
//     load();
//   }, [load]);

//   // fullscreen handling
//   useEffect(() => {
//     const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
//     document.addEventListener("fullscreenchange", handler);
//     return () => document.removeEventListener("fullscreenchange", handler);
//   }, []);

//   async function enterFullscreen() {
//     try {
//       await hostRef.current?.requestFullscreen();
//       await ensureConfettiInstance();
//     } catch {}
//   }
//   async function exitFullscreen() {
//     try {
//       if (document.fullscreenElement) await document.exitFullscreen();
//       await ensureConfettiInstance();
//     } catch {}
//   }

//   // parse code
//   function splitCode(code?: string | null): { prefix: string; suffix: string } {
//     if (!code) return { prefix: "", suffix: "" };
//     const [preRaw = "", sufRaw = ""] = code.split("-");
//     const prefix = preRaw.slice(0, 8);
//     const digits = (sufRaw.match(/\d/g) || []).join("").slice(0, SUFFIX_LEN);
//     const suffix = digits.padEnd(SUFFIX_LEN, "0");
//     return { prefix, suffix };
//   }

//   // confetti bound to hostRef so it renders in fullscreen too
//   async function ensureConfettiInstance() {
//     const confettiMod = await import("canvas-confetti");

//     const root =
//       (document.fullscreenElement as HTMLElement | null) ??
//       hostRef.current ??
//       document.body;

//     // Remove any old canvas so we don’t stack them
//     if (confettiCanvasRef.current?.parentNode) {
//       confettiCanvasRef.current.parentNode.removeChild(
//         confettiCanvasRef.current
//       );
//     }
//     confettiCanvasRef.current = null;

//     // Create a dedicated canvas and put it on top
//     const canvas = document.createElement("canvas");
//     canvas.style.position = "fixed";
//     canvas.style.inset = "0";
//     canvas.style.width = "100%";
//     canvas.style.height = "100%";
//     canvas.style.pointerEvents = "none";
//     canvas.style.zIndex = "2147483647";
//     root.appendChild(canvas);
//     confettiCanvasRef.current = canvas;

//     // Bind confetti to the canvas
//     confettiInstanceRef.current = confettiMod.create(canvas, {
//       resize: true,
//       useWorker: false,
//     });
//   }

//   function removeConfettiCanvas() {
//     if (confettiCanvasRef.current?.parentNode) {
//       confettiCanvasRef.current.parentNode.removeChild(
//         confettiCanvasRef.current
//       );
//     }
//     confettiCanvasRef.current = null;
//     confettiInstanceRef.current = null;
//   }

//   async function burstConfetti(power: "big" | "small") {
//     if (!confettiInstanceRef.current) await ensureConfettiInstance();
//     const confetti = confettiInstanceRef.current!;

//     const base = {
//       spread: power === "big" ? 80 : 55,
//       startVelocity: power === "big" ? 55 : 35,
//       ticks: power === "big" ? 400 : 250,
//       gravity: 0.9,
//       zIndex: 2147483647,
//     } as const;

//     const center = { x: 0.5, y: 0.45 };
//     confetti({
//       ...base,
//       particleCount: power === "big" ? 160 : 60,
//       origin: center,
//     });
//     confetti({
//       ...base,
//       particleCount: power === "big" ? 120 : 40,
//       origin: { x: 0.2, y: 0.6 },
//     });
//     confetti({
//       ...base,
//       particleCount: power === "big" ? 120 : 40,
//       origin: { x: 0.8, y: 0.6 },
//     });
//   }

//   // cleanup timers
//   useEffect(() => {
//     return () => {
//       if (prefixTimer.current) window.clearTimeout(prefixTimer.current);
//       if (suffixTimer.current) window.clearTimeout(suffixTimer.current);
//       removeConfettiCanvas();
//     };
//   }, []);

//   // ✅ Central reset that returns the gacha to clean state
//   const resetGacha = useCallback(() => {
//     if (prefixTimer.current) window.clearTimeout(prefixTimer.current);
//     if (suffixTimer.current) window.clearTimeout(suffixTimer.current);
//     setPreview(null);
//     setStage("idle");
//     setRevealDone(false);
//     setIsGlitchingPrefix(false);
//     setIsGlitchingSuffix(false);
//     setPrefixDisplay("CCCC2025"); // back to placeholder header
//     setSuffixDisplay("**********");
//     setShowPreviewName(false);
//     removeConfettiCanvas();
//   }, []);

//   // generic glitch helper (used for prefix & suffix)
//   function glitchReveal({
//     target,
//     spectacular,
//     isDigitsOnly,
//     onFrame,
//     onDone,
//     phase,
//   }: {
//     target: string;
//     spectacular: boolean;
//     isDigitsOnly: boolean;
//     onFrame: (s: string) => void;
//     onDone?: () => void;
//     phase: "prefix" | "suffix";
//   }) {
//     const alphabetLetters = "ABCDEFGHJKMNPQRSTUVWXYZ";
//     const alphabetDigits = "0123456789";
//     const alphabetSymbols = "@#$%&*+-";
//     const alphabet = isDigitsOnly
//       ? alphabetDigits
//       : alphabetLetters + alphabetDigits + alphabetSymbols;

//     const GLITCH_MS =
//       phase === "prefix"
//         ? spectacular
//           ? GLITCH_MS_FIRST_PREFIX
//           : GLITCH_MS_REFRESH_PREFIX
//         : spectacular
//         ? GLITCH_MS_FIRST_SUFFIX
//         : GLITCH_MS_REFRESH_SUFFIX;

//     const DECODE_MS =
//       phase === "prefix"
//         ? spectacular
//           ? DECODE_MS_FIRST_PREFIX
//           : DECODE_MS_REFRESH_PREFIX
//         : spectacular
//         ? DECODE_MS_FIRST_SUFFIX
//         : DECODE_MS_REFRESH_SUFFIX;

//     const start = performance.now();
//     if (phase === "prefix") setIsGlitchingPrefix(true);
//     if (phase === "suffix") setIsGlitchingSuffix(true);

//     const tick = () => {
//       const now = performance.now();
//       const elapsed = now - start;

//       // Phase 1: pure glitch
//       if (elapsed < GLITCH_MS) {
//         const scrambled = Array.from(
//           { length: target.length },
//           () => alphabet[Math.floor(Math.random() * alphabet.length)]
//         ).join("");
//         onFrame(scrambled);
//         const delay = spectacular ? 33 : 28;
//         const handle = window.setTimeout(tick, delay);
//         if (phase === "prefix") prefixTimer.current = handle;
//         else suffixTimer.current = handle;
//         return;
//       }

//       // Phase 2: decode L->R
//       const decodeElapsed = elapsed - GLITCH_MS;
//       const t = Math.min(1, decodeElapsed / DECODE_MS);
//       const revealCount = Math.floor(t * target.length);

//       const decoded = target
//         .split("")
//         .map((ch, i) =>
//           i < revealCount
//             ? ch
//             : alphabet[Math.floor(Math.random() * alphabet.length)]
//         )
//         .join("");

//       onFrame(decoded);

//       if (t < 1) {
//         const delay = spectacular ? 30 : 24;
//         const handle = window.setTimeout(tick, delay);
//         if (phase === "prefix") prefixTimer.current = handle;
//         else suffixTimer.current = handle;
//       } else {
//         onFrame(target);
//         if (phase === "prefix") setIsGlitchingPrefix(false);
//         if (phase === "suffix") setIsGlitchingSuffix(false);
//         onDone?.();
//       }
//     };

//     tick();
//   }

//   // Orchestrate sequential glitch: prefix first, then suffix. Confetti after suffix.
//   function startRevealSequence(
//     prefix: string,
//     suffix: string,
//     spectacular: boolean
//   ) {
//     setRevealDone(false);
//     setPrefixDisplay(prefix ? "********" : "");
//     setSuffixDisplay("**********");

//     glitchReveal({
//       target: prefix,
//       spectacular,
//       isDigitsOnly: false,
//       onFrame: setPrefixDisplay,
//       phase: "prefix",
//       onDone: () => {
//         glitchReveal({
//           target: suffix,
//           spectacular,
//           isDigitsOnly: true,
//           onFrame: setSuffixDisplay,
//           phase: "suffix",
//           onDone: () => {
//             setRevealDone(true);
//             burstConfetti(spectacular ? "big" : "small");
//           },
//         });
//       },
//     });
//   }

//   async function pickRandom(spectacular: boolean) {
//     if (!selectedGift) return setError("Select a gift first");
//     setError(null);
//     setLoading(true);
//     setStage("drawing");
//     setRevealDone(false);
//     setIsMenuOpen(false); // hide menu on start

//     try {
//       const res = await authFetch(
//         `/api/admin/gifts/${selectedGift}/random-winner`,
//         { method: "POST" }
//       );
//       if (!res.ok) throw await res.json();
//       const data = (await res.json()) as PreviewWinner;
//       setPreview(data);

//       const { prefix, suffix } = splitCode(data.gacha_code || "");
//       const nextStage = spectacular ? "reveal" : "refresh-reveal";
//       setStage(nextStage);

//       startRevealSequence(
//         prefix || "********",
//         suffix || "0000000000",
//         spectacular
//       );
//     } catch (e) {
//       setError(toMsg(e));
//       setStage("idle");
//       setIsGlitchingPrefix(false);
//       setIsGlitchingSuffix(false);
//       setRevealDone(true);
//     } finally {
//       setLoading(false);
//     }
//   }

//   // ✅ Save without alert; show soft banner and reset all state
//   async function saveWinner() {
//     if (!selectedGift || !preview) return setError("No preview available");
//     setLoading(true);
//     setError(null);
//     try {
//       const res = await authFetch(
//         `/api/admin/gifts/${selectedGift}/save-winner`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ registrant_id: preview.id }),
//         }
//       );
//       if (!res.ok) throw await res.json();
//       await load();
//       setSuccess("Winner saved.");
//       resetGacha();
//       // auto-hide success
//       setTimeout(() => setSuccess(null), 2500);
//     } catch (e) {
//       setError(toMsg(e));
//     } finally {
//       setLoading(false);
//     }
//   }

//   // accessibility niceties: Esc closes menu & focus first button when opened
//   useEffect(() => {
//     const onKey = (e: KeyboardEvent) => {
//       if (e.key === "Escape") setIsMenuOpen(false);
//     };
//     if (isMenuOpen) {
//       document.addEventListener("keydown", onKey);
//       setTimeout(() => menuFirstButtonRef.current?.focus(), 0);
//     }
//     return () => document.removeEventListener("keydown", onKey);
//   }, [isMenuOpen]);

//   // Ensure a confetti instance exists at least once
//   useEffect(() => {
//     ensureConfettiInstance();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const remaining = (g: GiftAvail) =>
//     Math.max(0, (g.quantity ?? 0) - (g.awarded ?? 0));

//   const cyberBg =
//     "bg-[radial-gradient(1000px_600px_at_50%_-10%,rgba(99,102,241,0.25),transparent),radial-gradient(800px_400px_at_30%_120%,rgba(16,185,129,0.18),transparent)]";

//   const { prefix: realPrefix } = splitCode(preview?.gacha_code);

//   return (
//     <div
//       ref={hostRef}
//       className={`min-h-screen ${cyberBg} from-slate-950 via-slate-950 to-slate-950 text-slate-100 relative overflow-hidden`}
//     >
//       {/* glitch styles */}
//       <style>{`
//         @keyframes glowPulse {
//           0% { text-shadow: 0 0 14px rgba(99,102,241,0.55), 0 0 2px rgba(255,255,255,0.4); }
//           50% { text-shadow: 0 0 26px rgba(99,102,241,0.8), 0 0 6px rgba(255,255,255,0.6); }
//           100% { text-shadow: 0 0 14px rgba(99,102,241,0.55), 0 0 2px rgba(255,255,255,0.4); }
//         }
//         @keyframes glitchShift {
//           0% { transform: translate(0,0) skew(0deg); filter: hue-rotate(0deg); }
//           20% { transform: translate(0.5px,-0.6px) skew(0.1deg); }
//           40% { transform: translate(-0.6px,0.4px) skew(-0.15deg); }
//           60% { transform: translate(0.4px,0.6px) skew(0.12deg); }
//           80% { transform: translate(-0.5px,-0.4px) skew(-0.1deg); }
//           100% { transform: translate(0,0) skew(0deg); filter: hue-rotate(0deg); }
//         }
//         .glitching { animation: glitchShift 120ms infinite steps(2,end); }
//         .glow { animation: glowPulse 2.2s ease-in-out infinite; }
//       `}</style>

//       {/* Header — HIDE IN FULLSCREEN */}
//       {!isFullscreen && (
//         <AdminHeader title={"Let's become a winner!"}>
//           <button
//             onClick={() =>
//               isFullscreen ? exitFullscreen() : enterFullscreen()
//             }
//             className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs hover:bg-white/15"
//           >
//             {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
//           </button>
//           <button
//             onClick={() => setIsMenuOpen((v) => !v)}
//             className="px-3 py-1.5 rounded-lg bg-indigo-500/90 hover:bg-indigo-500 text-xs font-semibold"
//             aria-expanded={isMenuOpen}
//             aria-controls="gacha-controls"
//           >
//             {isMenuOpen ? "Close Menu" : "Open Menu"}
//           </button>
//         </AdminHeader>
//       )}

//       {/* ✅ Fullscreen FAB → hamburger icon with lower opacity */}
//       {isFullscreen && (
//         <button
//           onClick={() => setIsMenuOpen((v) => !v)}
//           className="fixed z-[10000] right-4 bottom-4 rounded-full p-3 bg-slate-900/70 border border-white/20 shadow-lg text-white opacity-80 hover:opacity-100 backdrop-blur-md"
//           aria-label={isMenuOpen ? "Close Menu" : "Open Menu"}
//           aria-expanded={isMenuOpen}
//           aria-controls="gacha-controls"
//         >
//           {isMenuOpen ? (
//             // X icon
//             <svg
//               width="22"
//               height="22"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <line x1="18" y1="6" x2="6" y2="18"></line>
//               <line x1="6" y1="6" x2="18" y2="18"></line>
//             </svg>
//           ) : (
//             // Hamburger icon
//             <svg
//               width="22"
//               height="22"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <line x1="4" y1="6" x2="20" y2="6"></line>
//               <line x1="4" y1="12" x2="20" y2="12"></line>
//               <line x1="4" y1="18" x2="20" y2="18"></line>
//             </svg>
//           )}
//         </button>
//       )}

//       {/* Slide-in Menu (backdrop + panel) */}
//       <AnimatePresence initial={false}>
//         {isMenuOpen && (
//           <>
//             {/* Backdrop */}
//             <motion.button
//               key="menu-backdrop"
//               onClick={() => setIsMenuOpen(false)}
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               className="fixed inset-0 z-[9998] bg-black/40"
//               aria-label="Close menu"
//             />
//             {/* Panel */}
//             <motion.aside
//               key="menu-panel"
//               initial={{ x: -320, opacity: 0 }}
//               animate={{ x: 0, opacity: 1 }}
//               exit={{ x: -320, opacity: 0 }}
//               transition={{ type: "spring", stiffness: 260, damping: 24 }}
//               className="fixed left-0 top-0 bottom-0 z-[9999] w-[320px] max-w-[85vw] bg-slate-900/90 border-r border-white/10 backdrop-blur-xl p-6 overflow-y-auto"
//               role="dialog"
//               aria-modal="true"
//               aria-label="Gacha Controls"
//               id="gacha-controls"
//             >
//               <div className="space-y-5">
//                 <div className="flex items-center justify-between">
//                   <h2 className="text-sm font-semibold text-white/90">
//                     Controls
//                   </h2>
//                   <button
//                     ref={menuFirstButtonRef}
//                     onClick={() => setIsMenuOpen(false)}
//                     className="px-2.5 py-1 rounded-md bg-white/10 border border-white/20 text-xs hover:bg-white/15"
//                   >
//                     Close
//                   </button>
//                 </div>

//                 {error && (
//                   <div className="text-xs rounded-md border border-red-400/30 bg-red-500/10 text-red-200 p-2">
//                     {error}
//                   </div>
//                 )}

//                 {/* Gift picker */}
//                 <div>
//                   <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
//                     Gift
//                   </div>
//                   <div className="space-y-2 max-h-56 overflow-auto pr-1">
//                     {loading && (
//                       <div className="text-xs text-white/70">Loading…</div>
//                     )}
//                     {!loading && gifts.length === 0 && (
//                       <div className="text-xs text-white/60">
//                         No gifts available.
//                       </div>
//                     )}
//                     {gifts.map((g) => {
//                       const rem = remaining(g);
//                       const disabled = rem <= 0;
//                       return (
//                         <label
//                           key={g.id}
//                           className={`flex items-center justify-between gap-2 rounded-md border p-2 text-xs ${
//                             selectedGift === g.id
//                               ? "border-indigo-400/50 bg-indigo-400/10"
//                               : "border-white/10 bg-white/5 hover:bg-white/8"
//                           } ${disabled ? "opacity-60" : ""}`}
//                         >
//                           <div className="flex items-center gap-2">
//                             <input
//                               type="radio"
//                               name="gift"
//                               value={g.id}
//                               checked={selectedGift === g.id}
//                               onChange={() => setSelectedGift(g.id)}
//                               disabled={disabled}
//                             />
//                             <div className="font-medium">{g.name}</div>
//                           </div>
//                           <div className="tabular-nums text-white/70">
//                             {g.awarded}/{g.quantity}
//                           </div>
//                         </label>
//                       );
//                     })}
//                   </div>
//                   <div className="mt-2">
//                     <button
//                       onClick={load}
//                       className="text-xs px-2.5 py-1 rounded-md border border-white/20 bg-white/10 hover:bg-white/15"
//                     >
//                       Reload Gifts
//                     </button>
//                   </div>
//                 </div>

//                 {/* Actions */}
//                 <div className="border-t border-white/10 pt-4">
//                   <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
//                     Actions
//                   </div>
//                   <div className="grid grid-cols-1 gap-2">
//                     <button
//                       onClick={() => pickRandom(true)}
//                       disabled={
//                         loading ||
//                         !selectedGift ||
//                         Boolean(
//                           selectedGiftObj && remaining(selectedGiftObj) <= 0
//                         )
//                       }
//                       className="px-3 py-2 rounded-md bg-indigo-500/90 hover:bg-indigo-500 border border-indigo-300/30 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
//                     >
//                       Get Winner
//                     </button>
//                     <button
//                       onClick={() => pickRandom(false)}
//                       disabled={
//                         loading ||
//                         !selectedGift ||
//                         Boolean(
//                           selectedGiftObj && remaining(selectedGiftObj) <= 0
//                         )
//                       }
//                       className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 border border-white/20 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
//                     >
//                       Refresh Winner
//                     </button>
//                     <button
//                       onClick={saveWinner}
//                       disabled={loading || !preview || !selectedGift}
//                       className="px-3 py-2 rounded-md bg-emerald-500/90 hover:bg-emerald-500 border border-emerald-300/30 text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
//                     >
//                       Save Winner
//                     </button>
//                   </div>
//                 </div>

//                 {/* Preview */}
//                 <div className="border-t border-white/10 pt-4">
//                   <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
//                     Preview
//                   </div>
//                   {preview ? (
//                     <div className="text-xs space-y-2">
//                       <div className="flex items-center justify-between">
//                         <div>
//                           <span className="text-white/70">Name:</span>
//                         </div>
//                         <div className="flex items-center gap-2">
//                           <span className="font-medium">
//                             {showPreviewName ? preview.name : "Hidden"}
//                           </span>
//                           <button
//                             onClick={() => setShowPreviewName((v) => !v)}
//                             className="px-2 py-0.5 text-xs rounded bg-white/6 border border-white/10"
//                           >
//                             {showPreviewName ? "Hide" : "Show"}
//                           </button>
//                         </div>
//                       </div>

//                       <div className="font-mono text-[13px] break-words">
//                         <span className="text-white/70">Code:</span>{" "}
//                         <span className="font-mono">
//                           {(() => {
//                             const { prefix, suffix } = splitCode(
//                               preview.gacha_code
//                             );
//                             return `${prefix || "********"}-${
//                               suffix ? suffix : "**********"
//                             }`;
//                           })()}
//                         </span>
//                       </div>
//                     </div>
//                   ) : (
//                     <div className="text-xs text-white/60">
//                       No winner preview yet.
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </motion.aside>
//           </>
//         )}
//       </AnimatePresence>

//       {/* Main — CENTERED STAGE */}
//       <main className="px-4 py-8 min-h-screen flex items-center justify-center">
//         <section className="relative rounded-2xl p-0 bg-transparent w-full max-w-4xl">
//           {/* Neon grid backdrop */}
//           <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none bg-[linear-gradient(0deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:36px_36px]" />

//           <div className="w-full grid place-items-center px-4 py-8 text-center">
//             <AnimatePresence mode="wait">
//               {!preview ? (
//                 <motion.div
//                   key="idle"
//                   initial={{ opacity: 0, scale: 0.98 }}
//                   animate={{ opacity: 1, scale: 1 }}
//                   exit={{ opacity: 0, scale: 0.98 }}
//                   className="text-slate-300"
//                 >
//                   <div className="text-4xl font-black tracking-tight">
//                     Ready to draw
//                   </div>
//                   <p className="mt-2 opacity-80">
//                     Check email for code to{" "}
//                     <span className="font-semibold">Win Reward!</span>.
//                   </p>
//                 </motion.div>
//               ) : (
//                 <motion.div
//                   key={stage}
//                   initial={{ opacity: 0, y: 20 }}
//                   animate={{ opacity: 1, y: 0 }}
//                   exit={{ opacity: 0, y: -20 }}
//                   className="w-full"
//                 >
//                   <motion.div
//                     layout
//                     className="text-lg md:text-2xl font-bold uppercase tracking-widest text-indigo-100 drop-shadow mb-4"
//                   >
//                     {selectedGiftObj?.name}
//                   </motion.div>

//                   {/* PPPP2025-XXXXXXXXXX */}
//                   <div className="mt-1 font-mono text-emerald-200/90">
//                     <span
//                       className={`text-lg md:text-2xl inline-block px-2 ${
//                         isGlitchingPrefix ? "glitching glow" : "glow"
//                       }`}
//                     >
//                       {realPrefix ? prefixDisplay : "********"}
//                     </span>
//                     <span className="opacity-40">-</span>
//                   </div>

//                   <div className="mt-2">
//                     <motion.div
//                       key={suffixDisplay}
//                       initial={{ opacity: 0, scale: 0.96 }}
//                       animate={{ opacity: 1, scale: 1 }}
//                       transition={{
//                         type: "spring",
//                         stiffness: 300,
//                         damping: 20,
//                       }}
//                       className={`inline-block px-6 py-4 rounded-2xl border border-white/30 bg-white/10 font-mono text-4xl md:text-6xl tracking-widest select-none text-emerald-50 shadow-xl ${
//                         isGlitchingSuffix ? "glitching glow" : "glow"
//                       }`}
//                     >
//                       {suffixDisplay}
//                     </motion.div>
//                   </div>
//                 </motion.div>
//               )}
//             </AnimatePresence>
//           </div>
//         </section>
//       </main>

//       {/* ✅ Soft success banner (auto-hides) */}
//       <AnimatePresence>
//         {success && (
//           <motion.div
//             initial={{ opacity: 0, y: 10 }}
//             animate={{ opacity: 1, y: 0 }}
//             exit={{ opacity: 0, y: 10 }}
//             className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10001] px-4 py-2 rounded-lg bg-emerald-500/90 border border-emerald-300/30 text-white shadow-lg"
//             role="status"
//             aria-live="polite"
//           >
//             {success}
//           </motion.div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }

"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import authFetch from "../../../lib/api/client";
import AdminHeader from "../../../components/AdminHeader";
import { motion, AnimatePresence } from "framer-motion";

/**
 * GachaPage — parchment + candlelight + AUDIO (Harry Potter vibe)
 *
 * Fixes:
 * 1) Ensure WebAudio context resumes on interaction (some browsers start "suspended").
 * 2) Route every sound through masterGain so Mute/Volume always work.
 * 3) Make menu controls call ensureCtx() before changing volume/mute.
 * 4) Keep your /public/*.mp3 fallbacks.
 */

type GiftAvail = {
  id: number;
  name: string;
  description?: string | null;
  quantity: number;
  awarded: number;
  gift_category_id?: number | null;
};

type PreviewWinner = { id: number; name: string; gacha_code?: string | null };

// Timings (unchanged)
// Shortened timings for snappier winner reveals
const GLITCH_MS_FIRST_PREFIX = 1200; // initial prefix glitch duration (was 2200)
const GLITCH_MS_FIRST_SUFFIX = 3000; // initial suffix/drum-roll (was 6000)
const GLITCH_MS_REFRESH_PREFIX = 300; // refresh prefix glitch (was 500)
const GLITCH_MS_REFRESH_SUFFIX = 800; // refresh suffix glitch (was 2000)

const DECODE_MS_FIRST_PREFIX = 220; // decode phase for prefix (was 360)
const DECODE_MS_FIRST_SUFFIX = 600; // decode phase for suffix (was 1200)
const DECODE_MS_REFRESH_PREFIX = 120; // refresh decode prefix (was 220)
const DECODE_MS_REFRESH_SUFFIX = 200; // refresh decode suffix (was 400)

const SUFFIX_LEN = 10; // 10 digits

// ------------------
// Audio Engine (Web Audio)
// ------------------

type LoopEntry =
  | { src: AudioBufferSourceNode; gain: GainNode }
  | { stop: () => void }
  | null;

class AudioKit {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  lowpass: BiquadFilterNode | null = null; // for buildup sweeps
  buffers: Record<string, AudioBuffer | null> = {};
  loops: Record<string, LoopEntry> = {};
  muted = false;
  volume = 0.9;

  urls = {
    drumloop: process.env.NEXT_PUBLIC_SFX_DRUMLOOP || "/drum-roll.mp3",
    whoosh: process.env.NEXT_PUBLIC_SFX_WHOOSH || "/whoosh.mp3",
    tick: process.env.NEXT_PUBLIC_SFX_TICK || "/clock-ticking.mp3",
    chime: process.env.NEXT_PUBLIC_SFX_CHIME || "/victory-chime.mp3",
    fanfare: process.env.NEXT_PUBLIC_SFX_FANFARE || "/fanfare.mp3",
  } as const;

  // Create or resume the context; safe to call on every user gesture
  async ensureCtx() {
    if (!this.ctx) {
      const audioWindow = window as Window & {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctx = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
      if (!Ctx) return; // WebAudio unavailable

      // create context and resume immediately (user gesture required by browsers)
      this.ctx = new Ctx();
      try {
        if (this.ctx.state === "suspended") await this.ctx.resume();
      } catch {}

      // Nodes
      this.masterGain = this.ctx.createGain();
      this.lowpass = this.ctx.createBiquadFilter();
      this.lowpass.type = "lowpass";
      this.lowpass.frequency.value = 18000; // neutral

      // Wiring: everything -> lowpass -> masterGain -> destination
      if (this.lowpass && this.masterGain && this.ctx)
        this.lowpass.connect(this.masterGain);
      if (this.masterGain && this.ctx)
        this.masterGain.connect(this.ctx.destination);

      // Apply current mute/volume using setValueAtTime for immediate effect
      if (this.masterGain && this.ctx)
        this.masterGain.gain.setValueAtTime(
          this.muted ? 0 : this.volume,
          this.ctx.currentTime
        );

      // Preload assets (non‑blocking for small files)
      await Promise.all(
        Object.entries(this.urls).map(async ([key, url]) => {
          if (!url) return (this.buffers[key] = null);
          try {
            const res = await fetch(url);
            const arr = await res.arrayBuffer();
            if (!this.ctx) return (this.buffers[key] = null);
            const buf = await this.ctx.decodeAudioData(arr);
            this.buffers[key] = buf;
          } catch {
            this.buffers[key] = null; // fallback to synth
          }
        })
      );
    }

    // Resume if suspended (Chrome/iOS policy)
    try {
      if (this.ctx?.state === "suspended") await this.ctx.resume();
    } catch {}
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      } catch {}
      this.masterGain.gain.setValueAtTime(
        m ? 0 : this.volume,
        this.ctx.currentTime
      );
    }
  }

  setVolume(v: number) {
    const vv = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
    this.volume = vv;
    if (!this.masterGain || !this.ctx) return;
    try {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    } catch {}
    // Keep mute behavior: gain stays 0 while muted,
    // but we still store the latest desired volume in this.volume.
    this.masterGain.gain.setValueAtTime(
      this.muted ? 0 : vv,
      this.ctx.currentTime
    );
  }

  // Utility: simple synthesized whoosh if no asset
  synthWhoosh(duration = 0.5) {
    if (!this.ctx || !this.lowpass) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 220;
    g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, this.ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(
      0.0001,
      this.ctx.currentTime + duration
    );
    o.connect(g);
    g.connect(this.lowpass);
    o.start();
    o.frequency.exponentialRampToValueAtTime(
      60,
      this.ctx.currentTime + duration
    );
    o.stop(this.ctx.currentTime + duration + 0.05);
  }

  // Utility: tick for refresh mode
  synthTick() {
    if (!this.ctx || !this.lowpass) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g);
    g.connect(this.lowpass);
    o.start();
    o.stop(this.ctx.currentTime + 0.06);
  }

  // Utility: chime (HP‑ish)
  synthChime() {
    if (!this.ctx || !this.lowpass) return;
    const t0 = this.ctx.currentTime;
    const freqs = [659.25, 783.99, 987.77];
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5 / (i + 1), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2 + i * 0.05);
      o.connect(g);
      g.connect(this.lowpass!);
      o.start(t0 + i * 0.02);
      o.stop(t0 + 1.3 + i * 0.05);
    });
  }

  // Utility: short fanfare (stacked fifth)
  synthFanfare() {
    if (!this.ctx || !this.lowpass) return;
    const t0 = this.ctx.currentTime;
    const freqs = [392.0, 587.33, 783.99];
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = "sawtooth";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.4 / (i + 1), t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0 + i * 0.05);
      o.connect(g);
      g.connect(this.lowpass!);
      o.start(t0 + i * 0.04);
      o.stop(t0 + 1.1 + i * 0.05);
    });
  }

  async play(name: keyof AudioKit["urls"]) {
    await this.ensureCtx();
    if (!this.ctx) return;
    const buf = this.buffers[name];
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.lowpass!);
      src.start();
    } else {
      if (name === "whoosh") this.synthWhoosh();
      else if (name === "tick") this.synthTick();
      else if (name === "chime") this.synthChime();
      else if (name === "fanfare") this.synthFanfare();
    }
  }

  async startLoop(name: keyof AudioKit["urls"], opts?: { gain?: number }) {
    await this.ensureCtx();
    if (!this.ctx) return;
    const buf = this.buffers[name];
    if (!buf) {
      // synth substitute: gated low tom pattern
      if (name === "drumloop") {
        const g = this.ctx.createGain();
        g.gain.value = (opts?.gain ?? 0.6) * 0.6;
        g.connect(this.lowpass!);
        let alive = true;
        const tick = () => {
          if (!alive || !this.ctx) return;
          const o = this.ctx.createOscillator();
          const eg = this.ctx.createGain();
          o.type = "sine";
          o.frequency.value = 120;
          eg.gain.setValueAtTime(0.0001, this.ctx.currentTime);
          eg.gain.exponentialRampToValueAtTime(
            0.6,
            this.ctx.currentTime + 0.01
          );
          eg.gain.exponentialRampToValueAtTime(
            0.0001,
            this.ctx.currentTime + 0.25
          );
          o.connect(eg);
          eg.connect(g);
          o.start();
          o.stop(this.ctx.currentTime + 0.3);
          this.loops["__drum_synth"] = { stop: () => (alive = false) };
          setTimeout(tick, 300);
        };
        tick();
      }
      return;
    }
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = opts?.gain ?? 0.7;
    src.buffer = buf;
    src.loop = true;
    src.connect(g);
    g.connect(this.lowpass!);
    src.start();
    this.loops[name] = { src, gain: g };
  }

  stopLoop(name: keyof AudioKit["urls"]) {
    const loop = this.loops[name];
    if (loop && "src" in loop && loop.src) {
      try {
        loop.src.stop();
      } catch {}
    }
    this.loops[name] = null;
    const drumSynth = this.loops["__drum_synth"];
    if (drumSynth && "stop" in drumSynth && name === "drumloop") {
      try {
        drumSynth.stop();
      } catch {}
      this.loops["__drum_synth"] = null;
    }
  }

  // frequency sweep for hype buildup
  sweepOpen(ms = 1500) {
    if (!this.ctx || !this.lowpass) return;
    const now = this.ctx.currentTime;
    this.lowpass.frequency.cancelScheduledValues(now);
    this.lowpass.frequency.setValueAtTime(800, now);
    this.lowpass.frequency.exponentialRampToValueAtTime(18000, now + ms / 1000);
  }
}

const audioKit = new AudioKit();

export default function GachaPageMain() {
  // data
  const [gifts, setGifts] = useState<GiftAvail[]>([]);
  // multi-winner: number of winners to draw at once (1-4)
  const [winnersCount, setWinnersCount] = useState<number>(1);
  // selected gifts per slot (allow duplicates)
  const MAX_SLOTS = 4;
  const [selectedGiftsArr, setSelectedGiftsArr] = useState<number[]>([]);
  // previews per slot
  const [previews, setPreviews] = useState<Array<PreviewWinner | null>>(Array(MAX_SLOTS).fill(null));

  // ui
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stage, setStage] = useState<
    "idle" | "drawing" | "reveal" | "refresh-reveal"
  >("idle");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, setRevealDone] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // per-slot preview name visibility
  const [showPreviewNameArr, setShowPreviewNameArr] = useState<boolean[]>(Array(MAX_SLOTS).fill(false));

  // audio controls
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);

  // code animation
  const [prefixDisplays, setPrefixDisplays] = useState<string[]>(Array(MAX_SLOTS).fill("CCCC2025"));
  const [suffixDisplays, setSuffixDisplays] = useState<string[]>(Array(MAX_SLOTS).fill("**********"));
  const [isGlitchingPrefixes, setIsGlitchingPrefixes] = useState<boolean[]>(Array(MAX_SLOTS).fill(false));
  const [isGlitchingSuffixes, setIsGlitchingSuffixes] = useState<boolean[]>(Array(MAX_SLOTS).fill(false));

  const hostRef = useRef<HTMLDivElement | null>(null);
  const menuFirstButtonRef = useRef<HTMLButtonElement | null>(null);

  // timers
  const prefixTimer = useRef<Array<number | null>>(Array(MAX_SLOTS).fill(null));
  const suffixTimer = useRef<Array<number | null>>(Array(MAX_SLOTS).fill(null));

  // confetti instance (works in fullscreen)
  const confettiInstanceRef = useRef<
    import("canvas-confetti").ConfettiFn | null
  >(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // derived

  const toMsg = (e: unknown) => {
    if (typeof e === "string") return e;
    if (!e || typeof e !== "object") return String(e);
    const obj = e as Record<string, unknown>;
    if (typeof obj.error === "string") return obj.error;
    if (typeof obj.message === "string") return obj.message;
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/admin/gifts/available");
      if (!res.ok) throw await res.json();
      const data = await res.json();
      // sort gifts A→Z (case-insensitive) so dropdowns are predictable
      const sorted = (data || []).slice().sort((a: GiftAvail, b: GiftAvail) =>
        String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" })
      );
      setGifts(sorted);
      // initialize selectedGiftsArr with first gift id for each slot using sorted list
      if ((!selectedGiftsArr || selectedGiftsArr.length === 0) && sorted.length) {
        const first = sorted[0].id;
        setSelectedGiftsArr(Array(MAX_SLOTS).fill(first));
      }
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }, [selectedGiftsArr]);

  useEffect(() => {
    load();
  }, [load]);

  // fullscreen handling
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-open the menu when entering fullscreen; close when exiting
  useEffect(() => {
    setIsMenuOpen(Boolean(isFullscreen));
  }, [isFullscreen]);

  async function enterFullscreen() {
    try {
      await hostRef.current?.requestFullscreen();
      await ensureConfettiInstance();
    } catch {}
  }
  async function exitFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      await ensureConfettiInstance();
    } catch {}
  }

  // parse code
  function splitCode(code?: string | null): { prefix: string; suffix: string } {
    if (!code) return { prefix: "", suffix: "" };
    const [preRaw = "", sufRaw = ""] = code.split("-");
    const prefix = preRaw.slice(0, 8);
    const digits = (sufRaw.match(/\d/g) || []).join("").slice(0, SUFFIX_LEN);
    const suffix = digits.padEnd(SUFFIX_LEN, "0");
    return { prefix, suffix };
  }

  // confetti bound to hostRef so it renders in fullscreen too
  async function ensureConfettiInstance() {
    const confettiMod = await import("canvas-confetti");
    const root =
      (document.fullscreenElement as HTMLElement | null) ??
      hostRef.current ??
      document.body;
    if (confettiCanvasRef.current?.parentNode) {
      confettiCanvasRef.current.parentNode.removeChild(
        confettiCanvasRef.current
      );
    }
    confettiCanvasRef.current = null;
    const canvas = document.createElement("canvas");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "2147483647";
    root.appendChild(canvas);
    confettiCanvasRef.current = canvas;
    confettiInstanceRef.current = confettiMod.create(canvas, {
      resize: true,
      useWorker: false,
    });
  }

  function removeConfettiCanvas() {
    if (confettiCanvasRef.current?.parentNode) {
      confettiCanvasRef.current.parentNode.removeChild(
        confettiCanvasRef.current
      );
    }
    confettiCanvasRef.current = null;
    confettiInstanceRef.current = null;
  }

  async function burstConfetti(power: "big" | "small") {
    if (!confettiInstanceRef.current) await ensureConfettiInstance();
    const confetti = confettiInstanceRef.current!;
    const base = {
      spread: power === "big" ? 75 : 50,
      startVelocity: power === "big" ? 52 : 32,
      ticks: power === "big" ? 360 : 220,
      gravity: 0.9,
      zIndex: 2147483647,
      scalar: power === "big" ? 1 : 0.9,
      colors: ["#d4af37", "#f4e4b1", "#7c1e1e", "#276749"],
    } as const;
    const center = { x: 0.5, y: 0.45 };
    confetti({
      ...base,
      particleCount: power === "big" ? 140 : 60,
      origin: center,
    });
    confetti({
      ...base,
      particleCount: power === "big" ? 100 : 40,
      origin: { x: 0.22, y: 0.6 },
    });
    confetti({
      ...base,
      particleCount: power === "big" ? 100 : 40,
      origin: { x: 0.78, y: 0.6 },
    });
  }

  // cleanup timers
  useEffect(() => {
    const pTimers = prefixTimer.current.slice();
    const sTimers = suffixTimer.current.slice();
    return () => {
      pTimers.forEach((t) => t && window.clearTimeout(t));
      sTimers.forEach((t) => t && window.clearTimeout(t));
      removeConfettiCanvas();
    };
  }, []);

  const resetGacha = useCallback(() => {
    prefixTimer.current.forEach((t, i) => {
      if (t) window.clearTimeout(t);
      prefixTimer.current[i] = null;
    });
    suffixTimer.current.forEach((t, i) => {
      if (t) window.clearTimeout(t);
      suffixTimer.current[i] = null;
    });
    setPreviews(Array(MAX_SLOTS).fill(null));
    setStage("idle");
    setRevealDone(false);
    setIsGlitchingPrefixes(Array(MAX_SLOTS).fill(false));
    setIsGlitchingSuffixes(Array(MAX_SLOTS).fill(false));
    setPrefixDisplays(Array(MAX_SLOTS).fill("CCCC2025"));
    setSuffixDisplays(Array(MAX_SLOTS).fill("**********"));
    setShowPreviewNameArr(Array(MAX_SLOTS).fill(false));
    removeConfettiCanvas();
    audioKit.stopLoop("drumloop");
  }, []);

  // Per-slot glitch reveal (keeps timers and state per index)
  function glitchRevealSlot({
    slot,
    target,
    spectacular,
    isDigitsOnly,
    phase,
    onDone,
  }: {
    slot: number;
    target: string;
    spectacular: boolean;
    isDigitsOnly: boolean;
    phase: "prefix" | "suffix";
    onDone?: () => void;
  }) {
    const letters = "ABCDEFGHJKMNPQRSTUVWXYZ";
    const digits = "0123456789";
    const sigils = "✶★✷✦";
    const alphabet = isDigitsOnly ? digits : letters + digits + sigils;

    const GLITCH_MS =
      phase === "prefix"
        ? spectacular
          ? GLITCH_MS_FIRST_PREFIX
          : GLITCH_MS_REFRESH_PREFIX
        : spectacular
        ? GLITCH_MS_FIRST_SUFFIX
        : GLITCH_MS_REFRESH_SUFFIX;
    const DECODE_MS =
      phase === "prefix"
        ? spectacular
          ? DECODE_MS_FIRST_PREFIX
          : DECODE_MS_REFRESH_PREFIX
        : spectacular
        ? DECODE_MS_FIRST_SUFFIX
        : DECODE_MS_REFRESH_SUFFIX;

    const start = performance.now();
    setIsGlitchingPrefixes((p) => {
      const copy = [...p];
      if (phase === "prefix") copy[slot] = true;
      return copy;
    });
    setIsGlitchingSuffixes((p) => {
      const copy = [...p];
      if (phase === "suffix") copy[slot] = true;
      return copy;
    });

    const tick = () => {
      const now = performance.now();
      const elapsed = now - start;

      if (elapsed < GLITCH_MS) {
        const scrambled = Array.from(
          { length: target.length },
          () => alphabet[Math.floor(Math.random() * alphabet.length)]
        ).join("");
        if (phase === "prefix") {
          setPrefixDisplays((s) => {
            const copy = [...s];
            copy[slot] = scrambled;
            return copy;
          });
        } else {
          setSuffixDisplays((s) => {
            const copy = [...s];
            copy[slot] = scrambled;
            return copy;
          });
        }
        const delay = spectacular ? 36 : 28;
        const handle = window.setTimeout(tick, delay);
        if (phase === "prefix") prefixTimer.current[slot] = handle;
        else suffixTimer.current[slot] = handle;
        if (phase === "suffix" && Math.random() < (spectacular ? 0.18 : 0.1))
          audioKit.play("whoosh");
        if (!spectacular && phase === "suffix" && Math.random() < 0.12)
          audioKit.play("tick");
        return;
      }

      const decodeElapsed = elapsed - GLITCH_MS;
      const t = Math.min(1, decodeElapsed / DECODE_MS);
      const revealCount = Math.floor(t * target.length);

      const decoded = target
        .split("")
        .map((ch, i) =>
          i < revealCount
            ? ch
            : alphabet[Math.floor(Math.random() * alphabet.length)]
        )
        .join("");
      if (phase === "prefix") {
        setPrefixDisplays((s) => {
          const copy = [...s];
          copy[slot] = decoded;
          return copy;
        });
      } else {
        setSuffixDisplays((s) => {
          const copy = [...s];
          copy[slot] = decoded;
          return copy;
        });
      }

      if (t < 1) {
        const delay = spectacular ? 30 : 22;
        const handle = window.setTimeout(tick, delay);
        if (phase === "prefix") prefixTimer.current[slot] = handle;
        else suffixTimer.current[slot] = handle;
      } else {
        if (phase === "prefix") {
          setIsGlitchingPrefixes((p) => {
            const copy = [...p];
            copy[slot] = false;
            return copy;
          });
        }
        if (phase === "suffix") {
          setIsGlitchingSuffixes((p) => {
            const copy = [...p];
            copy[slot] = false;
            return copy;
          });
        }
        onDone?.();
      }
    };

    tick();
  }

  function startRevealSequenceSlot(slot: number, prefix: string, suffix: string, spectacular: boolean, onDoneAll?: () => void) {
    setRevealDone(false);
    setPrefixDisplays((s) => {
      const copy = [...s];
      copy[slot] = prefix ? "********" : "";
      return copy;
    });
    setSuffixDisplays((s) => {
      const copy = [...s];
      copy[slot] = "**********";
      return copy;
    });
    audioKit.sweepOpen(spectacular ? 2000 : 1000);

    glitchRevealSlot({
      slot,
      target: prefix,
      spectacular,
      isDigitsOnly: false,
      phase: "prefix",
      onDone: () => {
        glitchRevealSlot({
          slot,
          target: suffix,
          spectacular,
          isDigitsOnly: true,
          phase: "suffix",
          onDone: () => {
            // one slot finished
            audioKit.play(spectacular ? "fanfare" : "chime");
            burstConfetti(spectacular ? "big" : "small");
            // if all slots done, stop drumloop and mark revealDone
            onDoneAll?.();
          },
        });
      },
    });
  }

  async function pickRandom(spectacular: boolean) {
    // validate selected gifts for first N slots
    const slots = winnersCount;
    const selection = selectedGiftsArr.slice(0, slots);
    if (selection.length < slots) return setError("Select gifts for all winner slots");
    setError(null);
    setLoading(true);
    setStage("drawing");
    setRevealDone(false);
    setIsMenuOpen(false);

    try {
      // check eligible registrants
      const regRes = await authFetch(`/api/admin/registrants`);
      if (!regRes.ok) throw await regRes.json();
  const regs = (await regRes.json()) as Array<{ id: number; name: string; gacha_code?: string | null; is_verified?: string | null; is_win?: string | null }>;
  const eligible = (regs || []).filter((r) => r.is_verified === 'Y' && r.is_win === 'N' && r.gacha_code);
      if ((eligible || []).length < slots) {
        setError(`Not enough eligible registrants (${eligible.length}) for ${slots} winner(s)`);
        setStage('idle');
        setLoading(false);
        return;
      }

      // check gift availability per selection (account for duplicates)
      const remMap = new Map<number, number>();
      for (const g of gifts) remMap.set(g.id, Math.max(0, (g.quantity ?? 0) - (g.awarded ?? 0)));
      const needMap = new Map<number, number>();
      for (const gid of selection) needMap.set(gid, (needMap.get(gid) || 0) + 1);
      for (const [gid, need] of needMap.entries()) {
        const avail = remMap.get(gid) || 0;
        if (avail < need) {
          const gname = gifts.find((x) => x.id === gid)?.name || String(gid);
          setError(`Not enough quantity for gift "${gname}" (need ${need}, available ${avail})`);
          setStage('idle');
          setLoading(false);
          return;
        }
      }

      await audioKit.ensureCtx();
      audioKit.setMuted(muted);
      audioKit.setVolume(volume);
      audioKit.startLoop("drumloop", { gain: spectacular ? 0.8 : 0.6 });
      audioKit.play("whoosh");

      // pick unique winners by calling the existing endpoint multiple times
      const picked: Array<PreviewWinner | null> = Array(MAX_SLOTS).fill(null);
      const pickedIds = new Set<number>();
      for (let i = 0; i < slots; i++) {
        const attempts = 10;
        let found: PreviewWinner | null = null;
        for (let a = 0; a < attempts; a++) {
          const gid = selection[i];
          const res = await authFetch(`/api/admin/gifts/${gid}/random-winner`, { method: 'POST' });
          if (!res.ok) continue;
          const data = await res.json() as PreviewWinner;
          if (!data) continue;
          if (!pickedIds.has(data.id)) {
            found = data;
            pickedIds.add(data.id);
            break;
          }
        }
        if (!found) {
          setError('Failed to pick unique winners after several attempts');
          setStage('idle');
          setLoading(false);
          audioKit.stopLoop('drumloop');
          return;
        }
        picked[i] = found;
      }

      setPreviews((p) => {
        const copy = [...p];
        for (let i = 0; i < slots; i++) copy[i] = picked[i];
        return copy;
      });
      // hide all names by default for the new previews
      setShowPreviewNameArr(Array(MAX_SLOTS).fill(false));

      const nextStage = spectacular ? 'reveal' : 'refresh-reveal';
      setStage(nextStage);

      // start reveals for each slot with a small stagger
      let finished = 0;
      for (let i = 0; i < slots; i++) {
        const data = picked[i]!;
        const { prefix, suffix } = splitCode(data.gacha_code || '');
        // onDoneAll increments finished; when all done, stop drumloop and setRevealDone
        startRevealSequenceSlot(i, prefix || '********', suffix || '0000000000', spectacular, () => {
          finished += 1;
          if (finished === slots) {
            setRevealDone(true);
            audioKit.stopLoop('drumloop');
          }
        });
        // small stagger between starts
        await new Promise((r) => setTimeout(r, 120));
      }
    } catch (e) {
      setError(toMsg(e));
      setStage('idle');
      setIsGlitchingPrefixes(Array(MAX_SLOTS).fill(false));
      setIsGlitchingSuffixes(Array(MAX_SLOTS).fill(false));
      setRevealDone(true);
      audioKit.stopLoop('drumloop');
    } finally {
      setLoading(false);
    }
  }

  // Refresh a single slot winner (preserves other slots). Ensures unique registrant
  async function pickRandomSlot(spectacular: boolean, slot: number) {
    const gid = selectedGiftsArr[slot];
    if (!gid) return setError('Select a gift for this slot');
    setError(null);
    setLoading(true);
    setStage('drawing');
    setRevealDone(false);
    setIsMenuOpen(false);

    try {
      // check eligible registrants
      const regRes = await authFetch(`/api/admin/registrants`);
      if (!regRes.ok) throw await regRes.json();
      const regs = (await regRes.json()) as Array<{ id: number; name: string; gacha_code?: string | null; is_verified?: string | null; is_win?: string | null }>;
      // exclude already-picked ids in other slots to keep uniqueness
      const exclude = new Set<number>();
      previews.forEach((p, idx) => { if (p && idx !== slot) exclude.add(p.id); });
      const eligible = (regs || []).filter((r) => r.is_verified === 'Y' && r.is_win === 'N' && r.gacha_code && !exclude.has(r.id));
      if ((eligible || []).length < 1) {
        setError(`Not enough eligible registrants to refresh this slot`);
        setStage('idle');
        setLoading(false);
        return;
      }

      // check gift availability
      const giftObj = gifts.find((g) => g.id === gid);
      const avail = giftObj ? Math.max(0, (giftObj.quantity ?? 0) - (giftObj.awarded ?? 0)) : 0;
      if (avail <= 0) {
        setError(`No remaining quantity for selected gift`);
        setStage('idle');
        setLoading(false);
        return;
      }

      await audioKit.ensureCtx();
      audioKit.setMuted(muted);
      audioKit.setVolume(volume);
      audioKit.startLoop('drumloop', { gain: spectacular ? 0.8 : 0.6 });
      audioKit.play('whoosh');

      // pick unique winner for this slot
      const attempts = 10;
      let found: PreviewWinner | null = null;
      for (let a = 0; a < attempts; a++) {
        const res = await authFetch(`/api/admin/gifts/${gid}/random-winner`, { method: 'POST' });
        if (!res.ok) continue;
        const data = await res.json() as PreviewWinner;
        if (!data) continue;
        if (!exclude.has(data.id)) { found = data; break; }
      }
      if (!found) {
        setError('Failed to pick a unique winner for this slot');
        setStage('idle');
        setLoading(false);
        audioKit.stopLoop('drumloop');
        return;
      }

      // set preview for this slot only
      setPreviews((p) => {
        const copy = [...p];
        copy[slot] = found;
        return copy;
      });
      // hide name by default for this slot
      setShowPreviewNameArr((arr) => { const c = [...arr]; c[slot] = false; return c; });

      const { prefix, suffix } = splitCode(found.gacha_code || '');
      setStage(spectacular ? 'reveal' : 'refresh-reveal');

      // reveal only this slot
      await new Promise<void>((resolve) => {
        startRevealSequenceSlot(slot, prefix || '********', suffix || '0000000000', spectacular, () => {
          audioKit.stopLoop('drumloop');
          setRevealDone(true);
          resolve();
        });
      });
    } catch (e) {
      setError(toMsg(e));
      setStage('idle');
      setIsGlitchingPrefixes(Array(MAX_SLOTS).fill(false));
      setIsGlitchingSuffixes(Array(MAX_SLOTS).fill(false));
      setRevealDone(true);
      audioKit.stopLoop('drumloop');
    } finally {
      setLoading(false);
    }
  }

  async function saveWinner() {
    const slots = winnersCount;
    const selection = selectedGiftsArr.slice(0, slots);
    const picked = previews.slice(0, slots);
    if (picked.some((p) => !p)) return setError('No preview available');
    setLoading(true);
    setError(null);
    try {
      for (let i = 0; i < slots; i++) {
        const gid = selection[i];
        const registrant_id = picked[i]!.id;
        const res = await authFetch(`/api/admin/gifts/${gid}/save-winner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registrant_id }),
        });
        if (!res.ok) throw await res.json();
        // small delay to allow DB updates to settle
        await new Promise((r) => setTimeout(r, 120));
      }
      await load();
      setSuccess('Winners saved.');
      audioKit.play('chime');
      resetGacha();
      setTimeout(() => setSuccess(null), 2500);
    } catch (e) {
      setError(toMsg(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMenuOpen(false);
    };
    if (isMenuOpen) {
      document.addEventListener("keydown", onKey);
      setTimeout(() => menuFirstButtonRef.current?.focus(), 0);
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [isMenuOpen]);

  useEffect(() => {
    // Load persisted audio prefs
    try {
      const m = localStorage.getItem("gacha_muted");
      const v = localStorage.getItem("gacha_volume");
      if (m !== null) setMuted(m === "1");
      if (v !== null) setVolume(Number(v));
    } catch {}

    ensureConfettiInstance();
  }, []);

  // 🎨 Theming tokens
  const parchmentBg =
    "bg-[radial-gradient(1400px_800px_at_50%_-10%,rgba(244,228,177,0.2),transparent),radial-gradient(900px_520px_at_30%_120%,rgba(107,46,46,0.18),transparent)]";
  const frameBorder = "border-[3px] border-[#7c1e1e]/50 rounded-[22px]";
  const panelGlass =
    "bg-[rgba(36,24,19,0.72)] border border-amber-900/30 backdrop-blur-md";

  // Expose a minimal remote API for Stage pages to call via window.__gacha_api__
  useEffect(() => {
    const api = {
      enterFullscreen: async () => await enterFullscreen(),
      exitFullscreen: async () => await exitFullscreen(),
      pickRandom: async (spectacular: boolean) => await pickRandom(spectacular),
      pickRandomSlot: async (spectacular: boolean, slot: number) => await pickRandomSlot(spectacular, slot),
      saveWinner: async () => await saveWinner(),
      setWinnersCount: (n: number) => setWinnersCount(n),
      setGiftForSlot: (slot: number, giftId: number) => setSelectedGiftsArr((arr) => { const c = [...arr]; c[slot] = giftId; return c; }),
      setMuted: (m: boolean) => { setMuted(m); audioKit.setMuted(m); },
      setVolume: (v: number) => { setVolume(v); audioKit.setVolume(v); },
      ensureCtx: async () => await audioKit.ensureCtx(),
    } as const;

    try {
      (window as unknown as { __gacha_api__?: import("../../../lib/gacha-wire").GachaAPI }).__gacha_api__ = api;
    } catch {}

    return () => {
      try {
        const w = window as unknown as { __gacha_api__?: import("../../../lib/gacha-wire").GachaAPI };
        if (w.__gacha_api__ === api) delete w.__gacha_api__;
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      className={`min-h-screen ${parchmentBg} from-[#1b1410] via-[#1b1410] to-[#1b1410] text-amber-100 relative overflow-hidden`}
      style={{
        backgroundImage:
          "radial-gradient(800px 500px at 50% -10%, rgba(244,228,177,0.18), transparent), radial-gradient(700px 400px at 30% 120%, rgba(124,30,30,0.16), transparent)",
      }}
    >
      <style>{`
        @keyframes candleGlow { 0% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35); } 50% { text-shadow: 0 0 22px rgba(212,175,55,0.85), 0 0 6px rgba(255,235,195,0.55); } 100% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35); } }
        @keyframes runeShimmer { 0% { transform: translate(0,0) } 50% { transform: translate(0.3px,-0.2px) } 100% { transform: translate(0,0) } }
        .glitching { animation: runeShimmer 140ms infinite steps(2,end); }
  .glow { animation: candleGlow 2.4s ease-in-out infinite; }
  /* stronger glow used during the glitch/flicker to make numbers super light */
  .glow-strong { animation: candleGlow 2.4s ease-in-out infinite; text-shadow: 0 0 28px rgba(212,175,55,0.95), 0 0 8px rgba(255,235,195,0.85); }
        .seal-corners:before, .seal-corners:after { content: ""; position: absolute; width: 18px; height: 18px; background: radial-gradient(circle at 30% 30%, #8b2323, #5c1414 60%, #2d0a0a 100%); border-radius: 50%; box-shadow: 0 0 8px rgba(124,30,30,0.6); }
        .seal-corners:before { top: -10px; left: -10px; }
        .seal-corners:after  { bottom: -10px; right: -10px; }

        /* Gacha audio control theming */
        .gacha-checkbox { accent-color: #d4af37; }

        .gacha-range { -webkit-appearance: none; appearance: none; background: transparent; }
        .gacha-range:focus { outline: none; }
        .gacha-range::-webkit-slider-runnable-track { height: 8px; background: rgba(212,175,55,0.14); border-radius: 999px; }
        .gacha-range::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; margin-top: -4px; background: #d4af37; border-radius: 999px; box-shadow: 0 0 8px rgba(212,175,55,0.45); }
        .gacha-range::-moz-range-track { height: 8px; background: rgba(212,175,55,0.14); border-radius: 999px; }
        .gacha-range::-moz-range-thumb { width: 16px; height: 16px; background: #d4af37; border-radius: 999px; box-shadow: 0 0 6px rgba(212,175,55,0.35); border: none; }
      `}</style>

      {!isFullscreen && (
        <AdminHeader title={"Accio Winner!"}>
          <button
            onClick={() =>
              isFullscreen ? exitFullscreen() : enterFullscreen()
            }
            className="px-3 py-1.5 rounded-lg border border-amber-900/40 bg-amber-950/30 text-[13px] hover:bg-amber-950/40"
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
          <button
            onClick={() => setIsMenuOpen((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-[#7c1e1e] hover:bg-[#8f2525] border border-amber-900/40 text-[13px] font-semibold"
            aria-expanded={isMenuOpen}
            aria-controls="gacha-controls"
          >
            {isMenuOpen ? "Close Menu" : "Open Menu"}
          </button>
        </AdminHeader>
      )}

      {isFullscreen && (
        <button
          onClick={() => setIsMenuOpen((v) => !v)}
          className="fixed z-[10000] right-4 bottom-4 rounded-full p-3 bg-[rgba(36,24,19,0.75)] border border-amber-900/40 shadow-lg text-amber-100 opacity-85 hover:opacity-100 backdrop-blur-md"
          aria-label={isMenuOpen ? "Close Menu" : "Open Menu"}
          aria-expanded={isMenuOpen}
          aria-controls="gacha-controls"
        >
          {isMenuOpen ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="12" x2="20" y2="12"></line>
              <line x1="4" y1="18" x2="20" y2="18"></line>
            </svg>
          )}
        </button>
      )}

      <AnimatePresence initial={false}>
        {isMenuOpen && (
          <>
            <motion.button
              key="menu-backdrop"
              onClick={() => setIsMenuOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9998] bg-black/40"
              aria-label="Close menu"
            />
            <motion.aside
              key="menu-panel"
              initial={isFullscreen ? { opacity: 0, scale: 0.98, y: 12, x: 8 } : { x: -340, opacity: 0 }}
              animate={isFullscreen ? { opacity: 1, scale: 1, y: 0, x: 0 } : { x: 0, opacity: 1 }}
              exit={isFullscreen ? { opacity: 0, scale: 0.98, y: 12, x: 8 } : { x: -340, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className={isFullscreen
                ? `fixed right-4 bottom-20 z-[9999] w-[320px] max-w-[92vw] ${panelGlass} p-4 shadow-2xl`
                : `fixed left-0 top-0 bottom-0 z-[9999] w-[320px] max-w-[85vw] ${panelGlass} p-6 overflow-y-auto`
              }
              role="dialog"
              aria-modal="true"
              aria-label="Gacha Controls"
              id="gacha-controls"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-amber-100/90 font-[Cinzel,serif]">
                    Enchanted Controls
                  </h2>
                  <button
                    ref={menuFirstButtonRef}
                    onClick={() => setIsMenuOpen(false)}
                    className="px-2.5 py-1 rounded-md border border-amber-900/40 bg-amber-950/30 text-xs hover:bg-amber-950/40"
                  >
                    Close
                  </button>
                </div>

                {error && (
                  <div className="text-xs rounded-md border border-red-900/40 bg-red-950/30 text-red-200 p-2">
                    {error}
                  </div>
                )}

                {/* Audio Controls */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-amber-300/70 mb-2">
                    Audio
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="gacha-checkbox"
                        checked={muted}
                        onChange={async (e) => {
                          const m = e.currentTarget.checked; // read BEFORE await
                          setMuted(m);
                          try {
                            localStorage.setItem("gacha_muted", m ? "1" : "0");
                          } catch {}
                          await audioKit.ensureCtx();
                          audioKit.setMuted(m);
                        }}
                      />
                      Mute
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={volume}
                      onChange={async (e) => {
                        const v = Number(e.currentTarget.value); // read BEFORE await
                        setVolume(v);
                        try {
                          localStorage.setItem("gacha_volume", String(v));
                        } catch {}
                        await audioKit.ensureCtx();
                        audioKit.setVolume(v);
                      }}
                      onPointerDown={() => {
                        void audioKit.ensureCtx();
                      }}
                      className="gacha-range flex-1"
                      aria-label="Volume"
                    />
                    <span className="text-xs tabular-nums w-8 text-right">
                      {Math.round(volume * 100)}
                    </span>
                  </div>
                </div>

                {/* Winners count + Gift picker per slot */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-amber-300/70 mb-2">
                    Winners & Gifts
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-xs">Winners:</div>
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setWinnersCount(n)}
                        className={`px-2 py-0.5 rounded ${winnersCount === n ? 'bg-amber-700 text-amber-100' : 'bg-amber-950/20'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-auto pr-1">
                    {loading && (
                      <div className="text-xs text-amber-200/80">Loading…</div>
                    )}
                    {!loading && gifts.length === 0 && (
                      <div className="text-xs text-amber-200/70">No gifts available.</div>
                    )}

                    {/* Per-slot selectors */}
                    {Array.from({ length: winnersCount }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="text-amber-300/80">Slot {i + 1}</div>
                          <select
                            value={selectedGiftsArr[i] ?? ''}
                            onChange={(e) => {
                              const v = Number(e.currentTarget.value);
                              setSelectedGiftsArr((s) => {
                                const copy = [...s];
                                copy[i] = v;
                                return copy;
                              });
                            }}
                            className="bg-amber-950/10 px-2 py-1 rounded text-xs"
                          >
                            {gifts.map((g) => (
                              <option key={g.id} value={g.id} disabled={Math.max(0, (g.quantity ?? 0) - (g.awarded ?? 0)) <= 0}>
                                {g.name} ({Math.max(0, (g.quantity ?? 0) - (g.awarded ?? 0))})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="tabular-nums text-amber-200/80">&nbsp;</div>
                      </div>
                    ))}

                  </div>
                  <div className="mt-2 flex gap-2">
                    <button onClick={load} className="text-xs px-2.5 py-1 rounded-md border border-amber-900/40 bg-amber-950/30 hover:bg-amber-950/40">Reload Gifts</button>
                  </div>
                </div>

                {/* Actions */}
                <div className="border-t border-amber-900/40 pt-4">
                  <div className="text-[11px] uppercase tracking-wider text-amber-300/70 mb-2">
                    Actions
                  </div>
                  {/* derive canDraw / canSave */}
                  {/* canDraw: not loading, have at least one selectedGift for each active slot, and availability for each */}
                  {(() => {
                    const slots = winnersCount;
                    let canDraw = !loading;
                    const selection = selectedGiftsArr.slice(0, slots);
                    if (selection.length < slots) canDraw = false;
                    for (let i = 0; i < selection.length; i++) {
                      const gid = selection[i];
                      if (!gid) { canDraw = false; break; }
                      const gobj = gifts.find((g) => g.id === gid);
                      const avail = gobj ? Math.max(0, (gobj.quantity ?? 0) - (gobj.awarded ?? 0)) : 0;
                      if (avail <= 0) { canDraw = false; break; }
                    }

                    const canSave = !loading && previews.slice(0, slots).every((p) => !!p) && selection.length === slots;

                    return (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => pickRandom(true)}
                          disabled={!canDraw}
                          aria-label="Draw winners"
                          className={`w-10 h-10 flex items-center justify-center rounded-full ${canDraw ? 'bg-[#7c1e1e] hover:bg-[#8f2525] border border-amber-900/40 text-white' : 'bg-amber-950/20 text-amber-400 cursor-not-allowed opacity-60'}`}
                        >
                          {/* play/start icon */}
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                          </svg>
                        </button>

                        <button
                          onClick={() => pickRandom(false)}
                          disabled={!canDraw}
                          aria-label="Refresh winners"
                          className={`w-10 h-10 flex items-center justify-center rounded-full ${canDraw ? 'bg-amber-950/30 hover:bg-amber-950/40 border border-amber-900/40 text-amber-100' : 'bg-amber-950/10 text-amber-400 cursor-not-allowed opacity-60'}`}
                        >
                          {/* refresh icon */}
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <polyline points="1 20 1 14 7 14"></polyline>
                            <path d="M3.51 9a9 9 0 0114.13-3.36L23 10"></path>
                            <path d="M20.49 15a9 9 0 01-14.13 3.36L1 14"></path>
                          </svg>
                        </button>

                        <button
                          onClick={saveWinner}
                          disabled={!canSave}
                          aria-label="Save winners"
                          className={`w-10 h-10 flex items-center justify-center rounded-full ${canSave ? 'bg-emerald-600 hover:bg-emerald-600/90 text-white border border-emerald-700/40' : 'bg-amber-950/10 text-amber-400 cursor-not-allowed opacity-60'}`}
                        >
                          {/* download/save icon (green) */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                        </button>

                        {/* Eye toggle: show/hide all preview names for active slots */}
                        {(() => {
                          const slots = winnersCount;
                          const anyPreview = previews.slice(0, slots).some((p) => !!p);
                          const allShown = previews.slice(0, slots).every((_, idx) => !!showPreviewNameArr[idx]);
                          const disabled = !anyPreview;
                          return (
                            <button
                              onClick={() => {
                                setShowPreviewNameArr((arr) => {
                                  const copy = [...arr];
                                  for (let i = 0; i < slots; i++) copy[i] = !allShown;
                                  return copy;
                                });
                              }}
                              disabled={disabled}
                              aria-label={allShown ? 'Hide all winners' : 'Show all winners'}
                              title={allShown ? 'Hide all winner names' : 'Show all winner names'}
                              className={`w-10 h-10 flex items-center justify-center rounded-full ${!disabled ? 'bg-amber-950/30 hover:bg-amber-950/40 border border-amber-900/40 text-amber-100' : 'bg-amber-950/10 text-amber-400 cursor-not-allowed opacity-60'}`}
                            >
                              {/* eye / eye-off icon */}
                              {allShown ? (
                                // eye-off (closed)
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-7 1.11-2.48 3.03-4.44 5.35-5.6"></path>
                                  <path d="M1 1l22 22"></path>
                                </svg>
                              ) : (
                                // eye (open)
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                  <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                              )}
                            </button>
                          );
                        })()}
                      </div>
                    );
                  })()}
                </div>

                {/* Preview (per slot) */}
                <div className="border-t border-amber-900/40 pt-4">
                  <div className="text-[11px] uppercase tracking-wider text-amber-300/70 mb-2">Preview</div>
                  <div className="space-y-2">
                    {Array.from({ length: winnersCount }).map((_, i) => {
                      const p = previews[i];
                      return (
                        <div key={i} className="text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-amber-200/80">Slot {i + 1} Name:</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium font-[Crimson Pro,serif]">{showPreviewNameArr[i] ? (p?.name ?? '') : ''}</span>
                              <button onClick={() => setShowPreviewNameArr((arr) => { const copy = [...arr]; copy[i] = !copy[i]; return copy; })} className="px-2 py-0.5 text-xs rounded border border-amber-900/40 bg-amber-950/20 hover:bg-amber-950/30">{showPreviewNameArr[i] ? 'Hide' : 'Show'}</button>
                              <button
                                onClick={() => pickRandomSlot(false, i)}
                                disabled={loading || !selectedGiftsArr[i]}
                                className="px-2 py-0.5 text-xs rounded border border-amber-900/40 bg-amber-950/20 hover:bg-amber-950/30 disabled:opacity-60"
                                title="Refresh this slot"
                              >
                                Refresh
                              </button>
                            </div>
                          </div>
                          <div className="font-mono text-[13px] break-words">
                            <span className="text-amber-200/80">Code:</span>{" "}
                            <span className="font-mono">{(() => {
                              const [pfx, sfx] = (p?.gacha_code || '').split('-');
                              const prefix = pfx?.slice(0,8) || '';
                              const digits = (sfx?.match(/\d/g) || []).join('').slice(0,10);
                              const suffix = (digits || '').padEnd(10,'0');
                              return `${prefix || '********'}-${suffix || '**********'}`;
                            })()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Stage */}
      <main className="px-4 py-8 min-h-screen flex items-center justify-center">
        <section className={`relative w-full max-w-4xl p-0 bg-transparent`}>
          <div
            className={`absolute inset-0 -z-10 opacity-[0.12] pointer-events-none bg-[linear-gradient(0deg,rgba(212,175,55,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.18)_1px,transparent_1px)] bg-[size:42px_42px]`}
          />
          <div className={`relative ${frameBorder} seal-corners`} />

          <div className="w-full grid place-items-center px-4 py-8 text-center">
            <AnimatePresence mode="wait">
              {previews.every((p) => !p) ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="text-amber-200/90"
                >
                  <div className="text-4xl font-black tracking-tight font-[Cinzel,serif]">
                    Ready your wands
                  </div>
                  <p className="mt-2 opacity-85 font-[Crimson Pro,serif]">
                    Check your owl-post for the{" "}
                    <span className="font-semibold">Winner’s Code</span>.
                  </p>
                </motion.div>
              ) : (
                <motion.div key={stage} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="w-full">
                  {/* responsive grid: center single panel; for 3 winners keep middle centered on larger screens */}
                  <div className={(() => {
                    const base = "grid grid-cols-1 gap-6";
                    // default to 2 columns on md and keep the grid simple
                    let cols = "md:grid-cols-2";
                    // center grid cells when single
                    let center = "";
                    if (winnersCount === 1) {
                      // single winner: center the single cell
                      cols = "";
                      center = "place-items-center";
                    } else if (winnersCount === 2) {
                      cols = "md:grid-cols-2";
                    } else if (winnersCount === 3) {
                      // three winners: use 2 columns on md so we can put 2 on top
                      // and make the 3rd span both columns on its own row
                      cols = "md:grid-cols-2";
                    } else {
                      // 4 winners: 2x2
                      cols = "md:grid-cols-2";
                    }
                    return [base, cols, center].filter(Boolean).join(" ");
                  })()}>
                    {Array.from({ length: winnersCount }).map((_, i) => {
                      const p = previews[i];
                      const prefix = prefixDisplays[i];
                      const suffix = suffixDisplays[i];
                      const gId = selectedGiftsArr[i];
                      const giftName = gifts.find((g) => g.id === gId)?.name || '';
                      const glitchPrefix = isGlitchingPrefixes[i];
                      const glitchSuffix = isGlitchingSuffixes[i];
                      // build the inner panel so we can optionally wrap it for special layouts
                      const panelWidthClass = winnersCount === 1 ? 'max-w-2xl w-auto' : 'max-w-xl w-full';
                      const inner = (
                        <div className={`p-4 ${panelGlass} rounded-2xl ${panelWidthClass} mx-auto`}>
                          <div className="text-sm text-amber-200/90">{giftName}</div>
                          <div className={`mt-1 font-mono ${glitchPrefix ? 'text-white font-semibold' : 'text-amber-300/95'}`}>
                            <span className={`text-xl md:text-3xl inline-block px-2 ${glitchPrefix ? 'glitching glow-strong' : 'glow'}`}>
                              {prefix || '********'}
                            </span>
                            <span className="opacity-50">-</span>
                          </div>
                          <div className="mt-3">
                            <motion.div key={i + '-' + suffix} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }} className={`inline-block px-6 py-4 rounded-2xl font-mono text-3xl md:text-4xl tracking-[0.2em] select-none ${glitchSuffix ? 'text-white font-semibold' : 'text-amber-100'} shadow-xl ${panelGlass} ${glitchSuffix ? 'glitching glow-strong' : 'glow'}`} style={{ borderWidth: 2, borderColor: 'rgba(120, 53, 15, 0.45)' }}>
                              {suffix || '**********'}
                            </motion.div>
                          </div>
                          <div className="mt-2 text-xs text-amber-200/80">{p ? (showPreviewNameArr[i] ? p.name : '') : 'No preview'}</div>
                        </div>
                      );

                      // special-case for 3 winners: make the 3rd item span both columns and center it on its own row
                      if (winnersCount === 3 && i === 2) {
                        return (
                          <div key={i} className="md:col-span-2 flex justify-center">
                            {inner}
                          </div>
                        );
                      }

                      // default card
                      return (
                        <div key={i}>
                          {inner}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Soft success banner */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[10001] px-4 py-2 rounded-lg bg-[#7c1e1e] border border-amber-900/40 text-amber-100 shadow-lg font-[Crimson Pro,serif]"
            role="status"
            aria-live="polite"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
