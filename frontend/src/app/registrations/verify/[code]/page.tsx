// "use client";

// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter } from "next/navigation";

// type Registrant = {
//   id: number;
//   name: string;
//   bureau?: string | null;
//   gacha_code?: string | null;
// };

// /**
//  * VerifyPage — Hogwarts parchment + candlelight skin
//  * (UX & logic preserved; visuals themed to match the Hogwarts vibe)
//  *
//  * Optional fonts (add once in <head>):
//  * <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600..900&family=Crimson+Pro:wght@400;600;700&display=swap" rel="stylesheet">
//  */
// export default function VerifyPage({ params }: { params: { code: string } }) {
//   const code = params.code;
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [status, setStatus] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [registrants, setRegistrants] = useState<Registrant[]>([]);
//   const [selectedId, setSelectedId] = useState<number | null>(null);
//   const [fetching, setFetching] = useState(false);
//   const [fetchErr, setFetchErr] = useState<string | null>(null);
//   const [query, setQuery] = useState("");
//   const [manualMode, setManualMode] = useState(false);
//   const [manualId, setManualId] = useState<string>("");

//   // soft local countdown (not authoritative; server owns TTL)
//   const [secondsLeft, setSecondsLeft] = useState<number>(15 * 60);
//   const timerRef = useRef<number | null>(null);

//   const emailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);
//   const canSubmit = useMemo(() => {
//     const idOk = manualMode ? !!manualId.trim() && Number(manualId) > 0 : !!selectedId;
//     return idOk && emailValid && !loading;
//   }, [manualMode, manualId, selectedId, emailValid, loading]);

//   const filtered = useMemo(() => {
//     const q = query.trim().toLowerCase();
//     if (!q) return registrants;
//     return registrants.filter((r) => `${r.name} ${r.bureau || ""}`.toLowerCase().includes(q));
//   }, [registrants, query]);

//   async function fetchRegistrants() {
//     setFetching(true);
//     setFetchErr(null);
//     try {
//       const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
//       const resp = await fetch(`${BACKEND}/api/registrants/unverified`);
//       if (!resp.ok) throw new Error(`Failed ${resp.status}`);
//       const data = (await resp.json()) as Registrant[];
//       setRegistrants(data || []);
//     } catch (e) {
//       setFetchErr(e instanceof Error ? e.message : "Network error");
//     } finally {
//       setFetching(false);
//     }
//   }

//   useEffect(() => {
//     fetchRegistrants();
//     // soft countdown
//     timerRef.current = window.setInterval(() => {
//       setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
//     }, 1000);
//     return () => {
//       if (timerRef.current) window.clearInterval(timerRef.current);
//     };
//   }, []);

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     setStatus(null);
//     const idToSend = manualMode ? Number(manualId) : selectedId;
//     if (!idToSend) return setStatus("Please select or enter your ID");
//     if (!emailValid) return setStatus("Enter a valid email");
//     setLoading(true);
//     try {
//       const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
//       const resp = await fetch(`${BACKEND}/api/registrations/verify`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ code, email: email.trim(), registrant_id: idToSend }),
//       });
//       const data = await resp.json().catch(() => ({}));
//       if (!resp.ok) {
//         setStatus((data && (data.error || data.message)) || `Server error ${resp.status}`);
//       } else {
//         const sel = registrants.find((r) => r.id === idToSend);
//         const display = sel ? `${sel.name}${sel.bureau ? ` — ${sel.bureau}` : ""}` : `ID ${idToSend}`;
//         setEmail("");
//         setSelectedId(null);
//         setManualId("");
//         setRegistrants([]);
//         setStatus(`Verified for ${display}. Redirecting…`);
//         setTimeout(() => router.push("/registrations/verify/finish"), 2200);
//       }
//     } catch {
//       setStatus("Network error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   const mm = Math.floor(secondsLeft / 60)
//     .toString()
//     .padStart(2, "0");
//   const ss = (secondsLeft % 60).toString().padStart(2, "0");

//   // Theme tokens
//   const parchmentBg =
//     "bg-[radial-gradient(1300px_700px_at_50%_-10%,rgba(244,228,177,0.20),transparent),radial-gradient(900px_520px_at_30%_120%,rgba(124,30,30,0.16),transparent)]";
//   const glass = "bg-[rgba(36,24,19,0.72)] border border-amber-900/30 backdrop-blur-md";
//   const burgundyBtn = "bg-[#7c1e1e] hover:bg-[#8f2525] border border-amber-900/40";

