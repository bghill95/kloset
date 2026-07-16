import type { Pin } from "./pexels";

// Greedy shortest-column packing by aspect height (height/width, i.e. rendered
// height at equal column widths). Sequential over an append-only list, so
// pins already placed never move when a new page is appended — CSS `columns`
// would reflow them on every append.
export function splitColumns(pins: Pin[], count: number): Pin[][] {
  if (count < 1) return [];
  const heights = Array.from({ length: count }, () => 0);
  const cols: Pin[][] = Array.from({ length: count }, () => []);
  for (const pin of pins) {
    let target = 0;
    for (let i = 1; i < count; i++) {
      if (heights[i] < heights[target]) target = i;
    }
    cols[target].push(pin);
    heights[target] += pin.height / pin.width;
  }
  return cols;
}
