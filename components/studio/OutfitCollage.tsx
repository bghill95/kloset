import type { CSSProperties } from "react";
import { CATEGORIES, type Category } from "@/lib/closet/categories";
import type { ClosetItem } from "@/lib/closet/types";

// Fixed flat-lay zones on a 3:4 canvas: garment column left (top over bottom),
// jacket top-right, hat mid-right, shoes bottom-right, accessory bottom-center.
// DOM order = CATEGORIES order, so later categories paint over earlier ones.
const ZONES: Record<Category, CSSProperties> = {
  top: { left: "6%", top: "4%", width: "46%" },
  bottom: { left: "10%", top: "46%", width: "42%" },
  dress: { left: "6%", top: "4%", width: "50%" },
  jacket: { left: "55%", top: "6%", width: "40%" },
  shoes: { left: "58%", top: "64%", width: "36%" },
  hat: { left: "64%", top: "42%", width: "26%" },
  accessory: { left: "38%", top: "74%", width: "22%" },
};

export default function OutfitCollage({ items }: { items: ClosetItem[] }) {
  const ordered = CATEGORIES.flatMap((c) => items.filter((i) => i.category === c));
  return (
    <div
      data-testid="outfit-collage"
      className="relative aspect-[3/4] overflow-hidden rounded-card bg-card"
    >
      {ordered.map((item) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={item.id}
          src={item.imageUrl}
          alt={item.name}
          className="absolute object-contain"
          style={ZONES[item.category]}
        />
      ))}
    </div>
  );
}
