"use client";

import { Bell, ChevronDown } from "lucide-react";

export default function Topbar() {
  return (
    <header className="flex h-20 items-center justify-end border-b border-white/5 bg-[#05090d] px-7">
      <div className="flex items-center gap-5">
        {/* Live data */}
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />

          <span className="text-xs font-medium text-slate-200">
            Live data
          </span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-white/10" />

        {/* Last updated */}
        <span className="text-xs text-slate-400">
          Last updated: Just now
        </span>

        {/* Divider */}
        <div className="h-6 w-px bg-white/10" />

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          <Bell size={20} strokeWidth={1.8} />

          {/* Notification indicator */}
          <span className="absolute right-2 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[#05090d] bg-red-500" />
        </button>

        {/* Owner profile */}
        <button
          type="button"
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
        >
          {/* Avatar */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2a2112] text-sm font-semibold text-[#f5b942]">
            RV
          </div>

          {/* Name and role */}
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              Rohit Verma
            </div>

            <div className="mt-0.5 text-[11px] text-slate-400">
              Owner
            </div>
          </div>

          <ChevronDown
            size={16}
            strokeWidth={1.8}
            className="ml-2 text-slate-400"
          />
        </button>
      </div>
    </header>
  );
}