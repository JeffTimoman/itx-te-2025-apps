// app/registration/verify/finish/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Verification Complete",
};

export default function VerificationFinishPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
              ITX
            </div>
            <h1 className="text-sm sm:text-base font-semibold">
              Panitia TE ITX
            </h1>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-16">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
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

          <h2 className="text-2xl font-semibold">Thank you for verifying 🎉</h2>
          <p className="mt-2 text-slate-300">
            Your registration has been successfully activated. You can safely
            close this page.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            Check your spam box to view the email.
          </div>
        </div>
      </main>
    </div>
  );
}
