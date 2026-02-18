import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { User, UserRole } from '@/core/db/models';
import {
    clearPinChallengeCookie,
    generateTokenPair,
    getPermissionsForRole,
    getPinChallengeFromCookies,
    hashToken,
    isPinConfigured,
    setAuthCookies,
    verifyPin,
    verifyPinChallengeToken,
} from '@/core/auth';
import { pinVerifySchema } from '@/lib/validations';
import { checkRateLimit, getClientIp } from '@/core/security/rateLimit';
import { writeAuditLog } from '@/core/audit/logger';

function requiresPinVerification(role: string): boolean {
    return role === 'super_admin' || role === 'sub_super_admin';
}

export async function POST(request: NextRequest) {
    try {
        await connectDB();
        const clientIp = getClientIp(request);
        const rate = await checkRateLimit(clientIp, {
            keyPrefix: 'auth:pin_verify',
            windowMs: 10 * 60 * 1000,
            max: 30,
        });

        if (!rate.ok) {
            return NextResponse.json(
                { error: 'Too many PIN verification attempts, try again later' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(rate.retryAfterSec) },
                }
            );
        }

        const challenge = await getPinChallengeFromCookies();
        if (!challenge) {
            return NextResponse.json({ error: 'PIN challenge is required' }, { status: 401 });
        }

        const payload = await verifyPinChallengeToken(challenge);
        if (!payload?.sub) {
            await clearPinChallengeCookie();
            return NextResponse.json({ error: 'Invalid PIN challenge' }, { status: 401 });
        }

        const body = await request.json();
        const parsed = pinVerifySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
        }

        const user = await User.findById(payload.sub).select(
            'name email role hotelId permissions isActive verification mfaEnabled +mfaSecret'
        );

        if (!user || !user.isActive) {
            await clearPinChallengeCookie();
            return NextResponse.json({ error: 'User not found or inactive' }, { status: 401 });
        }

        if (payload.role !== user.role) {
            await clearPinChallengeCookie();
            return NextResponse.json({ error: 'Invalid PIN challenge context' }, { status: 401 });
        }

        if (!requiresPinVerification(user.role)) {
            await clearPinChallengeCookie();
            return NextResponse.json({ error: 'PIN verification is not required for this role' }, { status: 403 });
        }

        if (user.role === 'sub_super_admin' && !user.verification?.isVerified) {
            await clearPinChallengeCookie();
            return NextResponse.json(
                { error: 'Account is pending main super admin verification' },
                { status: 403 }
            );
        }

        if (
            !isPinConfigured({
                mfaEnabled: Boolean(user.mfaEnabled),
                mfaSecret: (user as any).mfaSecret || null,
            })
        ) {
            return NextResponse.json({ error: 'PIN setup is required before verification' }, { status: 400 });
        }

        const validPin = await verifyPin(parsed.data.pin, (user as any).mfaSecret || null);
        if (!validPin) {
            return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
        }

        const rolePermissions = getPermissionsForRole(user.role as UserRole);
        const permissions = Array.from(
            new Set([...(rolePermissions || []), ...(user.permissions || [])])
        );

        const { accessToken, refreshToken } = await generateTokenPair(
            user._id.toString(),
            user.hotelId?.toString() || null,
            user.role,
            permissions
        );

        user.lastLogin = new Date();
        user.refreshTokenHash = hashToken(refreshToken);
        await user.save();

        await setAuthCookies(accessToken, refreshToken);

        await writeAuditLog({
            request,
            auth: {
                userId: user._id.toString(),
                hotelId: user.hotelId?.toString() || null,
                role: user.role,
                permissions,
            },
            action: 'auth.pin.verified',
            entityType: 'auth',
            targetUserId: user._id,
            targetHotelId: user.hotelId,
        });

        return NextResponse.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                hotelId: user.hotelId,
                permissions,
            },
        });
    } catch (error) {
        console.error('PIN verify error:', error);
        return NextResponse.json({ error: 'Failed to verify PIN' }, { status: 500 });
    }
}
