"use client";

import React from "react";

export default function AdminHeader({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/5 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-white/10 grid place-content-center text-sm font-bold">
            ITX
          </div>
          <h1 className="text-sm sm:text-base font-semibold">{title}</h1>
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
