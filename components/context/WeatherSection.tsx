"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function WeatherSection({
  currentLabel,
}: {
  currentLabel: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) setError(data?.error ?? "Couldn't save — try again.");
      else {
        setQuery("");
        router.refresh();
      }
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/weather", { method: "DELETE" });
      if (!res.ok) setError("Couldn't remove — try again.");
      else router.refresh();
    } catch {
      setError("Couldn't remove — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Weather">
      <h2 className="text-lg font-semibold">Weather</h2>
      <p className="mt-1 text-sm text-mute">
        Set a location for the daily forecast in the status bar.
      </p>
      {currentLabel ? (
        <div className="mt-2 flex items-center gap-3">
          <p className="text-sm text-body">
            📍 Weather location: {currentLabel}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="text-xs text-red-600 underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, e.g. Carlsbad"
            aria-label="City"
            disabled={busy}
            className="flex-1 rounded-card border border-hairline p-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || query.trim().length === 0}
            onClick={save}
            className="rounded-full bg-pink px-4 py-2 text-sm font-semibold text-white active:bg-pink-deep disabled:opacity-50"
          >
            {busy ? "…" : "Set location"}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
