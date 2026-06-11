"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PasscodeForm({
  endpoint,
  buttonLabel,
  confirm = false,
}: {
  endpoint: string;
  buttonLabel: string;
  confirm?: boolean;
}) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (confirm && passcode !== confirmValue) {
      setError("Passcodes don't match.");
      return;
    }
    setBusy(true);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/closet");
      router.refresh();
      return;
    }
    const body = (await res.json()) as { error?: string; retryAfterMs?: number };
    if (body.error === "locked" && body.retryAfterMs) {
      setError(`Locked. Try again in ${Math.ceil(body.retryAfterMs / 60000)} min.`);
    } else {
      setError(body.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
      <input
        type="password"
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        placeholder="Passcode"
        aria-label="Passcode"
        className="rounded-xl border border-neutral-300 p-4 text-lg"
        autoFocus
      />
      {confirm && (
        <input
          type="password"
          value={confirmValue}
          onChange={(e) => setConfirmValue(e.target.value)}
          placeholder="Confirm passcode"
          aria-label="Confirm passcode"
          className="rounded-xl border border-neutral-300 p-4 text-lg"
        />
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-neutral-900 p-4 text-lg font-semibold text-white disabled:opacity-50"
      >
        {busy ? "…" : buttonLabel}
      </button>
    </form>
  );
}
