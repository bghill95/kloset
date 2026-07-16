"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import PinLightbox from "@/components/explore/PinLightbox";
import { splitColumns } from "@/lib/explore/masonry";
import type { Pin, SavedPin } from "@/lib/explore/pexels";

const CACHE_KEY = "kloset-explore-feed";

type Cached = { seed: number; page: number; q: string; pins: Pin[]; hasMore: boolean };

function isCached(v: unknown): v is Cached {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.seed === "number" &&
    typeof c.page === "number" &&
    typeof c.q === "string" &&
    typeof c.hasMore === "boolean" &&
    Array.isArray(c.pins)
  );
}

function chipClass(active: boolean) {
  return `rounded-full px-4 py-2 text-sm font-bold ${
    active ? "bg-ink text-canvas" : "bg-card text-ink"
  }`;
}

function PinCard({
  pin,
  saved,
  onOpen,
  onToggleSave,
}: {
  pin: Pin;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  return (
    <div className="relative" data-testid="pin-card">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open pin: ${pin.alt || "fashion photo"}`}
        className="block w-full overflow-hidden rounded-card bg-card"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pin.imageUrl}
          alt={pin.alt}
          width={pin.width}
          height={pin.height}
          loading="lazy"
          decoding="async"
          className="h-auto w-full"
        />
      </button>
      <button
        type="button"
        aria-label={saved ? "Unsave pin" : "Save pin"}
        aria-pressed={saved}
        onClick={onToggleSave}
        className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full ${
          saved ? "bg-ink text-canvas" : "bg-black/50 text-white"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        >
          <path
            d="M12 21s-7.5-4.6-10-9.3C.6 8 2.4 4.5 6 4.5c2.2 0 3.6 1.2 4.5 2.6.9-1.4 2.3-2.6 4.5-2.6 3.6 0 5.4 3.5 4 7.2-2.5 4.7-10 9.3-10 9.3z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export default function ExploreFeed({ savedPins }: { savedPins: SavedPin[] }) {
  const [pins, setPins] = useState<Pin[]>([]);
  const [page, setPage] = useState(0); // last loaded feed page; 0 = none yet
  const [seed, setSeed] = useState<number | null>(null);
  const [q, setQ] = useState(""); // committed search query ("" = For You)
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [view, setView] = useState<"forYou" | "saved">("forYou");
  const [saved, setSaved] = useState<Map<number, SavedPin>>(
    () => new Map(savedPins.map((p) => [p.pexelsId, p])),
  );
  const [lightbox, setLightbox] = useState<Pin | null>(null);
  const [cols, setCols] = useState(2);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Column count tracks the closet grid's breakpoints (2 / sm:3 / md:4).
  useEffect(() => {
    const mqs = [window.matchMedia("(min-width: 768px)"), window.matchMedia("(min-width: 640px)")];
    const update = () => setCols(mqs[0].matches ? 4 : mqs[1].matches ? 3 : 2);
    update();
    for (const mq of mqs) mq.addEventListener("change", update);
    return () => {
      for (const mq of mqs) mq.removeEventListener("change", update);
    };
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, nextSeed: number, nextQ: string, current: Pin[]) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(nextPage), seed: String(nextSeed) });
        if (nextQ) params.set("q", nextQ);
        const res = await fetch(`/api/explore?${params}`);
        const data = (await res.json().catch(() => null)) as
          | { pins?: Pin[]; hasMore?: boolean; error?: string }
          | null;
        if (!res.ok || !data?.pins) {
          throw new Error(data?.error ?? "Couldn't load inspiration — try again.");
        }
        // Neighboring queries — and a single page — can repeat a photo; drop repeats.
        const seen = new Set(current.map((p) => p.pexelsId));
        const merged = [...current];
        for (const p of data.pins) {
          if (!seen.has(p.pexelsId)) {
            seen.add(p.pexelsId);
            merged.push(p);
          }
        }
        setPins(merged);
        setPage(nextPage);
        setHasMore(data.hasMore ?? false);
        try {
          const cache: Cached = {
            seed: nextSeed,
            page: nextPage,
            q: nextQ,
            pins: merged,
            hasMore: data.hasMore ?? false,
          };
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch {
          // Cache is an optimization — a failed write is not a feed failure.
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load inspiration — try again.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Restore the session's feed on back-navigation; otherwise roll a fresh seed.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const c: unknown = JSON.parse(raw);
        if (isCached(c)) {
          setPins(c.pins);
          setPage(c.page);
          setSeed(c.seed);
          setQ(c.q);
          setSearchInput(c.q);
          setHasMore(c.hasMore);
          return;
        }
      }
    } catch {
      // Bad cache — fall through to a fresh load.
    }
    const fresh = Math.floor(Math.random() * 2 ** 31);
    setSeed(fresh);
    void loadPage(1, fresh, "", []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || view !== "forYou") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loading &&
          hasMore &&
          seed !== null &&
          pins.length > 0 &&
          !error
        ) {
          void loadPage(page + 1, seed, q, pins);
        }
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [view, loading, hasMore, seed, q, page, pins, error, loadPage]);

  function shuffle() {
    if (loading) return;
    const fresh = Math.floor(Math.random() * 2 ** 31);
    setSeed(fresh);
    setQ("");
    setSearchInput("");
    setPins([]);
    void loadPage(1, fresh, "", []);
  }

  function search(e: FormEvent) {
    e.preventDefault();
    if (loading || seed === null) return;
    const trimmed = searchInput.trim();
    setQ(trimmed);
    setView("forYou");
    setPins([]);
    void loadPage(1, seed, trimmed, []);
  }

  // Tapping the For You chip while a search is active clears the search.
  function showForYou() {
    setView("forYou");
    if (q && seed !== null && !loading) {
      setQ("");
      setSearchInput("");
      setPins([]);
      void loadPage(1, seed, "", []);
    }
  }

  async function toggleSave(pin: Pin) {
    try {
      const res = await fetch("/api/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pin),
      });
      const data = (await res.json().catch(() => null)) as
        | { saved?: boolean; pin?: SavedPin; error?: string }
        | null;
      if (!res.ok || data?.saved == null) {
        throw new Error(data?.error ?? "Couldn't save the pin — try again.");
      }
      setSaved((prev) => {
        const next = new Map(prev);
        if (data.saved && data.pin) next.set(pin.pexelsId, data.pin);
        else next.delete(pin.pexelsId);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the pin — try again.");
    }
  }

  function grid(list: Pin[], testid: string) {
    return (
      <div className="flex gap-2" data-testid={testid}>
        {splitColumns(list, cols).map((col, ci) => (
          <div key={ci} className="flex min-w-0 flex-1 flex-col gap-2">
            {col.map((pin) => (
              <PinCard
                key={pin.pexelsId}
                pin={pin}
                saved={saved.has(pin.pexelsId)}
                onOpen={() => setLightbox(pin)}
                onToggleSave={() => void toggleSave(pin)}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <form onSubmit={search} role="search" className="flex gap-2">
        <input
          aria-label="Search inspiration"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          maxLength={100}
          placeholder="Search fashion inspiration…"
          className="min-w-0 flex-1 rounded-full bg-card px-4 py-3 text-ink placeholder:text-mute"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-card px-5 py-3 text-sm font-bold text-ink disabled:opacity-50"
        >
          Search
        </button>
      </form>

      <div className="flex items-center justify-between">
        <div className="flex gap-2" role="group" aria-label="Explore view">
          <button
            type="button"
            onClick={showForYou}
            aria-pressed={view === "forYou"}
            className={chipClass(view === "forYou")}
          >
            {q ? `“${q}”` : "For You"}
          </button>
          <button
            type="button"
            onClick={() => setView("saved")}
            aria-pressed={view === "saved"}
            className={chipClass(view === "saved")}
          >
            Saved
          </button>
        </div>
        {view === "forYou" && (
          <button
            type="button"
            onClick={shuffle}
            disabled={loading}
            className="rounded-full bg-card px-4 py-2 text-sm font-bold text-ink disabled:opacity-50"
          >
            Shuffle
          </button>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {view === "forYou" ? (
        <>
          {grid(pins, "pin-grid")}
          {!loading && !error && q && pins.length === 0 && (
            <p className="text-mute">Nothing for “{q}” — try another search.</p>
          )}
          {loading && (
            <p role="status" className="text-sm text-mute">
              Finding inspiration…
            </p>
          )}
          <div ref={sentinelRef} aria-hidden="true" />
        </>
      ) : saved.size === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="font-display text-3xl text-ink">Nothing pinned yet</p>
          <p className="text-mute">Tap the heart on any photo to keep it here.</p>
        </div>
      ) : (
        grid([...saved.values()], "saved-grid")
      )}

      {lightbox && (
        <PinLightbox
          pin={lightbox}
          saved={saved.has(lightbox.pexelsId)}
          onToggleSave={() => void toggleSave(lightbox)}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
