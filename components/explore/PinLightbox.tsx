"use client";

import { useEffect, useRef, useState } from "react";
import SuggestionCard, {
  fetchStylistOutfits,
  type StylistOutfit,
} from "@/components/outfits/SuggestionCard";
import type { Pin } from "@/lib/explore/pexels";

const STYLE_COUNT = 3;

type Props = {
  pin: Pin;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
};

export default function PinLightbox({ pin, saved, onToggleSave, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [looks, setLooks] = useState<StylistOutfit[] | null>(null);
  const [styling, setStyling] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);

  // Same dialog manners as the Menu overlay: lock scroll, focus the close
  // button, and hand focus back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, []);

  async function styleThis() {
    if (styling) return;
    setStyling(true);
    setStyleError(null);
    try {
      const occasion = pin.alt
        ? `Recreate this look: ${pin.alt}`
        : "Recreate this pinned street-style look";
      setLooks(await fetchStylistOutfits({ count: STYLE_COUNT, occasion }));
    } catch (err) {
      setStyleError(err instanceof Error ? err.message : "Styling failed — try again.");
    } finally {
      setStyling(false);
    }
  }

  function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const focusables = e.currentTarget.querySelectorAll<HTMLElement>("a[href], button");
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pin detail"
      className="fixed inset-0 z-50 overflow-y-auto bg-canvas p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        trapTab(e);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex max-w-lg flex-col gap-4 pb-8">
        <div className="flex justify-end">
          <button
            ref={closeRef}
            type="button"
            aria-label="Close pin"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pin.imageUrl}
          alt={pin.alt}
          width={pin.width}
          height={pin.height}
          className="h-auto w-full rounded-card bg-card"
        />
        {pin.alt && <p className="text-body">{pin.alt}</p>}
        <p className="text-sm text-mute">
          Photo by{" "}
          {pin.photographerUrl ? (
            <a className="underline" href={pin.photographerUrl} target="_blank" rel="noreferrer">
              {pin.photographer || "unknown"}
            </a>
          ) : (
            pin.photographer || "unknown"
          )}{" "}
          on{" "}
          <a
            className="underline"
            href={pin.pexelsUrl || "https://www.pexels.com"}
            target="_blank"
            rel="noreferrer"
          >
            Pexels
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={styleThis}
            disabled={styling}
            className="rounded-full bg-pink px-5 py-3 text-sm font-bold text-on-pink active:bg-pink-deep disabled:opacity-50"
          >
            Style this from my closet
          </button>
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            className={`rounded-full px-5 py-3 text-sm font-bold ${
              saved ? "bg-ink text-canvas" : "bg-card text-ink"
            }`}
          >
            {saved ? "Pinned ✓" : "Pin it"}
          </button>
        </div>
        {styling && (
          <p role="status" className="text-sm text-mute">
            Styling your closet…
          </p>
        )}
        {styleError && <p role="alert" className="text-sm text-error">{styleError}</p>}
        {looks && !styling && (
          <section aria-label="Looks from your closet" className="flex flex-col gap-6">
            <h2 className="font-display text-3xl text-ink">From your closet</h2>
            {looks.length === 0 ? (
              <p className="text-mute">
                Not enough in your closet to match this — scan a few more pieces.
              </p>
            ) : (
              looks.map((o, i) => <SuggestionCard key={`${o.name}-${i}`} outfit={o} />)
            )}
          </section>
        )}
      </div>
    </div>
  );
}
