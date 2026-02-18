import { NextRequest } from 'next/server';
import connectDB from '@/core/db/connection';
import { runSubscriptionMaintenance } from '@/core/subscription/maintenance';
import { runSubscriptionNotificationSweep } from '@/core/subscription/notifications';
import { GET, POST } from './route';

jest.mock('@/core/db/connection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('@/core/subscription/maintenance', () => ({
    runSubscriptionMaintenance: jest.fn(),
}));

jest.mock('@/core/subscription/notifications', () => ({
    runSubscriptionNotificationSweep: jest.fn(),
}));

const mockedConnectDB = connectDB as jest.MockedFunction<typeof connectDB>;
const mockedRunSubscriptionMaintenance =
    runSubscriptionMaintenance as jest.MockedFunction<typeof runSubscriptionMaintenance>;
const mockedRunSubscriptionNotificationSweep =
    runSubscriptionNotificationSweep as jest.MockedFunction<typeof runSubscriptionNotificationSweep>;

function buildRequest(method: 'GET' | 'POST', headers: Record<string, string> = {}): NextRequest {
    return new Request('http://localhost/api/internal/cron/subscriptions', {
        method,
        headers,
    }) as unknown as NextRequest;
}

describe('internal subscription cron route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.INTERNAL_CRON_SECRET = 'test-internal-cron-secret';
        mockedConnectDB.mockResolvedValue({} as any);
        mockedRunSubscriptionMaintenance.mockResolvedValue({
            cutoffDate: new Date().toISOString(),
            scannedOverdue: 0,
            updatedCount: 0,
            affectedIds: [],
        });
        mockedRunSubscriptionNotificationSweep.mockResolvedValue({
            scannedHotels: 0,
            warningQueued: 0,
            graceStartedQueued: 0,
            graceFinalQueued: 0,
            totalQueued: 0,
        });
    });

    it('returns 401 when cron secret is missing', async () => {
        const response = await GET(buildRequest('GET'));
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body).toEqual({ error: 'Missing cron secret' });
        expect(mockedConnectDB).not.toHaveBeenCalled();
    });

    it('returns 500 when INTERNAL_CRON_SECRET is not configured', async () => {
        const previousSecret = process.env.INTERNAL_CRON_SECRET;
        delete process.env.INTERNAL_CRON_SECRET;

        const response = await GET(buildRequest('GET', { 'x-cron-secret': 'any-secret' }));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: 'INTERNAL_CRON_SECRET is not configured' });
        expect(mockedConnectDB).not.toHaveBeenCalled();

        process.env.INTERNAL_CRON_SECRET = previousSecret;
    });

    it('returns 200 and executes maintenance for valid secret', async () => {
        const response = await POST(
            buildRequest('POST', { 'x-cron-secret': process.env.INTERNAL_CRON_SECRET as string })
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockedConnectDB).toHaveBeenCalledTimes(1);
        expect(mockedRunSubscriptionMaintenance).toHaveBeenCalledTimes(1);
        expect(mockedRunSubscriptionNotificationSweep).toHaveBeenCalledTimes(1);
    });
});
