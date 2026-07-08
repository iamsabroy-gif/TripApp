// In-memory fixed-window rate limiter (FSD §4.1: max 5 login attempts per IP
// per 15 minutes). Sufficient for a single-instance deployment; swap for a
// Redis-backed limiter if the app is ever scaled horizontally.

interface WindowEntry {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, WindowEntry>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  { max = 5, windowMs = 15 * 60 * 1000 }: { max?: number; windowMs?: number } = {}
): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now - entry.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count > max) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test helper. */
export function resetRateLimiter() {
  buckets.clear();
}
