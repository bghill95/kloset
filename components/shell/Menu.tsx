"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/closet", label: "Closet" },
  { href: "/studio", label: "Studio" },
  { href: "/stylist", label: "Stylist" },
  { href: "/explore", label: "Explore" },
  { href: "/lookbook", label: "Lookbook" },
  { href: "/settings", label: "Settings" },
] as const;

export default function Menu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (open) closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      // Return focus to the trigger when the dialog closes in place
      // (no-op after route changes — the old trigger is unmounted).
      if (open) triggerRef.current?.focus();
    };
  }, [open]);

  function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const focusables = e.currentTarget.querySelectorAll<HTMLElement>("a[href], button");
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink"
      >
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
          <path d="M1 1h16M1 7h16M1 13h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col bg-menu"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            trapTab(e);
          }}
        >
          <div className="flex items-center justify-between px-5 pt-5">
            <span className="font-script text-3xl text-white" aria-hidden="true">
              Kloset
            </span>
            <button
              ref={closeRef}
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav aria-label="Main" className="flex flex-1 flex-col justify-center gap-2 px-8">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`py-1 font-display text-5xl ${active ? "text-menu-active" : "text-white"}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <p className="px-8 pb-8 text-xs font-medium text-white/70">
            built by Pseudo Engineering Studios
          </p>
        </div>
      )}
    </>
  );
}
