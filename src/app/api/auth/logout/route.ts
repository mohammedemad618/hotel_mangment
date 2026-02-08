import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { User } from '@/core/db/models';
import { clearAuthCookies, getTokensFromCookies, verifyAccessToken, verifyRefreshToken } from '@/core/auth';

export async function POST(request: NextRequest) {
    try {
        await connectDB();

        const { accessToken, refreshToken } = await getTokensFromCookies();
        let userId: string | null = null;

        if (refreshToken) {
            const payload = await verifyRefreshToken(refreshToken);
            userId = payload?.sub || null;
        }

        if (!userId && accessToken) {
            const payload = await verifyAccessToken(accessToken);
            userId = payload?.sub || null;
        }

        if (userId) {
            await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: '' } });
        }

        await clearAuthCookies();

        return NextResponse.json({
            success: true,
            message: 'تم تسجيل الخروج بنجاح',
        });

    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء تسجيل الخروج' },
            { status: 500 }
        );
    }
}
