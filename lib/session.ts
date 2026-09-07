export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const IDLE_WARNING_MS = 60 * 1000;
export function activityAge(lastActivity: number | null, now: number) {
  return lastActivity === null ? null : Math.min(IDLE_TIMEOUT_MS, Math.max(0, now - lastActivity));
}
// Keep Auth deletions, remove persistent expiry from cookies issued by the SDK.
export function sessionCookieOptions<T extends { maxAge?: number; expires?: Date }>(options: T) {
  const { maxAge, expires, ...rest } = options;
  return maxAge === 0 ? { ...rest, maxAge: 0 } : rest;
}
