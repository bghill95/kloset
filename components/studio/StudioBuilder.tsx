"use client";

import Link from "next/link";
import { useState } from "react";
import OutfitCollage from "./OutfitCollage";
import {
  CATEGORIES,
  CATEGORY_PLURAL_LABELS,
  type Category,
} from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";

type RenderState =
  | { status: "idle"; url: string | null }
  | { status: "loading"; url: null }
  | { status: "error"; url: null; message: string; needsBasePhoto: boolean };

function chipClass(active: boolean) {
  return `whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${
    active ? "bg-ink text-white" : "bg-card text-ink"
  }`;
}

export default function StudioBuilder({ items }: { items: ClosetItem[] }) {
  const [selected, setSelected] = useState<Partial<Record<Category, ClosetItem>>>({});
  const [active, setActive] = useState<Category>(
    () => CATEGORIES.find((c) => items.some((i) => i.category === c)) ?? "top",
  );
  const [view, setView] = useState<"collage" | "render">("collage");
  const [render, setRender] = useState<RenderState>({ status: "idle", url: null });

  const chosen = CATEGORIES.flatMap((c) => (selected[c] ? [selected[c]!] : []));
  const activeItems = items.filter((i) => i.category === active);

  function toggle(item: ClosetItem) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.category]?.id === item.id) delete next[item.category];
      else next[item.category] = item;
      return next;
    });
    // A different outfit invalidates the old render.
    setRender({ status: "idle", url: null });
    setView("collage");
  }

  if (items.length === 0) {
    return (
      <div className="mt-16 flex flex-col items-center gap-3 text-center">
        <p className="font-script text-3xl text-ink">Nothing to style yet</p>
        <p className="text-mute">Scan a few pieces, then come build looks.</p>
        <Link
          href="/scan"
          className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-white active:bg-pink-deep"
        >
          Scan an item
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {view === "render" && render.url ? (
        <div className="overflow-hidden rounded-card bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={render.url} alt="Try-on render" className="w-full" />
        </div>
      ) : (
        <OutfitCollage items={chosen} />
      )}

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        aria-label="Pick a category"
      >
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            aria-pressed={active === c}
            className={chipClass(active === c)}
          >
            {CATEGORY_PLURAL_LABELS[c]}
          </button>
        ))}
      </div>

      <div
        className="flex gap-2 overflow-x-auto pb-1"
        aria-label={`Pick ${CATEGORY_PLURAL_LABELS[active].toLowerCase()}`}
      >
        {activeItems.length === 0 && (
          <p className="text-sm text-mute">
            No {CATEGORY_PLURAL_LABELS[active].toLowerCase()} yet —{" "}
            <Link href="/scan" className="underline">
              scan some
            </Link>
            .
          </p>
        )}
        {activeItems.map((item) => {
          const isSelected = selected[item.category]?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item)}
              aria-pressed={isSelected}
              className={`w-28 shrink-0 rounded-card bg-card p-3 ${
                isSelected ? "outline-2 outline-ink" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt="" className="h-24 w-full object-contain" />
              <span className="mt-1 block truncate text-xs font-bold text-ink">
                {item.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
