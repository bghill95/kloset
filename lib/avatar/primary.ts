export type BasePhotoLike = {
  id: string;
  isPrimary: boolean;
  createdAt: Date;
};

// After a delete, decide which remaining photo to promote to primary.
// Returns the id to promote, or null when no promotion is needed.
export function pickPrimary(remaining: BasePhotoLike[]): string | null {
  if (remaining.length === 0) return null;
  if (remaining.some((p) => p.isPrimary)) return null;
  return [...remaining].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  )[0].id;
}

// PATCH accepts exactly { isPrimary: true } — nothing else is editable.
export function validatePrimaryPatch(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  const keys = Object.keys(raw);
  return keys.length === 1 && (raw as { isPrimary?: unknown }).isPrimary === true;
}