//   return (
//     <div
//       className={`min-h-screen ${parchmentBg} text-amber-100`}
//       style={{
//         backgroundColor: "#1b1410",
//         backgroundImage:
//           "radial-gradient(800px 500px at 50% -10%, rgba(244,228,177,0.18), transparent), radial-gradient(700px 400px at 30% 120%, rgba(124,30,30,0.16), transparent)",
//       }}
//     >
//       <style>{`
//         @keyframes candleGlow { 0% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35);} 50% { text-shadow: 0 0 22px rgba(212,175,55,0.85), 0 0 6px rgba(255,235,195,0.55);} 100% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35);} }
//         .glow { animation: candleGlow 2.4s ease-in-out infinite; }
//       `}</style>

//       {/* Header */}
//       <header className="sticky top-0 z-30 supports-[backdrop-filter]:bg-amber-950/20 backdrop-blur border-b border-amber-900/40">
//         <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <div className="h-8 w-8 rounded-xl bg-[#7c1e1e]/70 border border-amber-900/40 grid place-content-center text-sm font-black font-[Cinzel,serif]">
//               HP
//             </div>
//             <h1 className="text-sm sm:text-base font-semibold font-[Cinzel,serif]">
//               Verify Registration
//             </h1>
//           </div>
//           <div className="flex items-center gap-2">
//             <span className="px-2 py-1 rounded-lg text-[11px] bg-amber-950/30 border border-amber-900/40 font-mono">
//               code: {code}
//             </span>
//             <span className="px-2 py-1 rounded-lg text-[11px] bg-amber-950/30 border border-amber-900/40 font-mono">
//               {secondsLeft > 0 ? `~${mm}:${ss}` : "expires soon"}
//             </span>
//           </div>
//         </div>
//       </header>

//       {/* Main */}
//       <main className="max-w-3xl mx-auto px-4 py-8">
//         <p className="text-amber-200/90 text-sm font-[Crimson_Pro,serif]">
//           Select your name and enter your email to receive your winning code. This link is single‑use and expires after ~15 minutes.
//         </p>

//         {status && (
//           <div
//             className={`mt-4 rounded-2xl p-4 border font-[Crimson_Pro,serif] ${
//               status.toLowerCase().startsWith("verified")
//                 ? "bg-emerald-900/30 border-emerald-400/40 text-emerald-100"
//                 : "bg-rose-900/30 border-rose-400/40 text-rose-100"
//             }`}
//           >
//             {status}
//           </div>
//         )}

//         {/* Fetch error banner */}
//         {fetchErr && (
//           <div className="mt-4 rounded-2xl p-4 bg-rose-900/40 border border-rose-400/40 text-rose-100 flex items-center justify-between gap-3 font-[Crimson_Pro,serif]">
//             <div className="text-sm">
//               {fetchErr} — you can still enter your ID manually.
//             </div>
//             <button onClick={fetchRegistrants} className="text-xs px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-900/40">
//               Retry
//             </button>
//           </div>
//         )}

//         {/* Form */}
//         <form onSubmit={handleSubmit} className={`mt-6 grid gap-4 rounded-2xl p-6 ${glass}`}>
//           {!manualMode ? (
//             <div className="grid gap-2">
//               <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
//                 Select your name
//               </label>
//               <div className="flex gap-2 items-center">
//                 <input
//                   value={query}
//                   onChange={(e) => setQuery(e.target.value)}
//                   placeholder="Search name/biro"
//                   className="flex-1 p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 outline-none focus:ring-2 focus:ring-amber-400/60"
//                 />
//                 <button
//                   type="button"
//                   onClick={fetchRegistrants}
//                   disabled={fetching}
//                   className="px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-900/40 disabled:opacity-50"
//                 >
//                   {fetching ? "Refreshing…" : "Refresh"}
//                 </button>
//               </div>
//               <select
//                 value={selectedId ?? ""}
//                 onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
//                 className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 outline-none focus:ring-2 focus:ring-amber-400/60"
//               >
//                 <option value="">— Select your name —</option>
//                 {filtered.map((r) => (
//                   <option key={r.id} value={r.id}>
//                     {r.name}
//                     {r.bureau ? ` — ${r.bureau}` : ""}
//                   </option>
//                 ))}
//               </select>
//               <button
//                 type="button"
//                 onClick={() => setManualMode(true)}
//                 className="self-start text-xs opacity-85 hover:opacity-100 font-[Crimson_Pro,serif]"
//               >
//                 Can’t find your name? Enter ID instead
//               </button>
//             </div>
//           ) : (
//             <div className="grid gap-2">
//               <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
//                 Enter your registrant ID
//               </label>
//               <input
//                 inputMode="numeric"
//                 value={manualId}
//                 onChange={(e) => setManualId(e.target.value.replace(/[^0-9]/g, ""))}
//                 placeholder="e.g., 1024"
//                 className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 outline-none focus:ring-2 focus:ring-amber-400/60"
//               />
//               <button
//                 type="button"
//                 onClick={() => setManualMode(false)}
//                 className="self-start text-xs opacity-85 hover:opacity-100 font-[Crimson_Pro,serif]"
//               >
//                 Back to list
//               </button>
//             </div>
//           )}

