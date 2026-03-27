type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

type Bucket = {
  hits: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(params: {
  key: string;
  maxHits: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const { key, maxHits, windowMs } = params;

  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    buckets.set(key, { hits: 1, resetAt: now + windowMs });
    return {
      ok: true,
      remaining: maxHits - 1,
      retryAfterSec: 0,
    };
  }

  if (current.hits >= maxHits) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.hits += 1;
  return {
    ok: true,
    remaining: Math.max(0, maxHits - current.hits),
    retryAfterSec: 0,
  };
}
