import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Hotel } from '@/core/db/models';
import { withAuth, AuthContext } from '@/core/middleware/auth';
import {
    normalizeHotelNotifications,
    type HotelNotificationCategory,
} from '@/core/notifications/catalog';

type NotificationStatusFilter = 'all' | 'read' | 'unread';
type NotificationCategoryFilter = 'all' | HotelNotificationCategory;

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function parseLimit(value: string | null): number {
    const parsed = Number.parseInt(value || String(DEFAULT_LIMIT), 10);
    if (Number.isNaN(parsed)) return DEFAULT_LIMIT;
    return Math.max(1, Math.min(parsed, MAX_LIMIT));
}

function parseStatus(value: string | null): NotificationStatusFilter {
    if (value === 'read' || value === 'unread') return value;
    return 'all';
}

function parseCategory(value: string | null): NotificationCategoryFilter {
    if (!value || value === 'all') return 'all';
    if (value === 'booking' || value === 'payment' || value === 'report' || value === 'subscription' || value === 'system') {
        return value;
    }
    return 'all';
}

async function listNotifications(
    request: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        if (!auth.hotelId) {
            return NextResponse.json(
                { error: 'Hotel context is required' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = parseStatus(searchParams.get('status'));
        const category = parseCategory(searchParams.get('category'));
        const limit = parseLimit(searchParams.get('limit'));

        const hotel = await Hotel.findById(auth.hotelId)
            .select('notificationsLog')
            .lean();

        if (!hotel) {
            return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
        }

        const allNotifications = normalizeHotelNotifications((hotel as any).notificationsLog);

        const filtered = allNotifications.filter((item) => {
            if (status === 'read' && !item.isRead) return false;
            if (status === 'unread' && item.isRead) return false;
            if (category !== 'all' && item.category !== category) return false;
            return true;
        });

        const data = filtered.slice(0, limit);
        const unreadByCategory: Record<HotelNotificationCategory, number> = {
            booking: 0,
            payment: 0,
            report: 0,
            subscription: 0,
            system: 0,
        };

        allNotifications.forEach((item) => {
            if (!item.isRead) unreadByCategory[item.category] += 1;
        });

        return NextResponse.json({
            success: true,
            summary: {
                total: allNotifications.length,
                unread: allNotifications.filter((item) => !item.isRead).length,
                unreadByCategory,
            },
            filters: {
                status,
                category,
                limit,
            },
            data,
        });
    } catch (error) {
        console.error('List notifications error:', error);
        return NextResponse.json(
            { error: 'Failed to load notifications' },
            { status: 500 }
        );
    }
}

async function updateNotifications(
    request: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        if (!auth.hotelId) {
            return NextResponse.json(
                { error: 'Hotel context is required' },
                { status: 403 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const action = body?.action || 'mark_all_read';
        if (action !== 'mark_all_read') {
            return NextResponse.json(
                { error: 'Unsupported notifications action' },
                { status: 400 }
            );
        }

        const now = new Date();
        await Hotel.updateOne(
            { _id: auth.hotelId },
            {
                $set: {
                    'notificationsLog.$[item].isRead': true,
                    'notificationsLog.$[item].readAt': now,
                },
            },
            {
                arrayFilters: [{ 'item.isRead': { $ne: true } }],
            }
        );

        return NextResponse.json({
            success: true,
            message: 'All notifications marked as read',
        });
    } catch (error) {
        console.error('Update notifications error:', error);
        return NextResponse.json(
            { error: 'Failed to update notifications' },
            { status: 500 }
        );
    }
}

export const GET = withAuth(listNotifications);
export const PATCH = withAuth(updateNotifications);
