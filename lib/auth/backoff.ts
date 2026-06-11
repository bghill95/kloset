const BASE_MS = 30_000;
const FREE_ATTEMPTS = 5;
const MAX_EXPONENT = 7; // 30s * 2^7 = 64 minutes

export function lockoutMs(failedAttempts: number): number {
  if (failedAttempts < FREE_ATTEMPTS) return 0;
  const exponent = Math.min(failedAttempts - FREE_ATTEMPTS, MAX_EXPONENT);
  return BASE_MS * 2 ** exponent;
}
