"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function NewTripForm() {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || destination.trim().length === 0 || !startDate || !endDate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: destination.trim(), startDate, endDate }),
      });
      const data = (await res.json().catch(() => null)) as
        | { trip?: { id: string }; error?: string }
        | null;
      if (!res.ok || !data?.trip) {
        throw new Error(data?.error ?? "Couldn't add the trip — try again.");
      }
      router.push(`/trips/${data.trip.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add the trip — try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-card bg-card p-4">
      <label htmlFor="trip-destination" className="font-bold text-ink">
        Plan a trip
      </label>
      <input
        id="trip-destination"
        aria-label="Destination"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        maxLength={100}
        placeholder="Where to?"
        className="rounded-full bg-canvas px-4 py-3 text-ink placeholder:text-mute"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="trip-start" className="text-sm text-body">
          First day
        </label>
        <input
          id="trip-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-full bg-canvas px-4 py-2 text-sm text-ink"
        />
        <label htmlFor="trip-end" className="text-sm text-body">
          Last day
        </label>
        <input
          id="trip-end"
          type="date"
          value={endDate}
          min={startDate || undefined}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-full bg-canvas px-4 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={busy || destination.trim().length === 0 || !startDate || !endDate}
          className="ml-auto rounded-full bg-pink px-5 py-3 text-sm font-bold text-on-pink active:bg-pink-deep disabled:opacity-50"
        >
          Add trip
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </form>
  );
}
