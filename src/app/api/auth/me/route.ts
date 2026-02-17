import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Hotel, User } from '@/core/db/models';
import { withAuth, withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';
import { hotelSettingsSchema } from '@/lib/validations';
import { runSubscriptionNotificationSweep } from '@/core/subscription/notifications';
import { normalizeHotelNotifications } from '@/core/notifications/catalog';

async function handler(
    _request: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        if (auth.hotelId && auth.role !== 'super_admin' && auth.role !== 'sub_super_admin') {
            try {
                await runSubscriptionNotificationSweep({ _id: auth.hotelId }, new Date());
            } catch (notificationError) {
                console.error('Subscription notification sweep failed for current hotel:', notificationError);
            }
        }

        const user = await User.findById(auth.userId)
            .select('-passwordHash -mfaSecret -refreshTokenHash')
            .populate('hotel', 'name slug email phone address settings subscription notificationsLog logo');

        if (!user) {
            return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 });
        }

        const hotelData = user.hotel
            ? typeof (user.hotel as any).toObject === 'function'
                ? (user.hotel as any).toObject()
                : user.hotel
            : null;

        if (hotelData?.notificationsLog && Array.isArray(hotelData.notificationsLog)) {
            hotelData.notificationsLog = normalizeHotelNotifications(hotelData.notificationsLog).slice(0, 50);
        }

        return NextResponse.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                hotelId: user.hotelId,
                pinEnabled: Boolean((user as any).mfaEnabled),
                mfaEnabled: Boolean((user as any).mfaEnabled),
                verification: (user as any).verification || { isVerified: false },
                permissions: auth.permissions,
                hotel: hotelData,
            },
        });
    } catch (error) {
        console.error('Get current user error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب بيانات المستخدم' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(handler);

async function updateSettings(
    request: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        if (!auth.hotelId) {
            return NextResponse.json(
                { error: 'لا يمكن تحديث الإعدادات دون تحديد الفندق' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const validation = hotelSettingsSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const { hotelName, email, phone, settings, logo } = validation.data;

        const existingHotel = await Hotel.findOne({
            email,
            _id: { $ne: auth.hotelId },
        }).select('_id');

        if (existingHotel) {
            return NextResponse.json(
                { error: 'البريد الإلكتروني مستخدم مسبقًا' },
                { status: 409 }
            );
        }

        const updatedHotel = await Hotel.findByIdAndUpdate(
            auth.hotelId,
            {
                $set: {
                    name: hotelName,
                    email,
                    phone,
                    logo: logo ?? '',
                    settings: {
                        currency: settings.currency,
                        timezone: settings.timezone,
                        language: settings.language,
                        checkInTime: settings.checkInTime,
                        checkOutTime: settings.checkOutTime,
                        taxRate: settings.taxRate,
                        theme: settings.theme || 'dark',
                        notifications: {
                            newBooking: settings.notifications?.newBooking ?? true,
                            cancelledBooking: settings.notifications?.cancelledBooking ?? true,
                            paymentReceived: settings.notifications?.paymentReceived ?? true,
                            dailyReport: settings.notifications?.dailyReport ?? true,
                            subscriptionExpiry: settings.notifications?.subscriptionExpiry ?? true,
                        },
                    },
                },
            },
            { new: true }
        ).lean();

        if (!updatedHotel) {
            return NextResponse.json({ error: 'الفندق غير موجود' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: updatedHotel });
    } catch (error) {
        console.error('Update settings error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء حفظ الإعدادات' },
            { status: 500 }
        );
    }
}

export const PATCH = withPermission(PERMISSIONS.SETTINGS_UPDATE, updateSettings);