//           <div className="grid gap-2">
//             <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
//               Email
//             </label>
//             <input
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               placeholder="name@company.com"
//               className={`p-3 rounded-xl bg-amber-950/20 border ${email ? (emailValid ? "border-amber-900/40" : "border-amber-400/60") : "border-amber-900/40"} outline-none focus:ring-2 focus:ring-amber-400/60`}
//               inputMode="email"
//             />
//             {!emailValid && email && (
//               <p className="text-[11px] text-amber-200 font-[Crimson_Pro,serif]">That email doesn’t look right.</p>
//             )}
//           </div>

//           <div className="flex items-center gap-2 justify-end">
//             <button
//               type="button"
//               onClick={() => {
//                 setEmail("");
//                 setSelectedId(null);
//                 setManualId("");
//               }}
//               className="px-4 py-2 rounded-lg bg-amber-950/30 border border-amber-900/40"
//             >
//               Clear
//             </button>
//             <button disabled={!canSubmit} className={`px-4 py-2 rounded-lg ${burgundyBtn} disabled:opacity-50`}>
//               {loading ? "Verifying…" : "Verify & Activate"}
//             </button>
//           </div>
//         </form>
//       </main>
//     </div>
//   );
// }
// "use client";

// import React, { useEffect, useMemo, useRef, useState } from "react";
// import { useRouter } from "next/navigation";

// type Registrant = {
//   id: number;
//   name: string;
//   bureau?: string | null;
//   gacha_code?: string | null;
// };

// /**
//  * VerifyPage — Hogwarts parchment + candlelight skin
//  * (UX & logic preserved; visuals themed to match the Hogwarts vibe)
//  *
//  * Optional fonts (add once in <head>):
//  * <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600..900&family=Crimson+Pro:wght@400;600;700&display=swap" rel="stylesheet">
//  */

// // --- In-file Combobox (type-ahead dropdown) ---
// function RegistrantCombobox({
//   registrants,
//   valueId,
//   onChangeId,
//   onRefresh,
//   fetching,
//   glassClass,
//   onEnterManualMode,
// }: {
//   registrants: Registrant[];
//   valueId: number | null;
//   onChangeId: (id: number | null) => void;
//   onRefresh: () => void;
//   fetching: boolean;
//   glassClass: string;
//   onEnterManualMode: () => void;
// }) {
//   const [open, setOpen] = useState(false);
//   const [q, setQ] = useState("");
//   const [hoverIdx, setHoverIdx] = useState(0);
//   const wrapRef = useRef<HTMLDivElement | null>(null);

//   // Close on outside click
//   useEffect(() => {
//     const onDoc = (e: MouseEvent) => {
//       if (!wrapRef.current) return;
//       if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
//     };
//     document.addEventListener("mousedown", onDoc);
//     return () => document.removeEventListener("mousedown", onDoc);
//   }, []);

//   const filtered = useMemo(() => {
//     const s = q.trim().toLowerCase();
//     if (!s) return registrants;
//     return registrants.filter((r) =>
//       `${r.name} ${r.bureau ?? ""}`.toLowerCase().includes(s)
//     );
//   }, [registrants, q]);

//   const selected = valueId ? registrants.find((r) => r.id === valueId) : null;

//   function choose(r: Registrant) {
//     onChangeId(r?.id ?? null);
//     setQ("");
//     setOpen(false);
//   }

//   return (
//     <div ref={wrapRef} className="relative">
//       <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
//         Select your name
//       </label>

//       <div className="mt-2 flex items-center gap-2">
//         <div className="flex-1 relative">
//           <input
//             value={
//               q ||
//               (selected
//                 ? `${selected.name}${
//                     selected.bureau ? ` — ${selected.bureau}` : ""
//                   }`
//                 : "")
//             }
//             onChange={(e) => {
//               setQ(e.target.value);
//               setOpen(true);
//               setHoverIdx(0);
//               if (valueId) onChangeId(null); // typing clears selection
//             }}
//             onFocus={() => setOpen(true)}
//             onKeyDown={(e) => {
//               if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
//                 setOpen(true);
//                 return;
//               }
//               if (!open) return;

