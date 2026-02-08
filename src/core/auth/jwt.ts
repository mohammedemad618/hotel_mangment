import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';

// ========================================
// JWT Configuration
// ========================================

const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret || rawJwtSecret.length < 32) {
    throw new Error('JWT_SECRET is required and must be at least 32 characters long.');
}

const JWT_SECRET = new TextEncoder().encode(rawJwtSecret);

const ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface TokenPayload extends JWTPayload {
    sub: string; // userId
    hotelId: string | null;
    role: string;
    permissions: string[];
    type: 'access' | 'refresh';
}

// ========================================
// Token Generation
// ========================================

export async function generateAccessToken(payload: Omit<TokenPayload, 'type' | 'iat' | 'exp'>): Promise<string> {
    const token = await new SignJWT({ ...payload, type: 'access' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(ACCESS_TOKEN_EXPIRY)
        .sign(JWT_SECRET);

    return token;
}

export async function generateRefreshToken(userId: string): Promise<string> {
    const token = await new SignJWT({ sub: userId, type: 'refresh' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(REFRESH_TOKEN_EXPIRY)
        .sign(JWT_SECRET);

    return token;
}

export async function generateTokenPair(
    userId: string,
    hotelId: string | null,
    role: string,
    permissions: string[]
): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken({ sub: userId, hotelId, role, permissions }),
        generateRefreshToken(userId),
    ]);

    return { accessToken, refreshToken };
}

// ========================================
// Token Verification
// ========================================

export async function verifyToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as TokenPayload;
    } catch (error) {
        return null;
    }
}

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
    const payload = await verifyToken(token);
    if (!payload || payload.type !== 'access') {
        return null;
    }
    return payload;
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
    const payload = await verifyToken(token);
    if (!payload || payload.type !== 'refresh') {
        return null;
    }
    return payload;
}

// ========================================
// Refresh Token Hashing
// ========================================

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function isTokenHashMatch(token: string, hash: string): boolean {
    const tokenHash = hashToken(token);
    if (tokenHash.length !== hash.length) {
        return false;
    }
    return timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
}

// ========================================
// Cookie Management
// ========================================

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
};

export async function setAuthCookies(
    accessToken: string,
    refreshToken: string
): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.set('access_token', accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60, // 15 minutes
    });

    cookieStore.set('refresh_token', refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60, // 7 days
    });
}

export async function clearAuthCookies(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');
}

export async function getTokensFromCookies(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
}> {
    const cookieStore = await cookies();
    return {
        accessToken: cookieStore.get('access_token')?.value || null,
        refreshToken: cookieStore.get('refresh_token')?.value || null,
    };
}

// ========================================
// Request Token Extraction
// ========================================

export function extractTokenFromRequest(request: NextRequest): string | null {
    // First, try Authorization header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }

    // Then, try cookies
    const accessToken = request.cookies.get('access_token')?.value;
    return accessToken || null;
}
