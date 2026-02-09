import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { User } from '@/core/db/models';
import { verifyPassword, generateTokenPair, setAuthCookies, getPermissionsForRole, hashToken } from '@/core/auth';
import { loginSchema } from '@/lib/validations';
import { UserRole } from '@/core/db/models';
import { checkRateLimit, getClientIp } from '@/core/security/rateLimit';

export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const body = await request.json();

        // Validate input
        const validation = loginSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const { email, password } = validation.data;
        const clientIp = getClientIp(request);
        const loginRate = checkRateLimit(`${clientIp}:${email}`, {
            keyPrefix: 'auth:login',
            windowMs: 15 * 60 * 1000,
            max: 10,
        });

        if (!loginRate.ok) {
            return NextResponse.json(
                { error: 'تم تجاوز عدد محاولات تسجيل الدخول، يرجى المحاولة لاحقًا' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(loginRate.retryAfterSec) },
                }
            );
        }

        // Find user with password
        const user = await User.findOne({ email, isActive: true })
            .select('+passwordHash')
            .populate('hotel', 'name slug isActive');

        if (!user) {
            return NextResponse.json(
                { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
                { status: 401 }
            );
        }

        // Verify password
        const isValidPassword = await verifyPassword(password, user.passwordHash);
        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
                { status: 401 }
            );
        }

        // Check if hotel is active (for non-super admins)
        if (user.role !== 'super_admin' && user.hotelId) {
            const hotel = await import('@/core/db/models').then(m => m.Hotel.findById(user.hotelId));
            if (!hotel?.isActive) {
                return NextResponse.json(
                    { error: 'الفندق غير مفعّل - يرجى التواصل مع الدعم' },
                    { status: 403 }
                );
            }
        }

        // Get permissions for role
        const rolePermissions = getPermissionsForRole(user.role as UserRole);
        const permissions = Array.from(
            new Set([...(rolePermissions || []), ...(user.permissions || [])])
        );

        // Generate tokens
        const { accessToken, refreshToken } = await generateTokenPair(
            user._id.toString(),
            user.hotelId?.toString() || null,
            user.role,
            permissions
        );

        // Set cookies
        await setAuthCookies(accessToken, refreshToken);

        // Update last login and refresh token hash
        user.lastLogin = new Date();
        user.refreshTokenHash = hashToken(refreshToken);
        await user.save();

        // Response
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
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء تسجيل الدخول' },
            { status: 500 }
        );
    }
}
