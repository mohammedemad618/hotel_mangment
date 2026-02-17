import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { runSubscriptionMaintenance } from '@/core/subscription/maintenance';
import { runSubscriptionNotificationSweep } from '@/core/subscription/notifications';
import {
    SUBSCRIPTION_GRACE_DAYS,
    SUBSCRIPTION_WARNING_DAYS,
} from '@/core/subscription/policy';

export const dynamic = 'force-dynamic';

function extractCronSecret(request: NextRequest): string | null {
    const directSecret = request.headers.get('x-cron-secret');
    if (directSecret) return directSecret.trim();

    const authorization = request.headers.get('authorization');
    if (!authorization) return null;

    const bearerPrefix = 'Bearer ';
    if (!authorization.startsWith(bearerPrefix)) return null;
    return authorization.slice(bearerPrefix.length).trim();
}

function timingSafeSecretMatch(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, providedBuffer);
}

function isCronAuthorized(request: NextRequest): { ok: boolean; error?: string } {
    const expectedSecret = process.env.INTERNAL_CRON_SECRET;
    if (!expectedSecret || expectedSecret.length < 16) {
        return { ok: false, error: 'INTERNAL_CRON_SECRET is not configured' };
    }

    const providedSecret = extractCronSecret(request);
    if (!providedSecret) return { ok: false, error: 'Missing cron secret' };

    if (!timingSafeSecretMatch(expectedSecret, providedSecret)) {
        return { ok: false, error: 'Invalid cron secret' };
    }

    return { ok: true };
}

async function handleCron(request: NextRequest) {
    const auth = isCronAuthorized(request);
    if (!auth.ok) {
        const statusCode = auth.error === 'INTERNAL_CRON_SECRET is not configured' ? 500 : 401;
        return NextResponse.json({ error: auth.error }, { status: statusCode });
    }

    try {
        await connectDB();

        const now = new Date();
        const maintenance = await runSubscriptionMaintenance({}, now);
        const notifications = await runSubscriptionNotificationSweep({}, now);

        return NextResponse.json({
            success: true,
            executedAt: now.toISOString(),
            policy: {
                warningDays: SUBSCRIPTION_WARNING_DAYS,
                graceDays: SUBSCRIPTION_GRACE_DAYS,
            },
            maintenance,
            notifications,
        });
    } catch (error) {
        console.error('Subscription cron execution failed:', error);
        return NextResponse.json(
            { error: 'Failed to execute subscription cron task' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    return handleCron(request);
}

export async function POST(request: NextRequest) {
    return handleCron(request);
}
