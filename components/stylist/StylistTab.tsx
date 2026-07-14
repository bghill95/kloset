"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import SuggestionCard, {
  fetchStylistOutfits,
  type StylistOutfit,
} from "@/components/outfits/SuggestionCard";
import { localDateKey } from "@/lib/today/date";

const FEED_CACHE_KEY = "kloset-stylist-feed";
const FEED_COUNT = 6;
const OCCASION_COUNT = 3;
const MAX_DATE_OFFSET_DAYS = 15; // open-meteo forecast horizon

export default function StylistTab() {
  const [feed, setFeed] = useState<StylistOutfit[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const [occasion, setOccasion] = useState("");
  const [date, setDate] = useState(() => localDateKey());
  const [results, setResults] = useState<StylistOutfit[] | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  async function loadFeed() {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const outfits = await fetchStylistOutfits({ count: FEED_COUNT });
      setFeed(outfits);
      if (outfits.length > 0) {
        try {
          sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify(outfits));
        } catch {
          // Cache is an optimization — a failed write is not a styling failure.
        }
      }
    } catch (err) {
      // Keep the previous batch on a failed shuffle — stale looks beat a blank feed.
      setFeedError(err instanceof Error ? err.message : "Styling failed — try again.");
    } finally {
      setFeedLoading(false);
    }
  }

  // The batch is cached per session: navigating away and back shows the same
  // looks instantly; Shuffle explicitly spends a fresh AI call.
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(FEED_CACHE_KEY);
      if (cached) {
        setFeed(JSON.parse(cached) as StylistOutfit[]);
        return;
      }
    } catch {
      // Bad cache — fall through to a fresh fetch.
    }
    void loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function styleOccasion(e: FormEvent) {
    e.preventDefault();
    if (resultsLoading || occasion.trim().length === 0) return;
    setResultsLoading(true);
    setResultsError(null);
    try {
      setResults(
        await fetchStylistOutfits({
          count: OCCASION_COUNT,
          occasion: occasion.trim(),
          date: date || undefined,
        }),
      );
    } catch (err) {
      setResults(null);
      setResultsError(err instanceof Error ? err.message : "Styling failed — try again.");
    } finally {
      setResultsLoading(false);
    }
  }

  const minDate = localDateKey();
  const maxDate = localDateKey(
    new Date(Date.now() + MAX_DATE_OFFSET_DAYS * 24 * 60 * 60 * 1000),
  );

  return (
    <div className="mt-4 flex flex-col gap-8">
      <form onSubmit={styleOccasion} className="flex flex-col gap-2 rounded-card bg-card p-4">
        <label htmlFor="occasion" className="font-bold text-ink">
          Style an occasion
        </label>
        <input
          id="occasion"
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          maxLength={200}
          placeholder="Interview, dinner date, gallery opening…"
          className="rounded-full bg-canvas px-4 py-3 text-ink placeholder:text-mute"
        />
        <div className="flex items-center gap-2">
          <label htmlFor="occasion-date" className="text-sm text-body">
            On
          </label>
          <input
            id="occasion-date"
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-full bg-canvas px-4 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={resultsLoading || occasion.trim().length === 0}
            className="ml-auto rounded-full bg-pink px-5 py-3 text-sm font-bold text-on-pink active:bg-pink-deep disabled:opacity-50"
          >
            Style me
          </button>
        </div>
      </form>

      {resultsLoading && (
        <p role="status" className="text-sm text-mute">
          Styling your occasion…
        </p>
      )}
      {resultsError && <p className="text-sm text-error">{resultsError}</p>}
      {results && !resultsLoading && (
        <section aria-label="Occasion looks" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-3xl text-ink">For the occasion</h2>
            <button
              type="button"
              onClick={() => setResults(null)}
              className="text-sm text-mute underline"
            >
              Clear
            </button>
          </div>
          {results.length === 0 ? (
            <p className="text-mute">Couldn&apos;t style that — try rewording it.</p>
          ) : (
            results.map((o, i) => <SuggestionCard key={`${o.name}-${i}`} outfit={o} />)
          )}
        </section>
      )}

      <section aria-label="Inspiration feed" className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl text-ink">Inspiration</h2>
          <button
            type="button"
            onClick={() => void loadFeed()}
            disabled={feedLoading}
            className="rounded-full bg-card px-4 py-2 text-sm font-bold text-ink disabled:opacity-50"
          >
            Shuffle
          </button>
        </div>
        {feedLoading && (
          <p role="status" className="text-sm text-mute">
            Styling your closet…
          </p>
        )}
        {feedError && <p className="text-sm text-error">{feedError}</p>}
        {feed && !feedLoading && feed.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="font-display text-3xl text-ink">Not enough to style yet</p>
            <p className="text-mute">Scan a few tops and bottoms (or a dress) first.</p>
            <Link
              href="/scan"
              className="rounded-full bg-ink px-5 py-3 text-sm font-bold text-canvas"
            >
              Scan an item
            </Link>
          </div>
        )}
        {feed &&
          !feedLoading &&
          feed.length > 0 &&
          feed.map((o, i) => <SuggestionCard key={`${o.name}-${i}`} outfit={o} />)}
      </section>
    </div>
  );
}