//               if (e.key === "ArrowDown") {
//                 e.preventDefault();
//                 setHoverIdx((i) =>
//                   Math.min(i + 1, Math.max(0, filtered.length - 1))
//                 );
//               } else if (e.key === "ArrowUp") {
//                 e.preventDefault();
//                 setHoverIdx((i) => Math.max(i - 1, 0));
//               } else if (e.key === "Enter") {
//                 e.preventDefault();
//                 if (filtered[hoverIdx]) choose(filtered[hoverIdx]);
//               } else if (e.key === "Escape") {
//                 setOpen(false);
//               }
//             }}
//             placeholder="Type to search…"
//             className="w-full p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 outline-none focus:ring-2 focus:ring-amber-400/60"
//             aria-expanded={open}
//             aria-haspopup="listbox"
//             role="combobox"
//           />

//           {/* Dropdown */}
//           {open && (
//             <div
//               className={`absolute z-20 mt-2 w-full rounded-xl ${glassClass} shadow-xl`}
//               role="listbox"
//             >
//               <div className="flex items-center justify-between px-3 py-2 text-xs text-amber-200/80">
//                 <span>
//                   {filtered.length
//                     ? `Found ${filtered.length} ${
//                         filtered.length > 1 ? "people" : "person"
//                       }`
//                     : "No matches"}
//                 </span>
//                 <div className="flex items-center gap-2">
//                   <button
//                     type="button"
//                     onClick={onRefresh}
//                     disabled={fetching}
//                     className="px-2 py-1 rounded bg-amber-950/40 border border-amber-900/40 disabled:opacity-50"
//                   >
//                     {fetching ? "Refreshing…" : "Refresh"}
//                   </button>
//                   <button
//                     type="button"
//                     onClick={() => {
//                       setOpen(false);
//                       onEnterManualMode();
//                     }}
//                     className="px-2 py-1 rounded bg-amber-950/40 border border-amber-900/40"
//                   >
//                     Enter ID manually
//                   </button>
//                 </div>
//               </div>

//               <div className="max-h-64 overflow-auto py-1">
//                 {filtered.map((r, idx) => (
//                   <button
//                     key={r.id}
//                     type="button"
//                     role="option"
//                     aria-selected={valueId === r.id}
//                     onMouseEnter={() => setHoverIdx(idx)}
//                     onClick={() => choose(r)}
//                     className={`w-full text-left px-3 py-2 text-sm transition
//                       ${idx === hoverIdx ? "bg-amber-900/40" : ""}
//                       ${valueId === r.id ? "bg-emerald-900/30" : ""}`}
//                   >
//                     <div className="flex items-center justify-between gap-3">
//                       <span className="truncate">{r.name}</span>
//                       {r.bureau && (
//                         <span className="text-amber-200/70 text-xs shrink-0">
//                           {r.bureau}
//                         </span>
//                       )}
//                     </div>
//                   </button>
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Clear current selection */}
//         <button
//           type="button"
//           onClick={() => {
//             setQ("");
//             onChangeId(null);
//           }}
//           className="px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-900/40"
//         >
//           Clear
//         </button>
//       </div>
//     </div>
//   );
// }

// export default function VerifyPage({ params }: { params: { code: string } }) {
//   const code = params.code;
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [status, setStatus] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);

//   const [registrants, setRegistrants] = useState<Registrant[]>([]);
//   const [selectedId, setSelectedId] = useState<number | null>(null);

//   const [fetching, setFetching] = useState(false);
//   const [fetchErr, setFetchErr] = useState<string | null>(null);

//   const [manualMode, setManualMode] = useState(false);
//   const [manualId, setManualId] = useState<string>("");

//   // soft local countdown (not authoritative; server owns TTL)
//   const [secondsLeft, setSecondsLeft] = useState<number>(15 * 60);
//   const timerRef = useRef<number | null>(null);

//   const emailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);
//   const canSubmit = useMemo(() => {
//     const idOk = manualMode
//       ? !!manualId.trim() && Number(manualId) > 0
//       : !!selectedId;
//     return idOk && emailValid && !loading;
//   }, [manualMode, manualId, selectedId, emailValid, loading]);

//   async function fetchRegistrants() {
//     setFetching(true);
//     setFetchErr(null);
//     try {
//       const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
//       const resp = await fetch(`${BACKEND}/api/registrants/unverified`);
//       if (!resp.ok) throw new Error(`Failed ${resp.status}`);
//       const data = (await resp.json()) as Registrant[];
//       setRegistrants(data || []);
//     } catch (e) {
//       setFetchErr(e instanceof Error ? e.message : "Network error");
//     } finally {
//       setFetching(false);
//     }
//   }

