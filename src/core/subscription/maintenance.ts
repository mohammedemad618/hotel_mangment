import { Types } from 'mongoose';
import { Hotel } from '@/core/db/models';
import { addDays, SUBSCRIPTION_GRACE_DAYS } from '@/core/subscription/policy';

interface HotelMaintenanceSnapshot {
    _id: Types.ObjectId | string;
    isActive?: boolean | null;
    subscription?: {
        status?: string | null;
    } | null;
}

export interface SubscriptionMaintenanceResult {
    cutoffDate: string;
    scannedOverdue: number;
    updatedCount: number;
    affectedIds: string[];
}

const MAX_NOTIFICATION_LOG_ITEMS = 50;

const SUSPENSION_MESSAGE =
    'تم تعليق اشتراك الفندق تلقائيًا بعد انتهاء مهلة السماح. يرجى السداد وتجديد الاشتراك لإعادة تفعيل الحساب.';

async function suspendHotelWithNotification(hotelId: Types.ObjectId | string, now: Date): Promise<boolean> {
    const result = await Hotel.updateOne(
        {
            _id: hotelId,
            $or: [
                { 'subscription.status': { $ne: 'suspended' } },
                { isActive: { $ne: false } },
            ],
            notificationsLog: {
                $not: {
                    $elemMatch: {
                        type: 'subscription_suspended',
                        message: SUSPENSION_MESSAGE,
                    },
                },
            },
        },
        {
            $set: {
                'subscription.status': 'suspended',
                isActive: false,
            },
            $push: {
                notificationsLog: {
                    $each: [
                        {
                            type: 'subscription_suspended',
                            message: SUSPENSION_MESSAGE,
                            createdAt: now,
                            isRead: false,
                            readAt: null,
                            actionUrl: '/dashboard/settings',
                        },
                    ],
                    $slice: -MAX_NOTIFICATION_LOG_ITEMS,
                },
            },
        }
    );

    return result.modifiedCount > 0;
}

export async function runSubscriptionMaintenance(
    scopedFilter: Record<string, unknown>,
    now: Date = new Date()
): Promise<SubscriptionMaintenanceResult> {
    const cutoffDate = addDays(now, -SUBSCRIPTION_GRACE_DAYS);
    const overdueHotels = await Hotel.find({
        ...scopedFilter,
        'subscription.endDate': { $ne: null, $lt: cutoffDate },
        'subscription.status': { $ne: 'cancelled' },
    })
        .select('_id isActive subscription.status')
        .lean<HotelMaintenanceSnapshot[]>();

    const idsToUpdate = overdueHotels
        .filter((hotel) => hotel.subscription?.status !== 'suspended' || Boolean(hotel.isActive))
        .map((hotel) => hotel._id);

    if (idsToUpdate.length > 0) {
        const writes = idsToUpdate.map((hotelId) => suspendHotelWithNotification(hotelId, now));
        await Promise.all(writes);
    }

    return {
        cutoffDate: cutoffDate.toISOString(),
        scannedOverdue: overdueHotels.length,
        updatedCount: idsToUpdate.length,
        affectedIds: idsToUpdate.map((id) => id.toString()),
    };
}
