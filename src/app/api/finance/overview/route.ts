import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Booking } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';

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
        const { start: startOfMonth, end: endOfMonth } = getMonthRange(now);
        const { start: startOfLastMonth, end: endOfLastMonth } = getMonthRange(
            new Date(now.getFullYear(), now.getMonth() - 1, 1)
        );

        const activeBookingFilter = { status: { $nin: ['cancelled', 'no_show'] } };

        const [
            monthAgg,
            lastMonthAgg,
            outstandingAgg,
            statusAgg,
            totalBookings,
            recentPaymentBookings,
        ] = await Promise.all([
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
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: '$pricing.total' },
                    },
                },
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
                { $match: activeBookingFilter },
                {
                    $group: {
                        _id: { $ifNull: ['$payment.status', 'pending'] },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Booking.countDocuments(activeBookingFilter),
            Booking.find({
                ...activeBookingFilter,
                'payment.transactions.0': { $exists: true },
            })
                .select('bookingNumber payment roomId guestId updatedAt')
                .populate('roomId', 'roomNumber')
                .populate('guestId', 'firstName lastName')
                .sort({ updatedAt: -1 })
                .limit(8)
                .lean(),
        ]);

        const monthRevenue = monthAgg[0]?.revenue || 0;
        const monthPaid = monthAgg[0]?.paid || 0;
        const lastMonthRevenue = lastMonthAgg[0]?.revenue || 0;
        const outstandingBalance = outstandingAgg[0]?.total || 0;

        const paymentStatusSummary: Record<string, number> = {
            paid: 0,
            partial: 0,
            pending: 0,
            refunded: 0,
        };

        statusAgg.forEach((entry) => {
            const status = String(entry._id || 'pending');
            if (paymentStatusSummary[status] !== undefined) {
                paymentStatusSummary[status] = entry.count;
            }
        });

        const recentPayments = recentPaymentBookings.map((booking: any) => {
            const transactions = booking.payment?.transactions || [];
            const latest = transactions[transactions.length - 1];
            const guest = booking.guestId
                ? `${booking.guestId.firstName || ''} ${booking.guestId.lastName || ''}`.trim()
                : '';
            return {
                bookingId: booking._id?.toString(),
                bookingNumber: booking.bookingNumber,
                roomNumber: booking.roomId?.roomNumber || '',
                guestName: guest || 'غير محدد',
                amount: latest?.amount ?? booking.payment?.paidAmount ?? 0,
                method: latest?.method || booking.payment?.method || 'cash',
                date: (latest?.date || booking.updatedAt || new Date()).toISOString(),
                status: booking.payment?.status || 'pending',
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    monthRevenue,
                    lastMonthRevenue,
                    monthPaid,
                    outstandingBalance,
                    totalBookings,
                    paidBookings: paymentStatusSummary.paid,
                    partialBookings: paymentStatusSummary.partial,
                    pendingBookings: paymentStatusSummary.pending,
                    refundedBookings: paymentStatusSummary.refunded,
                },
                recentPayments,
            },
        });
    } catch (error) {
        console.error('Finance overview error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب البيانات المالية' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.REPORT_VIEW, handler);
