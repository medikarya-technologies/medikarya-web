import "server-only";

// A small fixed-window rate limiter, in memory. Enough to stop one person (or one script) from running up the
// Gemini bill through the AI routes; it is per server process, so with several instances each keeps its own
// count, which only makes it more lenient, never stricter.

const windows = new Map<string, { start: number; count: number }>();

/** Counts one request against `key`; false once more than `max` have been made in the last `windowMs`. */
export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 50_000) sweep(now);
    return true;
  }
  w.count += 1;
  return w.count <= max;
}

function sweep(now: number) {
  // Anything older than a day is certainly expired (no window here is longer).
  for (const [key, w] of windows) if (now - w.start > 86_400_000) windows.delete(key);
}

/** The caller's IP, for limiting signed-out visitors. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
