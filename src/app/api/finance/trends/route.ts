import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Booking } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';

const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

async function handler(
    request: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    _auth: AuthContext
) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const monthsParam = parseInt(searchParams.get('months') || '6', 10);
        const months = Math.min(Math.max(monthsParam, 3), 24);

        const now = new Date();
        const endMonthStart = getMonthStart(now);
        const startMonth = new Date(endMonthStart.getFullYear(), endMonthStart.getMonth() - (months - 1), 1);
        const endMonth = new Date(endMonthStart.getFullYear(), endMonthStart.getMonth() + 1, 1);

        const activeBookingFilter = { status: { $nin: ['cancelled', 'no_show'] } };

        const aggregates = await Booking.aggregate([
            {
                $match: {
                    ...activeBookingFilter,
                    checkOutDate: { $gte: startMonth, $lt: endMonth },
                },
            },
            {
                $group: {
                    _id: { year: { $year: '$checkOutDate' }, month: { $month: '$checkOutDate' } },
                    revenue: { $sum: '$pricing.total' },
                    paid: { $sum: { $ifNull: ['$payment.paidAmount', 0] } },
                    bookings: { $sum: 1 },
                    outstanding: {
                        $sum: {
                            $cond: [
                                {
                                    $gt: [
                                        {
                                            $subtract: [
                                                '$pricing.total',
                                                { $ifNull: ['$payment.paidAmount', 0] },
                                            ],
                                        },
                                        0,
                                    ],
                                },
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
            },
        ]);

        const aggregateMap = new Map<string, { revenue: number; paid: number; outstanding: number; bookings: number }>();
        aggregates.forEach((item) => {
            const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
            aggregateMap.set(key, {
                revenue: item.revenue || 0,
                paid: item.paid || 0,
                outstanding: item.outstanding || 0,
                bookings: item.bookings || 0,
            });
        });

        const data = Array.from({ length: months }).map((_, index) => {
            const current = new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1);
            const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
            const entry = aggregateMap.get(key);
            return {
                month: key,
                revenue: entry?.revenue || 0,
                paid: entry?.paid || 0,
                outstanding: entry?.outstanding || 0,
                bookings: entry?.bookings || 0,
            };
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Finance trends error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب التقارير الشهرية' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.REPORT_VIEW, handler);
