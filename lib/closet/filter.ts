export type Filterable = { category: string; colors: string[] };

export function filterItems<T extends Filterable>(
  items: T[],
  filters: { category?: string; color?: string },
): T[] {
  return items.filter(
    (item) =>
      (!filters.category || item.category === filters.category) &&
      (!filters.color || item.colors.includes(filters.color)),
  );
}

export function distinctColors(items: Filterable[]): string[] {
  return [...new Set(items.flatMap((item) => item.colors))].sort();
}
