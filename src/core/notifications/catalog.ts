import type { HotelNotificationType } from '@/core/notifications/types';
import { HOTEL_NOTIFICATION_TYPES } from '@/core/notifications/types';

export type HotelNotificationCategory =
    | 'booking'
    | 'payment'
    | 'report'
    | 'subscription'
    | 'system';

export interface HotelNotificationView {
    id: string;
    type: HotelNotificationType;
    category: HotelNotificationCategory;
    message: string;
    createdAt: string;
    isRead: boolean;
    readAt: string | null;
    actionUrl: string | null;
}

const CATEGORY_BY_TYPE: Record<HotelNotificationType, HotelNotificationCategory> = {
    booking_new: 'booking',
    booking_cancelled: 'booking',
    payment_received: 'payment',
    daily_report: 'report',
    subscription_warning: 'subscription',
    subscription_grace_started: 'subscription',
    subscription_grace_final: 'subscription',
    subscription_suspended: 'subscription',
    subscription_renewal_requested: 'subscription',
    subscription_renewed: 'subscription',
};

const ACTION_BY_TYPE: Record<HotelNotificationType, string | null> = {
    booking_new: '/dashboard/bookings',
    booking_cancelled: '/dashboard/bookings',
    payment_received: '/dashboard/finance',
    daily_report: '/dashboard/reports',
    subscription_warning: '/dashboard/settings',
    subscription_grace_started: '/dashboard/settings',
    subscription_grace_final: '/dashboard/settings',
    subscription_suspended: '/dashboard/settings',
    subscription_renewal_requested: '/dashboard/settings',
    subscription_renewed: '/dashboard/settings',
};

interface NotificationLogEntryLike {
    _id?: unknown;
    type?: unknown;
    message?: unknown;
    createdAt?: unknown;
    isRead?: unknown;
    readAt?: unknown;
    actionUrl?: unknown;
}

function toIsoString(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function toNotificationType(value: unknown): HotelNotificationType | null {
    if (typeof value !== 'string') return null;
    if ((HOTEL_NOTIFICATION_TYPES as readonly string[]).includes(value)) {
        return value as HotelNotificationType;
    }
    return null;
}

function toNotificationId(value: unknown, fallback: string): string {
    if (!value) return fallback;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'toString' in value) {
        return (value as { toString: () => string }).toString();
    }
    return fallback;
}

export function getNotificationCategory(type: HotelNotificationType): HotelNotificationCategory {
    return CATEGORY_BY_TYPE[type] || 'system';
}

export function getNotificationActionUrl(type: HotelNotificationType): string | null {
    return ACTION_BY_TYPE[type] || null;
}

export function normalizeHotelNotification(
    input: NotificationLogEntryLike,
    index: number
): HotelNotificationView | null {
    const type = toNotificationType(input.type);
    if (!type) return null;

    const createdAt = toIsoString(input.createdAt) || new Date().toISOString();
    const id = toNotificationId(input._id, `${type}-${createdAt}-${index}`);
    const readAt = toIsoString(input.readAt);
    const isRead = typeof input.isRead === 'boolean' ? input.isRead : Boolean(readAt);
    const actionUrl =
        typeof input.actionUrl === 'string' && input.actionUrl.trim().length > 0
            ? input.actionUrl
            : getNotificationActionUrl(type);

    return {
        id,
        type,
        category: getNotificationCategory(type),
        message: typeof input.message === 'string' ? input.message : '',
        createdAt,
        isRead,
        readAt,
        actionUrl,
    };
}

export function normalizeHotelNotifications(
    entries: NotificationLogEntryLike[] | null | undefined
): HotelNotificationView[] {
    if (!Array.isArray(entries)) return [];

    return entries
        .map((entry, index) => normalizeHotelNotification(entry, index))
        .filter((item): item is HotelNotificationView => Boolean(item))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
