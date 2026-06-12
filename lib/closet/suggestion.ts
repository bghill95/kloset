import { type Category, isCategory } from "./categories";

export type Suggestion = {
  name: string;
  colors: string[];
  styleTags: string[];
  detectedCategory: Category | null;
};

const MAX_NAME = 80;
export const MAX_COLORS = 6;
export const MAX_TAGS = 10;
const MAX_ENTRY_LENGTH = 40;

export function cleanStrings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v.length > 0 && v.length <= MAX_ENTRY_LENGTH),
    ),
  ].slice(0, max);
}

export function validateSuggestion(raw: unknown): Suggestion | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || o.name.trim().length === 0) return null;
  return {
    name: o.name.trim().slice(0, MAX_NAME).trimEnd(),
    colors: cleanStrings(o.colors, MAX_COLORS),
    styleTags: cleanStrings(o.styleTags, MAX_TAGS),
    detectedCategory: isCategory(o.detectedCategory) ? o.detectedCategory : null,
  };
}

export function mismatchWarning(
  suggestion: Suggestion | null,
  chosen: Category,
): string | null {
  if (!suggestion?.detectedCategory) return null;
  if (suggestion.detectedCategory === chosen) return null;
  return `This looks more like "${suggestion.detectedCategory}" than "${chosen}".`;
}

export function deriveName(category: Category, colors: string[]): string {
  const color = colors[0]?.trim();
  if (!color) return `New ${category}`;
  return `${color.charAt(0).toUpperCase()}${color.slice(1)} ${category}`;
}
