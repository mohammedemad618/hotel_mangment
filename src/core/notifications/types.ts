export const HOTEL_NOTIFICATION_TYPES = [
    'booking_new',
    'booking_cancelled',
    'payment_received',
    'daily_report',
    'subscription_warning',
    'subscription_grace_final',
] as const;

export type HotelNotificationType = (typeof HOTEL_NOTIFICATION_TYPES)[number];
export type SubscriptionHotelNotificationType = Extract<
    HotelNotificationType,
    'subscription_warning' | 'subscription_grace_final'
>;
