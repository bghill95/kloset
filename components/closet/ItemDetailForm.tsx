"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClosetItem } from "@/lib/closet/types";
import CategoryChips from "@/components/scan/CategoryChips";
import TagChips from "@/components/scan/TagChips";

export default function ItemDetailForm({ item }: { item: ClosetItem }) {
  const router = useRouter();
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [colors, setColors] = useState(item.colors);
  const [styleTags, setStyleTags] = useState(item.styleTags);
  const [status, setStatus] = useState<"idle" | "busy" | "saved" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function touch<T>(setter: (v: T) => void) {
    return (v: T) => {
      if (status === "saved") setStatus("idle");
      setter(v);
    };
  }

  async function save() {
    setErrorMessage(null);
    setStatus("busy");
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, colors, styleTags }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setErrorMessage(data?.error ?? null);
        setStatus("error");
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        item?: { name: string; category: typeof category; colors: string[]; styleTags: string[] };
      } | null;
      if (data?.item) {
        setName(data.item.name);
        setCategory(data.item.category);
        setColors(data.item.colors);
        setStyleTags(data.item.styleTags);
      }
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${item.name}" from your closet?`)) return;
    setErrorMessage(null);
    setStatus("busy");
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/closet");
        router.refresh();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto mt-4 flex max-w-md flex-col gap-4">
      <div
        className="flex h-64 items-center justify-center rounded-card p-3"
        style={{
          background:
            "repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 16px 16px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <input
        value={name}
        onChange={(e) => touch(setName)(e.target.value)}
        aria-label="Name"
        className="rounded-card border border-hairline p-3 text-lg"
      />
      <CategoryChips value={category} onChange={touch(setCategory)} />
      <TagChips label="Colors" values={colors} onChange={touch(setColors)} />
      <TagChips label="Style tags" values={styleTags} onChange={touch(setStyleTags)} />

      {status === "saved" && (
        <p role="status" className="text-sm text-success">
          Saved.
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-error">
          {errorMessage ?? "Something went wrong — try again."}
        </p>
      )}

      <button
        type="button"
        disabled={status === "busy"}
        onClick={save}
        className="rounded-full bg-pink p-3 font-semibold text-on-pink active:bg-pink-deep disabled:opacity-50"
      >
        {status === "busy" ? "…" : "Save"}
      </button>
      <button
        type="button"
        disabled={status === "busy"}
        onClick={remove}
        className="text-sm text-error underline disabled:opacity-50"
      >
        Delete item
      </button>
    </div>
  );
}