//   useEffect(() => {
//     fetchRegistrants();
//     // soft countdown
//     timerRef.current = window.setInterval(() => {
//       setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
//     }, 1000);
//     return () => {
//       if (timerRef.current) window.clearInterval(timerRef.current);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   async function handleSubmit(e: React.FormEvent) {
//     e.preventDefault();
//     setStatus(null);
//     const idToSend = manualMode ? Number(manualId) : selectedId;
//     if (!idToSend) return setStatus("Please select or enter your ID");
//     if (!emailValid) return setStatus("Enter a valid email");
//     setLoading(true);
//     try {
//       const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
//       const resp = await fetch(`${BACKEND}/api/registrations/verify`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           code,
//           email: email.trim(),
//           registrant_id: idToSend,
//         }),
//       });
//       const data = await resp.json().catch(() => ({}));
//       if (!resp.ok) {
//         setStatus(
//           (data && (data.error || data.message)) ||
//             `Server error ${resp.status}`
//         );
//       } else {
//         const sel = registrants.find((r) => r.id === idToSend);
//         const display = sel
//           ? `${sel.name}${sel.bureau ? ` — ${sel.bureau}` : ""}`
//           : `ID ${idToSend}`;
//         setEmail("");
//         setSelectedId(null);
//         setManualId("");
//         setRegistrants([]);
//         setStatus(`Verified for ${display}. Redirecting…`);
//         setTimeout(() => router.push("/registrations/verify/finish"), 2200);
//       }
//     } catch {
//       setStatus("Network error");
//     } finally {
//       setLoading(false);
//     }
//   }

//   const mm = Math.floor(secondsLeft / 60)
//     .toString()
//     .padStart(2, "0");
//   const ss = (secondsLeft % 60).toString().padStart(2, "0");

//   // Theme tokens
//   const parchmentBg =
//     "bg-[radial-gradient(1300px_700px_at_50%_-10%,rgba(244,228,177,0.20),transparent),radial-gradient(900px_520px_at_30%_120%,rgba(124,30,30,0.16),transparent)]";
//   const glass =
//     "bg-[rgba(36,24,19,0.72)] border border-amber-900/30 backdrop-blur-md";
//   const burgundyBtn =
//     "bg-[#7c1e1e] hover:bg-[#8f2525] border border-amber-900/40";

//   return (
//     <div
//       className={`min-h-screen ${parchmentBg} text-amber-100`}
//       style={{
//         backgroundColor: "#1b1410",
//         backgroundImage:
//           "radial-gradient(800px 500px at 50% -10%, rgba(244,228,177,0.18), transparent), radial-gradient(700px 400px at 30% 120%, rgba(124,30,30,0.16), transparent)",
//       }}
//     >
//       <style>{`
//         @keyframes candleGlow {
//           0% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35);}
//           50% { text-shadow: 0 0 22px rgba(212,175,55,0.85), 0 0 6px rgba(255,235,195,0.55);}
//           100% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35);}
//         }
//         .glow { animation: candleGlow 2.4s ease-in-out infinite; }
//       `}</style>

//       {/* Header */}
//       <header className="sticky top-0 z-30 supports-[backdrop-filter]:bg-amber-950/20 backdrop-blur border-b border-amber-900/40">
//         <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <div className="h-8 w-8 rounded-xl bg-[#7c1e1e]/70 border border-amber-900/40 grid place-content-center text-sm font-black font-[Cinzel,serif]">
//               ITX
//             </div>
//             <h1 className="text-sm sm:text-base font-semibold font-[Cinzel,serif]">
//               Verify Registration
//             </h1>
//           </div>
//           <div className="flex items-center gap-2">
//             <span className="px-2 py-1 rounded-lg text-[11px] bg-amber-950/30 border border-amber-900/40 font-mono">
//               code: {code}
//             </span>
//             <span className="px-2 py-1 rounded-lg text-[11px] bg-amber-950/30 border border-amber-900/40 font-mono">
//               {secondsLeft > 0 ? `~${mm}:${ss}` : "expires soon"}
//             </span>
//           </div>
//         </div>
//       </header>

//       {/* Main */}
//       <main className="max-w-3xl mx-auto px-4 py-8">
//         <p className="text-amber-200/90 text-sm font-[Crimson_Pro,serif]">
//           Select your name and enter your email to receive your winning code.
//           This link is single-use and expires after ~15 minutes.
//         </p>

