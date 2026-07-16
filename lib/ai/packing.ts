// lib/ai/packing.ts
import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import type { DayForecast } from "@/lib/context/weather";
import { type PrefsSignal, tasteLines } from "@/lib/prefs/aggregate";
import { getOpenAI } from "./openai";
import { inventoryLines, isMockAi } from "./stylist";

const PACKING_MODEL = "gpt-4.1-mini";
const MAX_ROLE = 120;
const MAX_PICKS = 24;

export type PackingPick = { itemId: string; role: string };

export type PackingOptions = {
  destination: string;
  startDate: string;
  endDate: string;
  days: number;
  forecast: DayForecast[] | null;
  prefs?: PrefsSignal | null;
};

// Deterministic offline capsule: fixed per-category counts, closet order.
export function mockPacking(items: ClosetItem[], days: number): PackingPick[] {
  const byCat = (c: Category) => items.filter((i) => i.category === c);
  const want: Array<[Category, number]> = [
    ["top", Math.min(days, 4)],
    ["bottom", Math.min(Math.ceil(days / 2), 3)],
    ["dress", 1],
    ["shoes", 2],
    ["jacket", 1],
    ["accessory", 1],
  ];
  const picks: PackingPick[] = [];
  for (const [cat, n] of want) {
    for (const item of byCat(cat).slice(0, n)) {
      picks.push({ itemId: item.id, role: `Mock packing pick (${cat})` });
    }
  }
  return picks;
}

export function validatePacking(raw: unknown, items: ClosetItem[]): PackingPick[] {
  if (typeof raw !== "object" || raw === null) return [];
  const list = (raw as { picks?: unknown }).picks;
  if (!Array.isArray(list)) return [];
  const known = new Set(items.map((i) => i.id));
  const seen = new Set<string>();
  const picks: PackingPick[] = [];
  for (const entry of list) {
    if (picks.length >= MAX_PICKS) break;
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.itemId !== "string" || !known.has(o.itemId) || seen.has(o.itemId)) continue;
    seen.add(o.itemId);
    picks.push({
      itemId: o.itemId,
      role: typeof o.role === "string" ? o.role.trim().slice(0, MAX_ROLE) : "",
    });
  }
  return picks;
}

export function packingPrompt(items: ClosetItem[], opts: PackingOptions): string {
  const forecastLines =
    opts.forecast && opts.forecast.length > 0
      ? `Forecast:\n${opts.forecast.map((f) => `- ${f.date}: ${f.tempMin}–${f.tempMax}°, ${f.label}`).join("\n")}`
      : "No forecast available yet — pack for the destination's typical weather in that season.";
  const taste = opts.prefs ? tasteLines(opts.prefs.profile).join("\n") : "";
  return (
    `You are a packing assistant. Build a light travel capsule from this closet, referencing items by their exact ids:\n` +
    `${inventoryLines(items, opts.prefs)}\n\n` +
    `Trip: ${opts.days} day(s) in ${opts.destination}, ${opts.startDate} to ${opts.endDate}.\n` +
    `${forecastLines}\n${taste}\n\n` +
    `Rules: pieces must mix and match; cover every day; prefer versatile items; at most ${MAX_PICKS} pieces. ` +
    `Give each piece a one-line role in the capsule.`
  );
}

export async function suggestPacking(
  items: ClosetItem[],
  opts: PackingOptions,
): Promise<PackingPick[]> {
  if (items.length === 0) return [];
  if (isMockAi()) return mockPacking(items, opts.days);

  const res = await getOpenAI().chat.completions.create({
    model: PACKING_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "packing_capsule",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["picks"],
          properties: {
            picks: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["itemId", "role"],
                properties: {
                  itemId: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    messages: [{ role: "user", content: packingPrompt(items, opts) }],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  return validatePacking(parsed, items);
}
