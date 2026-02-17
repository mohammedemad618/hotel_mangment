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
        await Hotel.updateMany(
            { _id: { $in: idsToUpdate } },
            {
                $set: {
                    'subscription.status': 'suspended',
                    isActive: false,
                },
            }
        );
    }

    return {
        cutoffDate: cutoffDate.toISOString(),
        scannedOverdue: overdueHotels.length,
        updatedCount: idsToUpdate.length,
        affectedIds: idsToUpdate.map((id) => id.toString()),
    };
}
