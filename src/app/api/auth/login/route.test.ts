import { NextRequest } from 'next/server';
import connectDB from '@/core/db/connection';
import { checkRateLimit } from '@/core/security/rateLimit';
import { POST } from './route';

jest.mock('@/core/db/connection', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('@/core/security/rateLimit', () => ({
    checkRateLimit: jest.fn(),
    getClientIp: jest.fn(() => '127.0.0.1'),
}));

jest.mock('@/core/db/models', () => ({
    Hotel: {
        findById: jest.fn(),
        updateOne: jest.fn(),
    },
    User: {
        findOne: jest.fn(),
    },
}));

jest.mock('@/core/subscription/policy', () => ({
    isSubscriptionExpired: jest.fn(() => false),
}));

jest.mock('@/core/auth', () => ({
    verifyPassword: jest.fn(),
    generateTokenPair: jest.fn(),
    setAuthCookies: jest.fn(),
    getPermissionsForRole: jest.fn(() => []),
    hashToken: jest.fn((value: string) => value),
    generatePinChallengeToken: jest.fn(),
    setPinChallengeCookie: jest.fn(),
    isPinConfigured: jest.fn(() => false),
}));

const mockedConnectDB = connectDB as jest.MockedFunction<typeof connectDB>;
const mockedCheckRateLimit = checkRateLimit as jest.MockedFunction<typeof checkRateLimit>;

function buildRequest(body: unknown): NextRequest {
    return new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '127.0.0.1',
        },
        body: JSON.stringify(body),
    }) as unknown as NextRequest;
}

describe('auth login route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedConnectDB.mockResolvedValue({} as any);
        mockedCheckRateLimit.mockResolvedValue({
            ok: true,
            remaining: 9,
            retryAfterSec: 60,
        });
    });

    it('returns 400 for invalid payload', async () => {
        const response = await POST(buildRequest({ email: 'invalid-email' }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(typeof body.error).toBe('string');
        expect(mockedConnectDB).toHaveBeenCalledTimes(1);
        expect(mockedCheckRateLimit).not.toHaveBeenCalled();
    });

    it('returns 429 when login rate limit is exceeded', async () => {
        mockedCheckRateLimit.mockResolvedValueOnce({
            ok: false,
            remaining: 0,
            retryAfterSec: 45,
        });

        const response = await POST(
            buildRequest({
                email: 'admin@example.com',
                password: 'password123',
            })
        );
        const body = await response.json();

        expect(response.status).toBe(429);
        expect(response.headers.get('Retry-After')).toBe('45');
        expect(typeof body.error).toBe('string');
    });
});
