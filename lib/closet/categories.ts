export const CATEGORIES = ["top", "bottom", "jacket", "shoes", "hat"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Top",
  bottom: "Bottom",
  jacket: "Jacket",
  shoes: "Shoes",
  hat: "Hat",
};

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    (CATEGORIES as readonly string[]).includes(value)
  );
}
