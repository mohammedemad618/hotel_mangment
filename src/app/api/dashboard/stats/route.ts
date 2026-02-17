import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Booking, Guest, Room } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';

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

const percent = (value: number, total: number): number => {
    if (total <= 0) return 0;
    return Math.round((value / total) * 100);
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
            monthRevenueAgg,
            lastMonthRevenueAgg,
            outstandingAgg,
            overdueAgg,
            directShareAgg,
        ] = await Promise.all([
            Room.countDocuments({ isActive: true }),
            Room.countDocuments({ isActive: true, status: 'available' }),
            Room.countDocuments({ isActive: true, status: 'occupied' }),
            Booking.countDocuments({ status: 'pending' }),
            Guest.countDocuments({}),
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
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$pricing.total' },
                        paid: { $sum: { $ifNull: ['$payment.paidAmount', 0] } },
                    },
                },
            ]),
            Booking.aggregate([
                {
                    $match: {
                        ...activeBookingFilter,
                        checkOutDate: { $gte: startOfLastMonth, $lt: endOfLastMonth },
                    },
                },
                { $group: { _id: null, revenue: { $sum: '$pricing.total' } } },
            ]),
            Booking.aggregate([
                { $match: activeBookingFilter },
                {
                    $project: {
                        remaining: {
                            $max: [
                                {
                                    $subtract: [
                                        '$pricing.total',
                                        { $ifNull: ['$payment.paidAmount', 0] },
                                    ],
                                },
                                0,
                            ],
                        },
                    },
                },
                { $group: { _id: null, total: { $sum: '$remaining' } } },
            ]),
            Booking.aggregate([
                {
                    $match: {
                        ...activeBookingFilter,
                        checkOutDate: { $lt: now },
                    },
                },
                {
                    $project: {
                        remaining: {
                            $max: [
                                {
                                    $subtract: [
                                        '$pricing.total',
                                        { $ifNull: ['$payment.paidAmount', 0] },
                                    ],
                                },
                                0,
                            ],
                        },
                    },
                },
                { $match: { remaining: { $gt: 0 } } },
                { $count: 'count' },
            ]),
            Booking.aggregate([
                {
                    $match: {
                        ...activeBookingFilter,
                        checkInDate: { $gte: startOfMonth, $lt: endOfMonth },
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        direct: {
                            $sum: {
                                $cond: [{ $eq: ['$source', 'direct'] }, 1, 0],
                            },
                        },
                    },
                },
            ]),
        ]);

        const monthlyRevenue = monthRevenueAgg[0]?.revenue || 0;
        const monthPaid = monthRevenueAgg[0]?.paid || 0;
        const lastMonthRevenue = lastMonthRevenueAgg[0]?.revenue || 0;
        const outstandingBalance = outstandingAgg[0]?.total || 0;
        const overduePayments = overdueAgg[0]?.count || 0;
        const directBookings = directShareAgg[0]?.direct || 0;
        const totalMonthlyBookings = directShareAgg[0]?.total || 0;

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
                outstandingBalance,
                overduePayments,
                occupancyRate: percent(occupiedRooms, totalRooms),
                collectionRate: percent(monthPaid, monthlyRevenue),
                directChannelShare: percent(directBookings, totalMonthlyBookings),
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

export const GET = withPermission(PERMISSIONS.REPORT_VIEW, handler);
