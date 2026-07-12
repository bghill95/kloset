"use client";

import {
  CATEGORIES,
  CATEGORY_LABELS,
  type Category,
} from "@/lib/closet/categories";

export default function CategoryChips({
  value,
  onChange,
  dark = false,
}: {
  value: Category;
  onChange: (category: Category) => void;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Category">
      {CATEGORIES.map((category) => {
        const active = category === value;
        const activeClass = dark
          ? "bg-canvas text-ink"
          : "bg-ink text-white";
        const idleClass = dark
          ? "bg-white/15 text-white"
          : "bg-card text-ink";
        return (
          <button
            key={category}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(category)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${active ? activeClass : idleClass}`}
          >
            {CATEGORY_LABELS[category]}
          </button>
        );
      })}
    </div>
  );
}
