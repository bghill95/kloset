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

  async function save() {
    setStatus("busy");
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, colors, styleTags }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${item.name}" from your closet?`)) return;
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
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <div
        className="flex h-64 items-center justify-center rounded-xl"
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
        onChange={(e) => setName(e.target.value)}
        aria-label="Name"
        className="rounded-xl border border-neutral-300 p-3 text-lg"
      />
      <CategoryChips value={category} onChange={setCategory} />
      <TagChips label="Colors" values={colors} onChange={setColors} />
      <TagChips label="Style tags" values={styleTags} onChange={setStyleTags} />

      {status === "saved" && (
        <p role="status" className="text-sm text-green-700">
          Saved.
        </p>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          Something went wrong — try again.
        </p>
      )}

      <button
        type="button"
        disabled={status === "busy"}
        onClick={save}
        className="rounded-xl bg-neutral-900 p-3 font-semibold text-white disabled:opacity-50"
      >
        {status === "busy" ? "…" : "Save"}
      </button>
      <button
        type="button"
        disabled={status === "busy"}
        onClick={remove}
        className="text-sm text-red-600 underline"
      >
        Delete item
      </button>
    </div>
  );
}
