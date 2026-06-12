"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ContextResponse } from "@/lib/context/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function StatusBar() {
  const [context, setContext] = useState<ContextResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 48 * 60 * 60 * 1000);
    (async () => {
      try {
        const params = new URLSearchParams({
          from: from.toISOString(),
          to: to.toISOString(),
        });
        const res = await fetch(`/api/context?${params}`, {
          signal: controller.signal,
        });
        if (res.ok) setContext((await res.json()) as ContextResponse);
      } catch {
        // The bar simply doesn't render — never block the page on context.
      }
    })();
    return () => controller.abort();
  }, []);

  if (!context) return null;
  const { events, weather, configured } = context;
  if (!configured.calendar && !configured.weather) return null;
  if (events.length === 0 && !weather) return null;

  const upcoming = events.slice(0, 2);

  return (
    <Link
      href="/settings"
      aria-label="Today's weather and events — manage in Settings"
      className="block overflow-hidden border-b border-neutral-200 bg-white px-4 py-1.5 text-sm whitespace-nowrap text-ellipsis text-neutral-700"
    >
      {weather && (
        <span>
          {weather.emoji} {weather.tempMin}–{weather.tempMax}°
        </span>
      )}
      {upcoming.map((event) => (
        <span key={event.start + event.title}>
          {" · "}
          {event.allDay ? "All day" : formatTime(event.start)} {event.title}
        </span>
      ))}
    </Link>
  );
}
