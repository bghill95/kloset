"use client";

import { useState } from "react";
import type { IngestResult } from "@/lib/ai/ingest";
import type { Category } from "@/lib/closet/categories";
import { deriveName, mismatchWarning } from "@/lib/closet/suggestion";
import CategoryChips from "./CategoryChips";
import TagChips from "./TagChips";

export default function ConfirmSheet({
  result,
  initialCategory,
  onSaved,
  onRetake,
}: {
  result: IngestResult;
  initialCategory: Category;
  onSaved: (mode: "done" | "another") => void;
  onRetake: () => void;
}) {
  const suggestion = result.suggestion;
  // State captures props at mount and never resyncs. Consumers must remount
  // for a new result (e.g. key={result.originalUrl}) — ScanFlow does this by
  // swapping phases, which unmounts the sheet.
  const [category, setCategory] = useState(initialCategory);
  const [name, setName] = useState(
    suggestion?.name ?? deriveName(initialCategory, suggestion?.colors ?? []),
  );
  const [colors, setColors] = useState<string[]>(suggestion?.colors ?? []);
  const [styleTags, setStyleTags] = useState<string[]>(
    suggestion?.styleTags ?? [],
  );
  const [busy, setBusy] = useState<"done" | "another" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recomputed live so switching the category chip clears the warning (spec §3.2).
  const warning = mismatchWarning(suggestion, category);

  async function save(mode: "done" | "another") {
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          colors,
          styleTags,
          imageUrl: result.cutoutUrl ?? result.originalUrl,
          originalImageUrl: result.originalUrl,
        }),
      });
      if (!res.ok) {
        // Error bodies are JSON from our routes but can be platform-generated
        // non-JSON (e.g. proxy 413) — never assume parseability.
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Couldn't save — try again.");
        setBusy(null);
        return;
      }
      onSaved(mode);
    } catch {
      setError("Couldn't save — try again.");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div
        className="flex h-56 items-center justify-center rounded-card p-3"
        style={{
          background:
            "repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 16px 16px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.cutoutUrl ?? result.originalUrl}
          alt="Scanned garment"
          className="max-h-full max-w-full object-contain"
        />
      </div>

      {!suggestion && (
        <p className="text-sm text-mute">
          AI tagging wasn't available — fill in the details yourself.
        </p>
      )}
      {warning && (
        <p role="status" className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          ⚠️ {warning}
        </p>
      )}

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Name"
        className="rounded-card border border-hairline p-3 text-lg"
      />
      <CategoryChips value={category} onChange={setCategory} />
      <TagChips label="Colors" values={colors} onChange={setColors} />
      <TagChips label="Style tags" values={styleTags} onChange={setStyleTags} />

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => save("done")}
          className="flex-1 rounded-full bg-pink p-3 font-semibold text-on-pink active:bg-pink-deep disabled:opacity-50"
        >
          {busy === "done" ? "…" : "Save"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => save("another")}
          className="flex-1 rounded-full bg-secondary p-3 font-semibold text-ink disabled:opacity-50"
        >
          {busy === "another" ? "…" : "Save & scan another"}
        </button>
      </div>
      <button
        type="button"
        onClick={onRetake}
        className="text-sm text-mute underline"
      >
        ↻ Retake
      </button>
    </div>
  );
}
