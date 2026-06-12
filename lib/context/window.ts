const MAX_SPAN_MS = 7 * 24 * 60 * 60 * 1000;

export type WindowResult =
  | { ok: true; from: Date; to: Date }
  | { ok: false; error: string };

export function validateWindow(
  fromRaw: unknown,
  toRaw: unknown,
): WindowResult {
  if (typeof fromRaw !== "string" || typeof toRaw !== "string") {
    return { ok: false, error: "from and to are required ISO timestamps." };
  }
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, error: "from/to must be valid ISO timestamps." };
  }
  if (to.getTime() <= from.getTime()) {
    return { ok: false, error: "to must be after from." };
  }
  if (to.getTime() - from.getTime() > MAX_SPAN_MS) {
    return { ok: false, error: "Window may span at most 7 days." };
  }
  return { ok: true, from, to };
}
