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

export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
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

