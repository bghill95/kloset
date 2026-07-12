"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClosetItem } from "@/lib/closet/types";
import { CATEGORY_LABELS } from "@/lib/closet/categories";
import type { ContextResponse } from "@/lib/context/types";
import { pickOutfit } from "@/lib/today/pick";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function TodayCard({ items }: { items: ClosetItem[] }) {
  const [context, setContext] = useState<ContextResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
    (async () => {
      try {
        const params = new URLSearchParams({
          from: from.toISOString(),
          to: to.toISOString(),
        });
        const res = await fetch(`/api/context?${params}`, { signal: controller.signal });
        if (res.ok) setContext((await res.json()) as ContextResponse);
      } catch {
        // Context is allowed to fail; the page isn't.
      }
    })();
    return () => controller.abort();
  }, []);

  const weather = context?.weather ?? null;
  const events = context?.events.slice(0, 3) ?? [];
  // Local date parts, not toISOString(): the UTC date would roll the outfit
  // seed mid-afternoon for western timezones while the context window stays
  // anchored to local midnight. (Amended during execution.)
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const outfit = pickOutfit(items, weather, dateKey);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-mute">
          {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </p>
        {weather && (
          <span
            aria-label="Today's weather"
            className="rounded-full bg-card px-3 py-1 text-sm font-bold text-ink"
          >
            {weather.emoji} {weather.tempMin}–{weather.tempMax}° {weather.label}
          </span>
        )}
      </div>

      {events.length > 0 && (
        <ul aria-label="Today's events" className="flex flex-col gap-1">
          {events.map((event) => (
            <li key={event.start + event.title} className="text-sm text-body">
              <span className="font-semibold text-ink">
                {event.allDay ? "All day" : formatTime(event.start)}
              </span>{" "}
              {event.title}
            </li>
          ))}
        </ul>
      )}

      {outfit ? (
        <section aria-label="Today's outfit">
          <h2 className="font-script text-3xl text-ink">Today&apos;s outfit</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {outfit.picks.map(({ category, item }) => (
              <Link
                key={item.id}
                href={`/closet/${item.id}`}
                className="relative block overflow-hidden rounded-card bg-card"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.name} className="w-full object-contain p-3" />
                <span className="absolute bottom-2 left-2 rounded-full bg-canvas px-3 py-1 text-xs font-bold text-ink">
                  {CATEGORY_LABELS[category]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="font-script text-3xl text-ink">Your closet awaits</p>
          <p className="text-mute">Add a top and bottom (or a dress) to see today&apos;s outfit.</p>
          <Link
            href="/scan"
            className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-white active:bg-pink-deep"
          >
            Scan your first item
          </Link>
        </div>
      )}
    </div>
  );
}
