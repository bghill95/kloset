"use client";

import { useState } from "react";
import DeleteTripButton from "@/components/trips/DeleteTripButton";
import type { DayForecast } from "@/lib/context/weather";
import type { CapsuleEntry } from "@/lib/trips/capsule";

type Props = {
  tripId: string;
  capsule: CapsuleEntry[];
  packedIds: string[];
  forecast: DayForecast[] | null;
};

export default function TripDetail({ tripId, capsule: initialCapsule, packedIds, forecast }: Props) {
  const [capsule, setCapsule] = useState(initialCapsule);
  const [packed, setPacked] = useState<Set<string>>(() => new Set(packedIds));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/capsule`, { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { capsule?: CapsuleEntry[]; packedIds?: string[]; error?: string }
        | null;
      if (!res.ok || !data?.capsule) {
        throw new Error(data?.error ?? "Couldn't build the capsule — try again.");
      }
      setCapsule(data.capsule);
      setPacked(new Set(data.packedIds ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't build the capsule — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePacked(itemId: string) {
    const prev = packed;
    const next = new Set(prev);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setPacked(next); // optimistic — reverted on failure
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packedIds: [...next] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPacked(prev);
      setError("Couldn't save that tick — try again.");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      {forecast && forecast.length > 0 ? (
        <ul aria-label="Trip forecast" className="flex gap-2 overflow-x-auto pb-1">
          {forecast.map((d) => (
            <li
              key={d.date}
              className="shrink-0 rounded-card bg-card px-3 py-2 text-center text-xs text-body"
            >
              <span className="block font-bold text-ink">{d.date.slice(5)}</span>
              {d.emoji} {d.tempMin}–{d.tempMax}°
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">Forecast appears once the trip is within 16 days.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-on-pink active:bg-pink-deep disabled:opacity-50"
        >
          {capsule.length > 0 ? "Regenerate capsule" : "Generate packing list"}
        </button>
        {capsule.length > 0 && (
          <span className="text-sm text-mute">
            {packed.size}/{capsule.length} packed
          </span>
        )}
      </div>
      {busy && (
        <p role="status" className="text-sm text-mute">
          Packing your capsule…
        </p>
      )}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}

      {capsule.length === 0 && !busy ? (
        <p className="text-mute">No capsule yet — generate a packing list from your closet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {capsule.map((entry) => (
            <li key={entry.itemId} data-testid="capsule-item">
              <label className="flex items-center gap-3 rounded-card bg-card p-3">
                <input
                  type="checkbox"
                  checked={packed.has(entry.itemId)}
                  onChange={() => void togglePacked(entry.itemId)}
                  className="h-5 w-5"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded-card bg-canvas object-contain"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold text-ink">{entry.name}</span>
                  <span className="text-sm text-mute">{entry.role}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <DeleteTripButton tripId={tripId} />
    </div>
  );
}
