export const CATEGORIES = ["top", "bottom", "dress", "jacket", "shoes", "hat", "accessory"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  jacket: "Jacket",
  shoes: "Shoes",
  hat: "Hat",
  accessory: "Accessory",
};

export const CATEGORY_PLURAL_LABELS: Record<Category, string> = {
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses",
  jacket: "Jackets",
  shoes: "Shoes",
  hat: "Hats",
  accessory: "Accessories",
};

export function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    (CATEGORIES as readonly string[]).includes(value)
  );
}
