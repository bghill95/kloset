"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Replays the page entrance on route change WITHOUT remounting children —
// a remounting wrapper (template.tsx) would also tear down the menu overlay
// mid-dismissal, killing its slide-down reveal of the incoming page.
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    // Initial load already animates via the class in the markup.
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.classList.remove("animate-page-in");
    void el.offsetWidth; // reflow so re-adding the class restarts the animation
    el.classList.add("animate-page-in");
  }, [pathname]);

  return (
    <div ref={ref} className="animate-page-in">
      {children}
    </div>
  );
}
