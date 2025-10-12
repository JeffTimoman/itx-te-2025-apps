// // app/registration/verify/finish/page.tsx
// import Link from "next/link";

// export const metadata = {
//   title: "Verification Complete",
// };

// export default function VerificationFinishPage() {
//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
//       {/* Header */}
//       <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
//         <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
//               ITX
//             </div>
//             <h1 className="text-sm sm:text-base font-semibold">
//               Panitia TE ITX
//             </h1>
//           </div>
//         </div>
//       </header>

//       {/* Main */}
//       <main className="max-w-3xl mx-auto px-4 py-16">
//         <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
//           <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-emerald-400/15 border border-emerald-300/30 grid place-content-center">
//             <svg
//               aria-hidden="true"
//               viewBox="0 0 24 24"
//               className="h-8 w-8 text-emerald-300"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="1.5"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 d="M9 12.75l2.25 2.25L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
//               />
//             </svg>
//           </div>

//           <h2 className="text-2xl font-semibold">Thank you for verifying 🎉</h2>
//           <p className="mt-2 text-slate-300">
//             Your registration has been successfully activated. You can safely
//             close this page.
//           </p>

//           <div className="mt-8 flex items-center justify-center gap-3">
//             Check your spam box to view the email.
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }

import Link from "next/link";

export const metadata = {
  title: "Verification Complete — Hogwarts Edition",
};

export default function VerificationFinishPage() {
  return (
    <div
      className="min-h-screen text-amber-100"
      style={{
        backgroundColor: "#1b1410",
        backgroundImage:
          "radial-gradient(1000px 600px at 50% -10%, rgba(244,228,177,0.20), transparent), radial-gradient(800px 500px at 30% 120%, rgba(124,30,30,0.16), transparent)",
      }}
    >
      <style>{`
        @keyframes parchmentGlow { 0% { text-shadow: 0 0 12px rgba(212,175,55,0.45), 0 0 3px rgba(255,235,195,0.35);} 50% { text-shadow: 0 0 24px rgba(212,175,55,0.85), 0 0 6px rgba(255,235,195,0.55);} 100% { text-shadow: 0 0 12px rgba(212,175,55,0.45), 0 0 3px rgba(255,235,195,0.35);} }
        .glow { animation: parchmentGlow 2.8s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-amber-950/20 border-b border-amber-900/40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#7c1e1e]/70 border border-amber-900/40 grid place-content-center text-sm font-black font-[Cinzel,serif]">
              ITX
            </div>
            <h1 className="text-sm sm:text-base font-semibold font-[Cinzel,serif] glow">
              ITX TE Registry
            </h1>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="rounded-2xl border border-amber-900/40 bg-[rgba(36,24,19,0.72)] backdrop-blur-md p-8 text-center shadow-2xl">
          <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-emerald-400/15 border border-emerald-300/30 grid place-content-center">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-8 w-8 text-emerald-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75l2.25 2.25L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-semibold font-[Cinzel,serif] glow">
            Thank you for verifying ✨
          </h2>
          <p className="mt-2 text-amber-200/90 font-[Crimson_Pro,serif]">
            Your registration has been magically activated. You may now close
            this page—or continue your journey to the Great Hall.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 text-sm font-[Crimson_Pro,serif]">
            <p className="opacity-90">
              Check your owl post (email) or spam box for secrets code.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

