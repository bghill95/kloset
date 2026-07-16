import type { Category } from "@/lib/closet/categories";
import { type Result } from "@/lib/closet/item-validation";
import type { ClosetItem } from "@/lib/closet/types";
import type { WeatherSummary } from "@/lib/context/types";
import { type PrefsSignal, tasteLines } from "@/lib/prefs/aggregate";
import { DATE_KEY_RE } from "@/lib/wears/validation";
import { getOpenAI } from "./openai";

// Same chat model ingest tagging uses.
const STYLIST_MODEL = "gpt-4.1-mini";
const MAX_NAME = 120;
const MAX_REASON = 200;
const MAX_OCCASION = 200;
const MAX_COUNT = 10;

export type StylistCombo = { name: string; reason: string; itemIds: string[] };

export type StylistOptions = {
  count: number;
  occasion?: string;
  date?: string; // YYYY-MM-DD, prompt context only
  weather?: WeatherSummary | null;
  prefs?: PrefsSignal | null;
};

export function isMockAi(): boolean {
  return process.env.MOCK_AI === "1";
}

// An outfit is wearable with a dress, or a top and a bottom.
export function closetCanDress(items: ClosetItem[]): boolean {
  const cats = new Set(items.map((i) => i.category));
  return cats.has("dress") || (cats.has("top") && cats.has("bottom"));
}

function isWearable(cats: Category[]): boolean {
  return cats.includes("dress") || (cats.includes("top") && cats.includes("bottom"));
}

// Drop hallucinated ids, duplicate categories, and unwearable combos.
export function validateCombos(raw: unknown, items: ClosetItem[]): StylistCombo[] {
  if (typeof raw !== "object" || raw === null) return [];
  const list = (raw as { outfits?: unknown }).outfits;
  if (!Array.isArray(list)) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const combos: StylistCombo[] = [];
  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.name !== "string" || o.name.trim().length === 0) continue;
    if (!Array.isArray(o.itemIds)) continue;
    const ids = [...new Set(o.itemIds.filter((v): v is string => typeof v === "string"))];
    const found = ids.flatMap((id) => {
      const match = byId.get(id);
      return match ? [match] : [];
    });
    if (found.length !== ids.length || found.length === 0) continue;
    const cats = found.map((i) => i.category);
    if (new Set(cats).size !== cats.length) continue;
    if (!isWearable(cats)) continue;
    combos.push({
      name: o.name.trim().slice(0, MAX_NAME).trimEnd(),
      reason: typeof o.reason === "string" ? o.reason.trim().slice(0, MAX_REASON) : "",
      itemIds: ids,
    });
  }
  return combos;
}

// Deterministic offline combos: rotate each category by index.
export function mockCombos(items: ClosetItem[], count: number): StylistCombo[] {
  const byCat = (c: Category) => items.filter((i) => i.category === c);
  const tops = byCat("top");
  const bottoms = byCat("bottom");
  const dresses = byCat("dress");
  const shoes = byCat("shoes");
  const combos: StylistCombo[] = [];
  for (let i = 0; i < count; i++) {
    const ids: string[] = [];
    if (tops.length > 0 && bottoms.length > 0 && (dresses.length === 0 || i % 2 === 0)) {
      ids.push(tops[i % tops.length].id, bottoms[i % bottoms.length].id);
    } else if (dresses.length > 0) {
      ids.push(dresses[i % dresses.length].id);
    } else {
      break;
    }
    if (shoes.length > 0) ids.push(shoes[i % shoes.length].id);
    combos.push({
      name: `Mock look ${i + 1}`,
      reason: "Deterministic MOCK_AI pairing from your closet.",
      itemIds: ids,
    });
  }
  return combos;
}

export function inventoryLines(items: ClosetItem[], prefs?: PrefsSignal | null): string {
  return items
    .map((i) => {
      const s = prefs?.scores[i.id];
      const parts: string[] = [];
      if (s?.likes) parts.push(`liked ${s.likes}×`);
      if (s?.dislikes) parts.push(`disliked ${s.dislikes}×`);
      const feedback = parts.length > 0 ? ` | feedback: ${parts.join(", ")}` : "";
      return `- ${i.id} | ${i.category} | ${i.name} | colors: ${i.colors.join(", ") || "n/a"} | tags: ${i.styleTags.join(", ") || "n/a"}${feedback}`;
    })
    .join("\n");
}

export function stylistPrompt(items: ClosetItem[], opts: StylistOptions): string {
  const contextLines = [
    opts.occasion
      ? `Occasion: ${opts.occasion}${opts.date ? ` on ${opts.date}` : ""}.`
      : "General inspiration — varied, everyday looks.",
    opts.weather
      ? `Weather that day: ${opts.weather.tempMin}–${opts.weather.tempMax}°, ${opts.weather.label}.`
      : null,
    ...(opts.prefs ? tasteLines(opts.prefs.profile) : []),
  ]
    .filter(Boolean)
    .join("\n");
  const feedbackRule = opts.prefs
    ? "Honor the feedback signals: favor liked items and styles, avoid disliked ones unless nothing else fits. "
    : "";
  return (
    `You are a personal stylist. Compose ${opts.count} distinct outfits using ONLY items from this closet, referenced by their exact ids:\n` +
    `${inventoryLines(items, opts.prefs)}\n\n${contextLines}\n\n` +
    `Rules: every outfit needs either a dress, or a top and a bottom. At most one item per category. ` +
    `Add shoes/jacket/hat/accessory only when they suit the look. ` +
    feedbackRule +
    `Give each outfit a short evocative name and a one-sentence reason.`
  );
}

export async function suggestOutfits(
  items: ClosetItem[],
  opts: StylistOptions,
): Promise<StylistCombo[]> {
  if (!closetCanDress(items)) return [];
  if (isMockAi()) return mockCombos(items, opts.count);

  const res = await getOpenAI().chat.completions.create({
    model: STYLIST_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "stylist_outfits",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["outfits"],
          properties: {
            outfits: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "reason", "itemIds"],
                properties: {
                  name: { type: "string" },
                  reason: { type: "string" },
                  itemIds: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
    },
    messages: [
      {
        role: "user",
        content: stylistPrompt(items, opts),
      },
    ],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  return validateCombos(parsed, items).slice(0, opts.count);
}

export type StylistBody = { count: number; occasion?: string; date?: string };

export function validateStylistBody(raw: unknown): Result<StylistBody> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  let count = 6;
  if (o.count != null) {
    if (typeof o.count !== "number" || !Number.isInteger(o.count) || o.count < 1 || o.count > MAX_COUNT) {
      return { ok: false, error: `count must be an integer between 1 and ${MAX_COUNT}.` };
    }
    count = o.count;
  }
  let occasion: string | undefined;
  if (o.occasion != null) {
    if (typeof o.occasion !== "string") {
      return { ok: false, error: "occasion must be a string." };
    }
    const trimmed = o.occasion.trim().slice(0, MAX_OCCASION);
    occasion = trimmed.length > 0 ? trimmed : undefined;
  }
  let date: string | undefined;
  if (o.date != null) {
    if (typeof o.date !== "string" || !DATE_KEY_RE.test(o.date)) {
      return { ok: false, error: "date must be a YYYY-MM-DD date." };
    }
    date = o.date;
  }
  return { ok: true, value: { count, occasion, date } };
}