//         {status && (
//           <div
//             className={`mt-4 rounded-2xl p-4 border font-[Crimson_Pro,serif] ${
//               status.toLowerCase().startsWith("verified")
//                 ? "bg-emerald-900/30 border-emerald-400/40 text-emerald-100"
//                 : "bg-rose-900/30 border-rose-400/40 text-rose-100"
//             }`}
//           >
//             {status}
//           </div>
//         )}

//         {/* Fetch error banner */}
//         {fetchErr && (
//           <div className="mt-4 rounded-2xl p-4 bg-rose-900/40 border border-rose-400/40 text-rose-100 flex items-center justify-between gap-3 font-[Crimson_Pro,serif]">
//             <div className="text-sm">
//               {fetchErr} — you can still enter your ID manually.
//             </div>
//             <button
//               onClick={fetchRegistrants}
//               className="text-xs px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-900/40"
//             >
//               Retry
//             </button>
//           </div>
//         )}

//         {/* Form */}
//         <form
//           onSubmit={handleSubmit}
//           className={`mt-6 grid gap-4 rounded-2xl p-6 ${glass}`}
//         >
//           {!manualMode ? (
//             <RegistrantCombobox
//               registrants={registrants}
//               valueId={selectedId}
//               onChangeId={(id) => setSelectedId(id)}
//               onRefresh={fetchRegistrants}
//               fetching={fetching}
//               glassClass={glass}
//               onEnterManualMode={() => setManualMode(true)}
//             />
//           ) : (
//             <div className="grid gap-2">
//               <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
//                 Enter your registrant ID
//               </label>
//               <input
//                 inputMode="numeric"
//                 value={manualId}
//                 onChange={(e) =>
//                   setManualId(e.target.value.replace(/[^0-9]/g, ""))
//                 }
//                 placeholder="e.g., 1024"
//                 className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 outline-none focus:ring-2 focus:ring-amber-400/60"
//               />
//               <button
//                 type="button"
//                 onClick={() => setManualMode(false)}
//                 className="self-start text-xs opacity-85 hover:opacity-100 font-[Crimson_Pro,serif]"
//               >
//                 Back to list
//               </button>
//             </div>
//           )}

//           <div className="grid gap-2">
//             <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
//               Email
//             </label>
//             <input
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//               placeholder="name@company.com"
//               className={`p-3 rounded-xl bg-amber-950/20 border ${
//                 email
//                   ? emailValid
//                     ? "border-amber-900/40"
//                     : "border-amber-400/60"
//                   : "border-amber-900/40"
//               } outline-none focus:ring-2 focus:ring-amber-400/60`}
//               inputMode="email"
//             />
//             {!emailValid && email && (
//               <p className="text-[11px] text-amber-200 font-[Crimson_Pro,serif]">
//                 That email doesn’t look right.
//               </p>
//             )}
//           </div>

//           <div className="flex items-center gap-2 justify-end">
//             <button
//               type="button"
//               onClick={() => {
//                 setEmail("");
//                 setSelectedId(null);
//                 setManualId("");
//               }}
//               className="px-4 py-2 rounded-lg bg-amber-950/30 border border-amber-900/40"
//             >
//               Clear
//             </button>
//             <button
//               disabled={!canSubmit}
//               className={`px-4 py-2 rounded-lg ${burgundyBtn} disabled:opacity-50`}
//             >
//               {loading ? "Verifying…" : "Verify & Activate"}
//             </button>
//           </div>
//         </form>
//       </main>
//     </div>
//   );
// }
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// --- Types ---
type Registrant = {
  id: number;
  name: string;
  bureau?: string | null;
  gacha_code?: string | null;
};

/**
 * VerifyPage — Hogwarts parchment + candlelight skin
 *
 * Key UI/UX fixes for long names pushing layout:
 * 1) The name trigger is a fixed-width button (w-full) with `truncate min-w-0` so
 *    very long names never stretch the row.
 * 2) The dropdown panel width is anchored to the trigger (w-full), not content.
 * 3) Inside each option we `truncate` the name and make the bureau `shrink-0`.
 * 4) Action rows use `shrink-0` on icons/chevrons and `min-w-0` on text spans.
 * 5) Status banner uses `break-words` so server messages never overflow.
 */

