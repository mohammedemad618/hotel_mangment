'use client';

import { createContext, useContext } from 'react';
import type { HotelNotificationType } from '@/core/notifications/types';
import type { HotelNotificationCategory } from '@/core/notifications/catalog';

export interface HotelSettings {
    currency: string;
    timezone: string;
    language: 'ar' | 'en';
    checkInTime: string;
    checkOutTime: string;
    taxRate: number;
    theme?: 'light' | 'dark' | 'system';
    notifications?: {
        newBooking: boolean;
        cancelledBooking: boolean;
        paymentReceived: boolean;
        dailyReport: boolean;
        subscriptionExpiry?: boolean;
    };
}

export interface HotelProfile {
    name?: string;
    email?: string;
    phone?: string;
    logo?: string;
    address?: {
        street?: string;
        city?: string;
        country?: string;
        postalCode?: string;
    };
}

export interface HotelNotification {
    id: string;
    type: HotelNotificationType;
    category: HotelNotificationCategory;
    message: string;
    createdAt: string;
    isRead: boolean;
    readAt: string | null;
    actionUrl: string | null;
}

export interface HotelSettingsContextValue {
    settings: HotelSettings | null;
    setSettings: (next: HotelSettings | null) => void;
    notifications: HotelNotification[];
    setNotifications: (
        next: HotelNotification[] | ((prev: HotelNotification[]) => HotelNotification[])
    ) => void;
    hotelProfile: HotelProfile | null;
    setHotelProfile: (next: HotelProfile | null) => void;
}

export const HotelSettingsContext = createContext<HotelSettingsContextValue>({
    settings: null,
    setSettings: () => {},
    notifications: [],
    setNotifications: () => {},
    hotelProfile: null,
    setHotelProfile: () => {},
});

export function useHotelSettings(): HotelSettingsContextValue {
    return useContext(HotelSettingsContext);
}
