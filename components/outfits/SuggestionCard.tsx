import OutfitActions from "@/components/outfits/OutfitActions";
import OutfitCollage from "@/components/studio/OutfitCollage";
import type { SerializedClosetItem } from "@/lib/closet/types";

export type StylistOutfit = { name: string; reason: string; items: SerializedClosetItem[] };

export async function fetchStylistOutfits(body: {
  count: number;
  occasion?: string;
  date?: string;
}): Promise<StylistOutfit[]> {
  const res = await fetch("/api/stylist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as
    | { outfits?: StylistOutfit[]; error?: string }
    | null;
  if (!res.ok || !data?.outfits) {
    throw new Error(data?.error ?? "Styling failed — try again.");
  }
  return data.outfits;
}

export default function SuggestionCard({ outfit }: { outfit: StylistOutfit }) {
  return (
    <div className="flex flex-col gap-3" data-testid="suggestion-card">
      <OutfitCollage items={outfit.items} />
      <div>
        <p className="font-bold text-ink">{outfit.name}</p>
        {outfit.reason && <p className="text-sm text-mute">{outfit.reason}</p>}
      </div>
      <OutfitActions
        name={outfit.name}
        itemIds={outfit.items.map((i) => i.id)}
        source="stylist"
      />
    </div>
  );
}
