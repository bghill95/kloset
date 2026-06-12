"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CalendarSection({
  currentUrl,
}: {
  currentUrl: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icsUrl: url }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        eventCount?: number;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save — try again.");
      } else {
        setMessage(`Connected — ${data?.eventCount ?? 0} events this week.`);
        setUrl("");
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
    setMessage(null);
    try {
      const res = await fetch("/api/settings/calendar", { method: "DELETE" });
      if (!res.ok) setError("Couldn't remove — try again.");
      else router.refresh();
    } catch {
      setError("Couldn't remove — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Calendar">
      <h2 className="text-lg font-semibold">Calendar</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Paste your iCloud shared-calendar link (iCloud Calendar → share →
        public link). Events show in the status bar and feed outfit
        suggestions later.
      </p>
      {currentUrl ? (
        <div className="mt-2 flex items-center gap-3">
          <p className="text-sm text-neutral-700">✅ Calendar connected</p>
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
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="webcal://… or https://…"
            aria-label="Calendar link"
            className="flex-1 rounded-xl border border-neutral-300 p-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || url.trim().length === 0}
            onClick={save}
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Save & test"}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-green-700">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}
