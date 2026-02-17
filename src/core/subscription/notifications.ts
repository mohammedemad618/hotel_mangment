import { Types } from 'mongoose';
import { Hotel } from '@/core/db/models';
import type { SubscriptionHotelNotificationType } from '@/core/notifications/types';
import {
    SUBSCRIPTION_GRACE_DAYS,
    SUBSCRIPTION_WARNING_DAYS,
    getSubscriptionTimeline,
} from '@/core/subscription/policy';

const MAX_NOTIFICATION_LOG_ITEMS = 50;

interface HotelSubscriptionSnapshot {
    _id: Types.ObjectId | string;
    name: string;
    subscription?: {
        status?: string | null;
        endDate?: Date | string | null;
    } | null;
    settings?: {
        notifications?: {
            subscriptionExpiry?: boolean;
        } | null;
    } | null;
}

export interface SubscriptionNotificationSweepResult {
    scannedHotels: number;
    warningQueued: number;
    graceStartedQueued: number;
    graceFinalQueued: number;
    totalQueued: number;
}

function formatDateForMessage(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function buildWarningMessage(endDate: Date): string {
    return `تنبيه اشتراك: سينتهي اشتراك الفندق بتاريخ ${formatDateForMessage(endDate)}. يرجى التجديد قبل الانتهاء لتجنب تعليق الحساب.`;
}

function buildGraceStartedMessage(graceEndDate: Date): string {
    return `دخل اشتراك الفندق في مهلة السماح. آخر يوم للسداد هو ${formatDateForMessage(graceEndDate)}.`;
}

function buildGraceFinalMessage(graceEndDate: Date): string {
    return `تنبيه نهائي للاشتراك: آخر يوم في مهلة السماح هو ${formatDateForMessage(graceEndDate)}. سيتم إيقاف الحساب تلقائيًا عند انتهاء اليوم إذا لم يتم السداد.`;
}

async function pushNotificationIfMissing(params: {
    hotelId: Types.ObjectId | string;
    type: SubscriptionHotelNotificationType;
    message: string;
    createdAt: Date;
    actionUrl?: string | null;
}): Promise<boolean> {
    const result = await Hotel.updateOne(
        {
            _id: params.hotelId,
            notificationsLog: {
                $not: {
                    $elemMatch: {
                        type: params.type,
                        message: params.message,
                    },
                },
            },
        },
        {
            $push: {
                notificationsLog: {
                    $each: [
                        {
                            type: params.type,
                            message: params.message,
                            createdAt: params.createdAt,
                            isRead: false,
                            readAt: null,
                            actionUrl: params.actionUrl || '/dashboard/settings',
                        },
                    ],
                    $slice: -MAX_NOTIFICATION_LOG_ITEMS,
                },
            },
        }
    );

    return result.modifiedCount > 0;
}

export async function runSubscriptionNotificationSweep(
    scopedFilter: Record<string, unknown>,
    now: Date = new Date()
): Promise<SubscriptionNotificationSweepResult> {
    const hotels = await Hotel.find({
        ...scopedFilter,
        'subscription.endDate': { $ne: null },
        'subscription.status': { $nin: ['cancelled'] },
    })
        .select('_id name subscription.status subscription.endDate settings.notifications.subscriptionExpiry')
        .lean<HotelSubscriptionSnapshot[]>();

    const counters = {
        warningQueued: 0,
        graceStartedQueued: 0,
        graceFinalQueued: 0,
    };

    const writes: Promise<void>[] = [];
    for (const hotel of hotels) {
        const subscriptionExpiryEnabled = hotel.settings?.notifications?.subscriptionExpiry ?? true;
        if (!subscriptionExpiryEnabled) continue;

        if (hotel.subscription?.status === 'suspended') continue;

        const timeline = getSubscriptionTimeline(
            hotel.subscription?.endDate || null,
            now,
            SUBSCRIPTION_WARNING_DAYS,
            SUBSCRIPTION_GRACE_DAYS
        );

        if (!timeline.hasEndDate || !timeline.endDate) continue;

        if (timeline.isWarningWindow && !timeline.isInGracePeriod && !timeline.isBeyondGracePeriod) {
            writes.push(
                pushNotificationIfMissing({
                    hotelId: hotel._id,
                    type: 'subscription_warning',
                    message: buildWarningMessage(timeline.endDate),
                    createdAt: now,
                    actionUrl: '/dashboard/settings',
                }).then((created) => {
                    if (created) counters.warningQueued += 1;
                })
            );
        }

        if (
            timeline.isInGracePeriod &&
            timeline.graceEndDate &&
            timeline.daysUntilSuspension !== null &&
            timeline.daysUntilSuspension > 1
        ) {
            writes.push(
                pushNotificationIfMissing({
                    hotelId: hotel._id,
                    type: 'subscription_grace_started',
                    message: buildGraceStartedMessage(timeline.graceEndDate),
                    createdAt: now,
                    actionUrl: '/dashboard/settings',
                }).then((created) => {
                    if (created) counters.graceStartedQueued += 1;
                })
            );
        }

        if (
            timeline.isInGracePeriod &&
            timeline.graceEndDate &&
            timeline.daysUntilSuspension !== null &&
            timeline.daysUntilSuspension <= 1
        ) {
            writes.push(
                pushNotificationIfMissing({
                    hotelId: hotel._id,
                    type: 'subscription_grace_final',
                    message: buildGraceFinalMessage(timeline.graceEndDate),
                    createdAt: now,
                    actionUrl: '/dashboard/settings',
                }).then((created) => {
                    if (created) counters.graceFinalQueued += 1;
                })
            );
        }
    }

    if (writes.length > 0) {
        await Promise.all(writes);
    }

    return {
        scannedHotels: hotels.length,
        warningQueued: counters.warningQueued,
        graceStartedQueued: counters.graceStartedQueued,
        graceFinalQueued: counters.graceFinalQueued,
        totalQueued:
            counters.warningQueued + counters.graceStartedQueued + counters.graceFinalQueued,
    };
}
