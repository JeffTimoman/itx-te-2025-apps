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

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Registrant = {
  id: number;
  name: string;
  bureau?: string | null;
  gacha_code?: string | null;
};

/**
 * VerifyPage — Hogwarts parchment + candlelight skin
 * (UX & logic preserved; visuals themed to match the Hogwarts vibe)
 *
 * Optional fonts (add once in <head>):
 * <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600..900&family=Crimson+Pro:wght@400;600;700&display=swap" rel="stylesheet">
 */
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
  const [query, setQuery] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualId, setManualId] = useState<string>("");

  // soft local countdown (not authoritative; server owns TTL)
  const [secondsLeft, setSecondsLeft] = useState<number>(15 * 60);
  const timerRef = useRef<number | null>(null);

  const emailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);
  const canSubmit = useMemo(() => {
    const idOk = manualMode
      ? !!manualId.trim() && Number(manualId) > 0
      : !!selectedId;
    return idOk && emailValid && !loading;
  }, [manualMode, manualId, selectedId, emailValid, loading]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrants;
    return registrants.filter((r) =>
      `${r.name} ${r.bureau || ""}`.toLowerCase().includes(q)
    );
  }, [registrants, query]);

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
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const idToSend = manualMode ? Number(manualId) : selectedId;
    if (!idToSend) return setStatus("Please select or enter your ID");
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
        setManualId("");
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
      className={`min-h-screen ${parchmentBg} text-amber-100`}
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
      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-amber-200/90 text-sm font-[Crimson_Pro,serif]">
          Select your name and enter your email to receive your winning code.
          This link is single‑use and expires after ~15 minutes.
        </p>

        {status && (
          <div
            className={`mt-4 rounded-2xl p-4 border font-[Crimson_Pro,serif] ${
              status.toLowerCase().startsWith("verified")
                ? "bg-emerald-900/30 border-emerald-400/40 text-emerald-100"
                : "bg-rose-900/30 border-rose-400/40 text-rose-100"
            }`}
          >
            {status}
          </div>
        )}

        {/* Fetch error banner */}
        {fetchErr && (
          <div className="mt-4 rounded-2xl p-4 bg-rose-900/40 border border-rose-400/40 text-rose-100 flex items-center justify-between gap-3 font-[Crimson_Pro,serif]">
            <div className="text-sm">
              {fetchErr} — you can still enter your ID manually.
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
          className={`mt-6 grid gap-4 rounded-2xl p-6 ${glass}`}
        >
          {!manualMode ? (
            <div className="grid gap-2">
              <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
                Select your name
              </label>
              <div className="flex gap-2 items-center">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name/biro"
                  className="flex-1 p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 outline-none focus:ring-2 focus:ring-amber-400/60"
                />
                <button
                  type="button"
                  onClick={fetchRegistrants}
                  disabled={fetching}
                  className="px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-900/40 disabled:opacity-50"
                >
                  {fetching ? "Refreshing…" : "Refresh"}
                </button>
              </div>
              <select
                value={selectedId ?? ""}
                onChange={(e) =>
                  setSelectedId(e.target.value ? Number(e.target.value) : null)
                }
                className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 outline-none focus:ring-2 focus:ring-amber-400/60"
              >
                <option value="">— Select your name —</option>
                {filtered.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.bureau ? ` — ${r.bureau}` : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-2">
              <label className="text-[11px] uppercase tracking-wider text-amber-300/80">
                Enter your registrant ID
              </label>
              <input
                inputMode="numeric"
                value={manualId}
                onChange={(e) =>
                  setManualId(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="e.g., 1024"
                className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 outline-none focus:ring-2 focus:ring-amber-400/60"
              />
              <button
                type="button"
                onClick={() => setManualMode(false)}
                className="self-start text-xs opacity-85 hover:opacity-100 font-[Crimson_Pro,serif]"
              >
                Back to list
              </button>
            </div>
          )}

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
              type="button"
              onClick={() => {
                setEmail("");
                setSelectedId(null);
                setManualId("");
              }}
              className="px-4 py-2 rounded-lg bg-amber-950/30 border border-amber-900/40"
            >
              Clear
            </button>
            <button
              disabled={!canSubmit}
              className={`px-4 py-2 rounded-lg ${burgundyBtn} disabled:opacity-50`}
            >
              {loading ? "Verifying…" : "Verify & Activate"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
