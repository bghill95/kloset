"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/closet", label: "Closet", icon: "👕" },
  { href: "/studio", label: "Studio", icon: "🪞" },
  { href: "/stylist", label: "Stylist", icon: "💡" },
  { href: "/lookbook", label: "Lookbook", icon: "📔" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
] as const;

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 flex border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              active ? "font-semibold text-neutral-900" : "text-neutral-400"
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
