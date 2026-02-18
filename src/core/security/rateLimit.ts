import { NextRequest } from 'next/server';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

interface RateLimitConfig {
    windowMs: number;
    max: number;
    keyPrefix: string;
}

interface RateLimitResult {
    ok: boolean;
    remaining: number;
    retryAfterSec: number;
}

const store = new Map<string, RateLimitEntry>();
let operationsSinceCleanup = 0;
let upstashFailureLogged = false;

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() || '';
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || '';
const upstashEnabled = Boolean(upstashUrl && upstashToken);

const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local current = redis.call('ZCARD', key)

if current >= max then
  local earliest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset = now + window
  if earliest[2] then
    reset = tonumber(earliest[2]) + window
  end
  return {0, 0, reset}
end

redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)

local count = redis.call('ZCARD', key)
local remaining = max - count
if remaining < 0 then
  remaining = 0
end

local earliest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local reset = now + window
if earliest[2] then
  reset = tonumber(earliest[2]) + window
end

return {1, remaining, reset}
`;

function cleanupExpiredEntries(now: number) {
    operationsSinceCleanup += 1;
    if (operationsSinceCleanup < 200) {
        return;
    }
    operationsSinceCleanup = 0;

    for (const [key, entry] of store.entries()) {
        if (entry.resetAt <= now) {
            store.delete(key);
        }
    }
}

function checkRateLimitInMemory(identifier: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const key = `${config.keyPrefix}:${identifier}`;
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
        store.set(key, {
            count: 1,
            resetAt: now + config.windowMs,
        });
        return {
            ok: true,
            remaining: Math.max(config.max - 1, 0),
            retryAfterSec: Math.ceil(config.windowMs / 1000),
        };
    }

    if (current.count >= config.max) {
        return {
            ok: false,
            remaining: 0,
            retryAfterSec: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
        };
    }

    current.count += 1;
    store.set(key, current);
    return {
        ok: true,
        remaining: Math.max(config.max - current.count, 0),
        retryAfterSec: Math.max(Math.ceil((current.resetAt - now) / 1000), 1),
    };
}

async function checkRateLimitWithUpstash(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult | null> {
    if (!upstashEnabled) {
        return null;
    }

    const now = Date.now();
    const key = `${config.keyPrefix}:${identifier}`;
    const member = `${now}:${Math.random().toString(36).slice(2, 10)}`;

    try {
        const response = await fetch(`${upstashUrl}/eval`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${upstashToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                script: RATE_LIMIT_LUA_SCRIPT,
                keys: [key],
                args: [String(now), String(config.windowMs), String(config.max), member],
            }),
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Upstash HTTP ${response.status}`);
        }

        const payload = await response.json() as { result?: unknown };
        if (!Array.isArray(payload.result) || payload.result.length < 3) {
            throw new Error('Invalid Upstash response shape');
        }

        const allowed = Number(payload.result[0]) === 1;
        const remainingRaw = Number(payload.result[1]);
        const resetAtRaw = Number(payload.result[2]);

        const remaining = Number.isFinite(remainingRaw) ? Math.max(remainingRaw, 0) : 0;
        const resetAt = Number.isFinite(resetAtRaw) ? resetAtRaw : now + config.windowMs;
        const retryAfterSec = Math.max(Math.ceil((resetAt - now) / 1000), 1);

        return {
            ok: allowed,
            remaining,
            retryAfterSec,
        };
    } catch (error) {
        if (!upstashFailureLogged) {
            upstashFailureLogged = true;
            console.warn('Rate limit store fallback to in-memory mode:', error);
        }
        return null;
    }
}

export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const distributedResult = await checkRateLimitWithUpstash(identifier, config);
    if (distributedResult) {
        return distributedResult;
    }

    return checkRateLimitInMemory(identifier, config);
}

export function getClientIp(request: NextRequest): string {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        const first = forwardedFor.split(',')[0]?.trim();
        if (first) {
            return first;
        }
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp.trim();
    }

    return 'unknown';
}
