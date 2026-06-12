export const CATEGORIES = ["top", "bottom", "jacket", "shoes", "hat"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Top",
  bottom: "Bottom",
  jacket: "Jacket",
  shoes: "Shoes",
  hat: "Hat",
};

export const CATEGORY_PLURAL_LABELS: Record<Category, string> = {
  top: "Tops",
  bottom: "Bottoms",
  jacket: "Jackets",
  shoes: "Shoes",
  hat: "Hats",
};

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    (CATEGORIES as readonly string[]).includes(value)
  );
}
