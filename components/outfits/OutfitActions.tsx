"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { OutfitSource } from "@/lib/outfits/validation";
import { localDateKey } from "@/lib/today/date";

type Props = {
  name: string;
  itemIds: string[];
  source?: OutfitSource;
  // Set when the combo is already an outfit row (Lookbook detail, or Today's
  // pick matched an existing wear). Unsaved combos auto-save on first action.
  savedOutfitId?: string | null;
  initialWorn?: boolean;
  // Lookbook detail hides Save — the outfit is saved by definition.
  showSave?: boolean;
};

function pillClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm font-bold ${
    active ? "bg-ink text-canvas" : "bg-card text-ink"
  }`;
}

export default function OutfitActions({
  name,
  itemIds,
  source = "studio",
  savedOutfitId = null,
  initialWorn = false,
  showSave = true,
}: Props) {
  const router = useRouter();
  const [outfitId, setOutfitId] = useState<string | null>(savedOutfitId);
  const [worn, setWorn] = useState(initialWorn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vote, setVote] = useState<"like" | "dislike" | null>(null);

  // Show the existing vote when this exact combo reappears (matched by item-set).
  // ponytail: one lookup per mounted card — fine for a single-user app.
  useEffect(() => {
    if (itemIds.length === 0) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/preferences?items=${itemIds.join(",")}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = (await res.json()) as { vote: "like" | "dislike" | null };
          setVote(data.vote);
        }
      } catch {
        // Lookup is best-effort; thumbs start neutral.
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const voteOutfit = (verdict: "like" | "dislike") =>
    run(async () => {
      const res = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds, verdict, source }),
      });
      const data = (await res.json().catch(() => null)) as
        | { vote?: "like" | "dislike" | null; error?: string }
        | null;
      if (!res.ok || !data || !("vote" in data)) {
        throw new Error(data?.error ?? "Couldn't save your feedback — try again.");
      }
      setVote(data.vote ?? null);
    });

  async function ensureSaved(): Promise<string> {
    if (outfitId) return outfitId;
    const res = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, itemIds, renderUrl: null, source }),
    });
    const data = (await res.json().catch(() => null)) as
      | { outfit?: { id: string }; error?: string }
      | null;
    if (!res.ok || !data?.outfit) {
      throw new Error(data?.error ?? "Save failed — try again.");
    }
    setOutfitId(data.outfit.id);
    return data.outfit.id;
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      await ensureSaved();
    });

  const wearToday = () =>
    run(async () => {
      const id = await ensureSaved();
      const res = await fetch("/api/wears", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outfitId: id, wornOn: localDateKey() }),
      });
      const data = (await res.json().catch(() => null)) as
        | { worn?: boolean; error?: string }
        | null;
      if (!res.ok || data?.worn == null) {
        throw new Error(data?.error ?? "Couldn't log the wear — try again.");
      }
      setWorn(data.worn);
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Outfit actions">
        {showSave && (
          <button
            type="button"
            onClick={save}
            disabled={busy || outfitId !== null}
            className={pillClass(false)}
          >
            {outfitId ? "Saved ✓" : "Save"}
          </button>
        )}
        <button
          type="button"
          onClick={wearToday}
          disabled={busy}
          aria-pressed={worn}
          className={pillClass(worn)}
        >
          {worn ? "Wearing today ✓" : "Wearing this today"}
        </button>
        <Link href={`/studio?items=${itemIds.join(",")}`} className={pillClass(false)}>
          Open in Studio
        </Link>
        <button
          type="button"
          onClick={() => voteOutfit("like")}
          disabled={busy}
          aria-pressed={vote === "like"}
          aria-label="Like this outfit"
          className={pillClass(vote === "like")}
        >
          👍
        </button>
        <button
          type="button"
          onClick={() => voteOutfit("dislike")}
          disabled={busy}
          aria-pressed={vote === "dislike"}
          aria-label="Dislike this outfit"
          className={pillClass(vote === "dislike")}
        >
          👎
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  );
}
