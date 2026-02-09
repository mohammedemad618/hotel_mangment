import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { User, Hotel, UserRole } from '@/core/db/models';
import {
    clearAuthCookies,
    generateTokenPair,
    getPermissionsForRole,
    getTokensFromCookies,
    hashToken,
    isTokenHashMatch,
    setAuthCookies,
    verifyRefreshToken,
} from '@/core/auth';
import { checkRateLimit, getClientIp } from '@/core/security/rateLimit';

export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const clientIp = getClientIp(request);
        const refreshRate = checkRateLimit(clientIp, {
            keyPrefix: 'auth:refresh',
            windowMs: 60 * 1000,
            max: 30,
        });

        if (!refreshRate.ok) {
            return NextResponse.json(
                { error: 'Too many refresh attempts, try again later' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(refreshRate.retryAfterSec) },
                }
            );
        }

        const { refreshToken } = await getTokensFromCookies();
        if (!refreshToken) {
            await clearAuthCookies();
            return NextResponse.json({ error: 'Refresh token missing' }, { status: 401 });
        }

        const payload = await verifyRefreshToken(refreshToken);
        if (!payload?.sub) {
            await clearAuthCookies();
            return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
        }

        const user = await User.findById(payload.sub).select('+refreshTokenHash');
        if (!user || !user.isActive) {
            await clearAuthCookies();
            return NextResponse.json({ error: 'User not found or inactive' }, { status: 401 });
        }

        if (!user.refreshTokenHash || !isTokenHashMatch(refreshToken, user.refreshTokenHash)) {
            await clearAuthCookies();
            return NextResponse.json({ error: 'Refresh token revoked' }, { status: 401 });
        }

        if (user.passwordChangedAt && payload.iat) {
            const passwordChangedAt = Math.floor(user.passwordChangedAt.getTime() / 1000);
            if (passwordChangedAt > payload.iat) {
                await clearAuthCookies();
                return NextResponse.json({ error: 'Password changed, please login again' }, { status: 401 });
            }
        }

        if (user.role !== 'super_admin' && user.hotelId) {
            const hotel = await Hotel.findById(user.hotelId).select('isActive');
            if (!hotel?.isActive) {
                await clearAuthCookies();
                return NextResponse.json({ error: 'Hotel is inactive' }, { status: 403 });
            }
        }

        const rolePermissions = getPermissionsForRole(user.role as UserRole);
        const permissions = Array.from(
            new Set([...(rolePermissions || []), ...(user.permissions || [])])
        );

        const { accessToken, refreshToken: newRefreshToken } = await generateTokenPair(
            user._id.toString(),
            user.hotelId?.toString() || null,
            user.role,
            permissions
        );

        user.refreshTokenHash = hashToken(newRefreshToken);
        await user.save();
        await setAuthCookies(accessToken, newRefreshToken);

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        return NextResponse.json(
            { error: 'Failed to refresh token' },
            { status: 500 }
        );
    }
}
