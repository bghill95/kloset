import type { Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";
import { type PrefsSignal, tasteLines } from "@/lib/prefs/aggregate";
import { getOpenAI } from "./openai";
import { inventoryLines, isMockAi } from "./stylist";

const GAPS_MODEL = "gpt-4.1-mini";
const MAX_GAPS = 3;
const MAX_PIECE = 80;
const MAX_REASON = 200;

export type GapSuggestion = { piece: string; reason: string };

// Deterministic offline gaps: first missing categories from a fixed wishlist.
const WISHLIST: Array<[Category, string, string]> = [
  ["jacket", "A versatile jacket", "Layers over most of your outfits and extends them into cooler days."],
  ["dress", "A day dress", "A one-piece outfit that multiplies your looks instantly."],
  ["accessory", "A statement accessory", "Lifts your simplest combinations without new clothes."],
  ["hat", "A finishing hat", "Tops off casual looks and adds polish."],
];

export function mockGaps(items: ClosetItem[]): GapSuggestion[] {
  if (items.length === 0) return [];
  const have = new Set(items.map((i) => i.category));
  const gaps = WISHLIST.filter(([c]) => !have.has(c)).map(([, piece, reason]) => ({ piece, reason }));
  if (gaps.length === 0) {
    return [
      {
        piece: "A statement layer",
        reason: "Your basics are covered — one bold piece unlocks new combinations.",
      },
    ];
  }
  return gaps.slice(0, MAX_GAPS);
}

export function validateGaps(raw: unknown): GapSuggestion[] {
  if (typeof raw !== "object" || raw === null) return [];
  const list = (raw as { gaps?: unknown }).gaps;
  if (!Array.isArray(list)) return [];
  const gaps: GapSuggestion[] = [];
  for (const entry of list) {
    if (gaps.length >= MAX_GAPS) break;
    if (typeof entry !== "object" || entry === null) continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.piece !== "string" || o.piece.trim().length === 0) continue;
    gaps.push({
      piece: o.piece.trim().slice(0, MAX_PIECE),
      reason: typeof o.reason === "string" ? o.reason.trim().slice(0, MAX_REASON) : "",
    });
  }
  return gaps;
}

export function gapsPrompt(items: ClosetItem[], prefs?: PrefsSignal | null): string {
  const taste = prefs ? `\n${tasteLines(prefs.profile).join("\n")}` : "";
  return (
    `You are a wardrobe strategist. Given this closet:\n${inventoryLines(items, prefs)}${taste}\n\n` +
    `Suggest up to ${MAX_GAPS} pieces to buy (NOT already in the closet) that would unlock the most new outfits ` +
    `with what she already owns. For each: a short piece name and a one-sentence reason naming what it pairs with.`
  );
}

export async function suggestGaps(
  items: ClosetItem[],
  prefs?: PrefsSignal | null,
): Promise<GapSuggestion[]> {
  if (items.length === 0) return [];
  if (isMockAi()) return mockGaps(items);

  const res = await getOpenAI().chat.completions.create({
    model: GAPS_MODEL,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "closet_gaps",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["gaps"],
          properties: {
            gaps: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["piece", "reason"],
                properties: {
                  piece: { type: "string" },
                  reason: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    messages: [{ role: "user", content: gapsPrompt(items, prefs) }],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  return validateGaps(parsed);
}
