import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Booking, Guest, Room } from '@/core/db/models';
import { withTenant, AuthContext } from '@/core/middleware/auth';

const getDayRange = (date: Date) => {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};

const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
};

async function handler(
    _request: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    _auth: AuthContext
) {
    try {
        await connectDB();

        const now = new Date();
        const { start: startOfDay, end: endOfDay } = getDayRange(now);
        const { start: startOfMonth, end: endOfMonth } = getMonthRange(now);
        const { start: startOfLastMonth, end: endOfLastMonth } = getMonthRange(
            new Date(now.getFullYear(), now.getMonth() - 1, 1)
        );

        const activeBookingFilter = { status: { $nin: ['cancelled', 'no_show'] } };

        const [
            totalRooms,
            availableRooms,
            occupiedRooms,
            pendingBookings,
            totalGuests,
            totalBookings,
            todayCheckIns,
            todayCheckOuts,
            specialRequestsToday,
            monthlyRevenueAgg,
            lastMonthRevenueAgg,
        ] = await Promise.all([
            Room.countDocuments({ isActive: true }),
            Room.countDocuments({ isActive: true, status: 'available' }),
            Room.countDocuments({ isActive: true, status: 'occupied' }),
            Booking.countDocuments({ status: 'pending' }),
            Guest.countDocuments({ isActive: true }),
            Booking.countDocuments(activeBookingFilter),
            Booking.countDocuments({
                ...activeBookingFilter,
                checkInDate: { $gte: startOfDay, $lte: endOfDay },
            }),
            Booking.countDocuments({
                ...activeBookingFilter,
                checkOutDate: { $gte: startOfDay, $lte: endOfDay },
            }),
            Booking.countDocuments({
                ...activeBookingFilter,
                checkInDate: { $gte: startOfDay, $lte: endOfDay },
                specialRequests: { $exists: true, $ne: '' },
            }),
            Booking.aggregate([
                {
                    $match: {
                        ...activeBookingFilter,
                        checkOutDate: { $gte: startOfMonth, $lt: endOfMonth },
                    },
                },
                { $group: { _id: null, total: { $sum: '$pricing.total' } } },
            ]),
            Booking.aggregate([
                {
                    $match: {
                        ...activeBookingFilter,
                        checkOutDate: { $gte: startOfLastMonth, $lt: endOfLastMonth },
                    },
                },
                { $group: { _id: null, total: { $sum: '$pricing.total' } } },
            ]),
        ]);

        const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;
        const lastMonthRevenue = lastMonthRevenueAgg[0]?.total || 0;

        return NextResponse.json({
            success: true,
            data: {
                totalRooms,
                availableRooms,
                occupiedRooms,
                todayCheckIns,
                todayCheckOuts,
                pendingBookings,
                totalGuests,
                totalBookings,
                specialRequestsToday,
                monthlyRevenue,
                lastMonthRevenue,
            },
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب بيانات لوحة التحكم' },
            { status: 500 }
        );
    }
}

export const GET = withTenant(handler);
