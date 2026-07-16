import { type Result, UUID_RE } from "@/lib/closet/item-validation";
import { DATE_KEY_RE } from "@/lib/wears/validation";

const MAX_DEST = 100;
export const MAX_TRIP_DAYS = 30;

export type NewTrip = { destination: string; startDate: string; endDate: string };

export function tripDays(startDate: string, endDate: string): number {
  const [ys, ms, ds] = startDate.split("-").map(Number);
  const [ye, me, de] = endDate.split("-").map(Number);
  return Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1;
}

export function validateNewTrip(raw: unknown): Result<NewTrip> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.destination !== "string") {
    return { ok: false, error: "destination is required." };
  }
  const destination = o.destination.trim();
  if (destination.length === 0 || destination.length > MAX_DEST) {
    return { ok: false, error: `destination must be 1–${MAX_DEST} characters.` };
  }
  if (typeof o.startDate !== "string" || !DATE_KEY_RE.test(o.startDate)) {
    return { ok: false, error: "startDate must be a YYYY-MM-DD date." };
  }
  if (typeof o.endDate !== "string" || !DATE_KEY_RE.test(o.endDate)) {
    return { ok: false, error: "endDate must be a YYYY-MM-DD date." };
  }
  if (o.endDate < o.startDate) {
    return { ok: false, error: "endDate must not be before startDate." };
  }
  if (tripDays(o.startDate, o.endDate) > MAX_TRIP_DAYS) {
    return { ok: false, error: `Trips are capped at ${MAX_TRIP_DAYS} days.` };
  }
  return { ok: true, value: { destination, startDate: o.startDate, endDate: o.endDate } };
}

export function validatePackedPatch(raw: unknown): Result<string[]> {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Body must be an object." };
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.packedIds)) {
    return { ok: false, error: "packedIds must be an array." };
  }
  if (!o.packedIds.every((v): v is string => typeof v === "string" && UUID_RE.test(v))) {
    return { ok: false, error: "packedIds must be item UUIDs." };
  }
  return { ok: true, value: [...new Set(o.packedIds)] };
}