// --- In-file Combobox (dropdown-first with in-panel search) ---
function RegistrantCombobox({
  registrants,
  valueId,
  onChangeId,
  onRefresh,
  fetching,
  glassClass,
}: {
  registrants: Registrant[];
  valueId: number | null;
  onChangeId: (id: number | null) => void;
  onRefresh: () => void;
  fetching: boolean;
  glassClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hoverIdx, setHoverIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return registrants;
    return registrants.filter((r) =>
      `${r.name} ${r.bureau ?? ""}`.toLowerCase().includes(s)
    );
  }, [registrants, q]);

  const selected = valueId ? registrants.find((r) => r.id === valueId) : null;

  function choose(r: Registrant) {
    onChangeId(r?.id ?? null);
    setQ("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHoverIdx((i) => Math.min(i + 1, Math.max(0, filtered.length - 1)));
      listRef.current
        ?.querySelectorAll<HTMLButtonElement>("[data-row]")
        [
          Math.min(hoverIdx + 1, Math.max(0, filtered.length - 1))
        ]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHoverIdx((i) => Math.max(i - 1, 0));
      listRef.current
        ?.querySelectorAll<HTMLButtonElement>("[data-row]")
        [Math.max(hoverIdx - 1, 0)]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[hoverIdx]) choose(filtered[hoverIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative min-w-0" onKeyDown={onKeyDown}>
      <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
        Select your name
      </label>

      {/* Trigger button – does not expand layout thanks to truncate+min-w-0 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="mt-2 w-full p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-left flex items-center justify-between overflow-hidden"
      >
        <span className="truncate min-w-0">
          {selected
            ? `${selected.name}${
                selected.bureau ? ` — ${selected.bureau}` : ""
              }`
            : "Pick your name"}
        </span>
        <span aria-hidden className="ml-3 opacity-70 shrink-0">
          ▾
        </span>
      </button>

      {/* Dropdown panel width anchored to trigger (w-full) */}
      {open && (
        <div
          className={`absolute z-20 mt-2 inset-x-0 max-w-full rounded-xl ${glassClass} shadow-xl`}
          role="listbox"
        >
          {/* Top bar: search + refresh */}
          <div className="px-3 pt-3">
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHoverIdx(0);
              }}
              placeholder="Type to search…"
              className="w-full p-2.5 rounded-lg bg-amber-950/25 border border-amber-900/40 outline-none focus:ring-2 focus:ring-amber-400/60"
              aria-label="Search registrants"
              role="searchbox"
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2 text-xs text-amber-200/80">
            <span>
              {filtered.length
                ? `Found ${filtered.length} ${
                    filtered.length > 1 ? "people" : "person"
                  }`
                : "No matches"}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={fetching}
              className="px-2 py-1 rounded bg-amber-950/40 border border-amber-900/40 disabled:opacity-50"
            >
              {fetching ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          <div ref={listRef} className="max-h-64 overflow-auto py-1">
            {filtered.map((r, idx) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={valueId === r.id}
                data-row
                onMouseEnter={() => setHoverIdx(idx)}
                onClick={() => choose(r)}
                className={`w-full text-left px-3 py-2 text-sm transition ${
                  idx === hoverIdx ? "bg-amber-900/40" : ""
                } ${valueId === r.id ? "bg-emerald-900/30" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate min-w-0">{r.name}</span>
                  {r.bureau && (
                    <span className="text-amber-200/70 text-xs shrink-0">
                      {r.bureau}
                    </span>
                  )}
                </div>
              </button>
            ))}

            {!filtered.length && (
              <div className="px-3 py-4 text-sm text-amber-200/70">
                Try a different search term or refresh the list.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage({ params }: { params: { code: string } }) {
  const code = params.code;
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  // soft local countdown (not authoritative; server owns TTL)
  const [secondsLeft, setSecondsLeft] = useState<number>(15 * 60);
  const timerRef = useRef<number | null>(null);

  const emailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);
  const canSubmit = useMemo(() => {
    return !!selectedId && emailValid && !loading;
  }, [selectedId, emailValid, loading]);

  async function fetchRegistrants() {
    setFetching(true);
    setFetchErr(null);
    try {
      const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const resp = await fetch(`${BACKEND}/api/registrants/unverified`);
      if (!resp.ok) throw new Error(`Failed ${resp.status}`);
      const data = (await resp.json()) as Registrant[];
      setRegistrants(data || []);
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchRegistrants();
    // soft countdown
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const idToSend = selectedId;
    if (!idToSend) return setStatus("Please pick your name from the list");
    if (!emailValid) return setStatus("Enter a valid email");
    setLoading(true);
    try {
      const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "";
      const resp = await fetch(`${BACKEND}/api/registrations/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          email: email.trim(),
          registrant_id: idToSend,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setStatus(
          (data && (data.error || data.message)) ||
            `Server error ${resp.status}`
        );
      } else {
        const sel = registrants.find((r) => r.id === idToSend);
        const display = sel
          ? `${sel.name}${sel.bureau ? ` — ${sel.bureau}` : ""}`
          : `ID ${idToSend}`;
        setEmail("");
        setSelectedId(null);
        setRegistrants([]);
        setStatus(`Verified for ${display}. Redirecting…`);
        setTimeout(() => router.push("/registrations/verify/finish"), 2200);
      }
    } catch {
      setStatus("Network error");
    } finally {
      setLoading(false);
    }
  }

  const mm = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  // Theme tokens
  const parchmentBg =
    "bg-[radial-gradient(1300px_700px_at_50%_-10%,rgba(244,228,177,0.20),transparent),radial-gradient(900px_520px_at_30%_120%,rgba(124,30,30,0.16),transparent)]";
  const glass =
    "bg-[rgba(36,24,19,0.72)] border border-amber-900/30 backdrop-blur-md";
  const burgundyBtn =
    "bg-[#7c1e1e] hover:bg-[#8f2525] border border-amber-900/40";

  return (
    <div
      className={`min-h-screen flex flex-col ${parchmentBg} text-amber-100 overflow-x-hidden`}
      style={{
        backgroundColor: "#1b1410",
        backgroundImage:
          "radial-gradient(800px 500px at 50% -10%, rgba(244,228,177,0.18), transparent), radial-gradient(700px 400px at 30% 120%, rgba(124,30,30,0.16), transparent)",
      }}
    >
      <style>{`
        @keyframes candleGlow {
          0% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35);}
          50% { text-shadow: 0 0 22px rgba(212,175,55,0.85), 0 0 6px rgba(255,235,195,0.55);}
          100% { text-shadow: 0 0 10px rgba(212,175,55,0.45), 0 0 2px rgba(255,235,195,0.35);}
        }
        .glow { animation: candleGlow 2.4s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-30 supports-[backdrop-filter]:bg-amber-950/20 backdrop-blur border-b border-amber-900/40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#7c1e1e]/70 border border-amber-900/40 grid place-content-center text-sm font-black font-[Cinzel,serif]">
              ITX
            </div>
            <h1 className="text-sm sm:text-base font-semibold font-[Cinzel,serif]">
              Verify Registration
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded-lg text-[11px] bg-amber-950/30 border border-amber-900/40 font-mono">
              code: {code}
            </span>
            <span className="px-2 py-1 rounded-lg text-[11px] bg-amber-950/30 border border-amber-900/40 font-mono">
              {secondsLeft > 0 ? `~${mm}:${ss}` : "expires soon"}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 overflow-x-hidden">
        <div className="max-w-3xl w-full">
          <p className="text-amber-200/90 text-sm font-[Crimson_Pro,serif]">
            Select your name and enter your email to receive your winning code.
            This link is single-use and expires after ~15 minutes.
          </p>

          {status && (
            <div
              className={`mt-4 rounded-2xl p-4 border font-[Crimson_Pro,serif] ${
                status.toLowerCase().startsWith("verified")
                  ? "bg-emerald-900/30 border-emerald-400/40 text-emerald-100"
                  : "bg-rose-900/30 border-rose-400/40 text-rose-100"
              }`}
            >
              <div className="break-words min-w-0">{status}</div>
            </div>
          )}

          {/* Fetch error banner */}
          {fetchErr && (
            <div className="mt-4 rounded-2xl p-4 bg-rose-900/40 border border-rose-400/40 text-rose-100 flex items-center justify-between gap-3 font-[Crimson_Pro,serif]">
              <div className="text-sm">
                {fetchErr} — the list may be incomplete. Try again.
              </div>
              <button
                onClick={fetchRegistrants}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-900/40"
              >
                Retry
              </button>
            </div>
          )}

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className={`mt-6 grid gap-4 rounded-2xl p-6 ${glass} min-w-0`}
          >
            <RegistrantCombobox
              registrants={registrants}
              valueId={selectedId}
              onChangeId={(id) => setSelectedId(id)}
              onRefresh={fetchRegistrants}
              fetching={fetching}
              glassClass={glass}
            />

            <div className="grid gap-2">
              <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className={`p-3 rounded-xl bg-amber-950/20 border ${
                  email
                    ? emailValid
                      ? "border-amber-900/40"
                      : "border-amber-400/60"
                    : "border-amber-900/40"
                } outline-none focus:ring-2 focus:ring-amber-400/60`}
                inputMode="email"
              />
              {!emailValid && email && (
                <p className="text-[11px] text-amber-200 font-[Crimson_Pro,serif]">
                  That email doesn’t look right.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                disabled={!canSubmit}
                className={`px-4 py-2 rounded-lg ${burgundyBtn} disabled:opacity-50`}
              >
                {loading ? "Verifying…" : "Verify & Activate"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
