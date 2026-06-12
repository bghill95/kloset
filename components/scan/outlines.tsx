import type { Category } from "@/lib/closet/categories";

const PATHS: Record<Category, string> = {
  top: "M70 20 Q100 35 130 20 L165 40 L150 75 L135 65 L135 160 L65 160 L65 65 L50 75 L35 40 Z",
  bottom: "M68 20 L132 20 L140 160 L108 160 L100 70 L92 160 L60 160 Z",
  jacket:
    "M70 15 Q100 28 130 15 L168 38 L152 78 L138 66 L138 165 L104 152 L96 152 L62 165 L62 66 L48 78 L32 38 Z",
  shoes:
    "M30 110 Q30 88 52 86 L92 82 Q122 80 142 100 L170 112 Q177 117 172 127 L32 127 Q28 120 30 110 Z",
  hat: "M60 100 Q60 52 100 52 Q140 52 140 100 L172 102 Q178 108 170 112 L40 112 Q32 108 38 102 Z",
};

export const OUTLINE_HINTS: Record<Category, string> = {
  top: "Lay the top flat inside the outline",
  bottom: "Lay the bottoms flat inside the outline",
  jacket: "Lay the jacket flat inside the outline",
  shoes: "Place the shoes side-on inside the outline",
  hat: "Place the hat inside the outline",
};

export function Outline({ category }: { category: Category }) {
  return (
    <svg
      viewBox="0 0 200 180"
      data-testid={`outline-${category}`}
      className="h-auto w-3/4 opacity-80"
    >
      <path
        d={PATHS[category]}
        fill="none"
        stroke="#ffd166"
        strokeWidth="3"
        strokeDasharray="8 6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
