"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
  const router = useRouter();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Invalidates in-flight renders when the selection changes.
  const renderSeq = useRef(0);

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
    renderSeq.current++;
    setView("collage");
    setNaming(false);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          itemIds: chosen.map((i) => i.id),
          renderUrl: render.url,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setSaveError(data?.error ?? "Save failed — try again.");
        return;
      }
      router.push("/lookbook");
      router.refresh();
    } catch {
      setSaveError("Save failed — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function tryOn() {
    if (render.status === "loading") return;
    const seq = ++renderSeq.current;
    setRender({ status: "loading", url: null });
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: chosen.map((i) => i.id) }),
        signal: AbortSignal.timeout(180_000),
      });
      const data = (await res.json().catch(() => null)) as {
        renderUrl?: string;
        error?: string;
      } | null;
      if (seq !== renderSeq.current) return;
      if (!res.ok || !data?.renderUrl) {
        setRender({
          status: "error",
          url: null,
          message: data?.error ?? "Render failed — try again.",
          needsBasePhoto: res.status === 409,
        });
        return;
      }
      setRender({ status: "idle", url: data.renderUrl });
      setView("render");
    } catch {
      if (seq !== renderSeq.current) return;
      setRender({
        status: "error",
        url: null,
        message: "Render failed — try again.",
        needsBasePhoto: false,
      });
    }
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

      {render.status === "loading" && (
        <p role="status" className="text-sm text-mute">
          Rendering your try-on… this can take a minute.
        </p>
      )}
      {render.status === "error" && (
        <p role="alert" className="text-sm text-error">
          {render.message}{" "}
          {render.needsBasePhoto && (
            <Link href="/avatar-capture" className="underline">
              Capture base photo
            </Link>
          )}
        </p>
      )}
      {render.url && (
        <div className="flex gap-2" role="group" aria-label="Preview mode">
          <button
            type="button"
            onClick={() => setView("collage")}
            aria-pressed={view === "collage"}
            className={chipClass(view === "collage")}
          >
            Flat lay
          </button>
          <button
            type="button"
            onClick={() => setView("render")}
            aria-pressed={view === "render"}
            className={chipClass(view === "render")}
          >
            Try-on
          </button>
        </div>
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void tryOn()}
          disabled={chosen.length === 0 || render.status === "loading"}
          className="h-11 rounded-full bg-pink px-5 text-sm font-bold text-white active:bg-pink-deep disabled:opacity-40"
        >
          {render.status === "loading" ? "Rendering…" : "Try it on"}
        </button>
        <button
          type="button"
          onClick={() => {
            setNaming(true);
            setName(chosen.map((i) => i.name).join(" + ").slice(0, 120));
          }}
          disabled={chosen.length === 0 || saving}
          className="h-11 rounded-full bg-secondary px-5 text-sm font-bold text-ink active:bg-secondary-deep disabled:opacity-40"
        >
          Save outfit
        </button>
      </div>

      {naming && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="flex items-center gap-2"
        >
          <label className="sr-only" htmlFor="outfit-name">
            Outfit name
          </label>
          <input
            id="outfit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            className="h-11 min-w-0 flex-1 rounded-card border border-hairline bg-canvas px-4 text-ink"
          />
          <button
            type="submit"
            disabled={saving || name.trim().length === 0}
            className="h-11 shrink-0 rounded-full bg-secondary px-5 text-sm font-bold text-ink active:bg-secondary-deep disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-error">
          {saveError}
        </p>
      )}
    </div>
  );
}
