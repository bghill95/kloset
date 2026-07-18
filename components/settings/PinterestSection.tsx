"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Board } from "@/lib/explore/pinterest";

export default function PinterestSection({
  connected,
  syncedAt,
  connectError,
}: {
  connected: boolean;
  syncedAt: string | null;
  connectError: string | null;
}) {
  const router = useRouter();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(connectError);

  useEffect(() => {
    if (!connected) return;
    void (async () => {
      try {
        const res = await fetch("/api/pinterest/boards");
        const data = (await res.json().catch(() => null)) as {
          boards?: Board[];
          selectedIds?: string[];
          error?: string;
        } | null;
        if (!res.ok || !data?.boards) {
          throw new Error(data?.error ?? "Couldn't load boards — try again.");
        }
        setBoards(data.boards);
        setSelected(new Set(data.selectedIds ?? []));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load boards — try again.");
      }
    })();
  }, [connected]);

  async function runSync() {
    const res = await fetch("/api/pinterest/sync", { method: "POST" });
    const data = (await res.json().catch(() => null)) as {
      pinCount?: number;
      error?: string;
    } | null;
    if (!res.ok) throw new Error(data?.error ?? "Sync failed — try again.");
    setMessage(`Synced ${data?.pinCount ?? 0} pins.`);
    router.refresh();
  }

  async function saveAndSync() {
    if (!boards) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const chosen = boards.filter((b) => selected.has(b.id));
      const res = await fetch("/api/pinterest/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boards: chosen }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Couldn't save boards — try again.");
      await runSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await runSync();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/pinterest/auth", { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't disconnect — try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disconnect — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Pinterest">
      <h2 className="text-lg font-semibold">Pinterest</h2>
      <p className="mt-1 text-sm text-mute">
        Your Explore feed pulls pins from the boards you pick here.
      </p>
      {!connected ? (
        <a
          href="/api/pinterest/auth"
          className="mt-2 inline-block rounded-full bg-pink px-4 py-2 text-sm font-semibold text-on-pink active:bg-pink-deep"
        >
          Connect Pinterest
        </a>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <p className="text-sm text-body">✅ Pinterest connected</p>
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="text-xs text-error underline disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
          {boards === null && !error ? (
            <p role="status" className="text-sm text-mute">
              Loading boards…
            </p>
          ) : boards && boards.length === 0 ? (
            <p className="text-sm text-mute">No boards on this account yet.</p>
          ) : (
            boards && (
              <>
                <ul className="flex flex-col gap-1">
                  {boards.map((b) => (
                    <li key={b.id}>
                      <label className="flex items-center gap-2 text-sm text-body">
                        <input
                          type="checkbox"
                          checked={selected.has(b.id)}
                          disabled={busy}
                          onChange={(e) =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(b.id);
                              else next.delete(b.id);
                              return next;
                            })
                          }
                        />
                        {b.name}
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveAndSync()}
                    disabled={busy || selected.size === 0}
                    className="rounded-full bg-pink px-4 py-2 text-sm font-semibold text-on-pink active:bg-pink-deep disabled:opacity-50"
                  >
                    {busy ? "…" : "Save boards & sync"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void syncNow()}
                    disabled={busy}
                    className="rounded-full bg-card px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    Sync now
                  </button>
                </div>
              </>
            )
          )}
          {syncedAt && (
            <p className="text-xs text-mute">
              Last synced {new Date(Number(syncedAt)).toLocaleString()}
            </p>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="mt-2 text-sm text-success">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </section>
  );
}
