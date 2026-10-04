"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Radio,
  Settings,
  Store,
} from "lucide-react";

const navigationItems = [
  {
    name: "Overview",
    href: "/overview",
    icon: LayoutDashboard,
  },
  {
    name: "Stores",
    href: "/stores",
    icon: Store,
  },
  {
    name: "Payments",
    href: "/payments",
    icon: CreditCard,
  },
  {
    name: "Orders",
    href: "/orders",
    icon: ClipboardList,
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    name: "Reports",
    href: "/reports",
    icon: FileText,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.07] bg-[#05090d]">
      {/* Brand */}
      <div className="border-b border-white/[0.07] px-7 py-6">
        <Link href="/overview" className="block w-fit">
          <div className="font-serif text-[30px] font-semibold leading-none tracking-tight text-[#f5b942]">
            Yatharth
          </div>

          <div className="mt-2 text-[9px] font-medium uppercase tracking-[0.2em] text-[#f5b942]/75">
            Restaurant Operations
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6">
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;

            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group relative flex h-11 items-center gap-3 rounded-md px-4 text-sm transition-all duration-200 ${
                  isActive
                    ? "bg-[#2a1d0b] text-[#f5b942]"
                    : "text-slate-300 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#f5b942]" />
                )}

                <Icon
                  size={19}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={
                    isActive
                      ? "text-[#f5b942]"
                      : "text-slate-400 transition-colors group-hover:text-slate-200"
                  }
                />

                <span className="font-medium">{item.name}</span>

                {item.live && (
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.8)]" />
                    <span className="text-[9px] font-medium uppercase tracking-wider text-emerald-400">
                      Live
                    </span>
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-white/[0.07] px-7 py-5">
        <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
          Owner Dashboard
        </div>

        <div className="mt-2 text-xs text-slate-600">
          Operations visibility system
        </div>
      </div>
    </aside>
  );
}