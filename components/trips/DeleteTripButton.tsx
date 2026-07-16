"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteTripButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Delete failed — try again.");
        return;
      }
      router.push("/trips");
      router.refresh();
    } catch {
      setError("Delete failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="self-start text-sm font-bold text-error underline"
      >
        Delete trip
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-body">Delete this trip?</span>
      <button
        type="button"
        onClick={del}
        disabled={busy}
        className="rounded-full bg-error px-4 py-2 text-sm font-bold text-canvas disabled:opacity-50"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="text-sm text-ink underline"
      >
        Keep
      </button>
      {error && <p role="alert" className="w-full text-sm text-error">{error}</p>}
    </div>
  );
}
