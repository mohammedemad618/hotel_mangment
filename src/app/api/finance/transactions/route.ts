import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Booking } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';

const toDateEnd = (value: string) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    date.setHours(23, 59, 59, 999);
    return date;
};

async function handler(
    request: NextRequest,
    _context: { params: Promise<Record<string, string>> },
    _auth: AuthContext
) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 50);
        const status = searchParams.get('status');
        const method = searchParams.get('method');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        const filter: Record<string, any> = {
            status: { $nin: ['cancelled', 'no_show'] },
        };

        if (status) {
            filter['payment.status'] = status;
        }

        if (method) {
            filter.$or = [
                { 'payment.method': method },
                { 'payment.transactions.method': method },
            ];
        }

        if (fromDate || toDate) {
            const range: Record<string, Date> = {};
            if (fromDate) {
                const from = new Date(fromDate);
                if (Number.isFinite(from.getTime())) {
                    range.$gte = from;
                }
            }
            if (toDate) {
                const to = toDateEnd(toDate);
                if (to) {
                    range.$lte = to;
                }
            }
            if (Object.keys(range).length > 0) {
                filter.createdAt = range;
            }
        }

        const [bookings, total, summaryAgg] = await Promise.all([
            Booking.find(filter)
                .populate('roomId', 'roomNumber')
                .populate('guestId', 'firstName lastName')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Booking.countDocuments(filter),
            Booking.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        totalAmount: { $sum: '$pricing.total' },
                        totalPaid: { $sum: { $ifNull: ['$payment.paidAmount', 0] } },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const summary = summaryAgg[0] || { totalAmount: 0, totalPaid: 0, count: 0 };
        const totalOutstanding = Math.max(summary.totalAmount - summary.totalPaid, 0);

        const data = bookings.map((booking: any) => {
            const totalAmount = booking.pricing?.total || 0;
            const paidAmount = booking.payment?.paidAmount || 0;
            const remaining = Math.max(totalAmount - paidAmount, 0);
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
                total: totalAmount,
                paidAmount,
                remaining,
                latestAmount: latest?.amount ?? 0,
                method: latest?.method || booking.payment?.method || 'cash',
                date: (latest?.date || booking.updatedAt || booking.createdAt || new Date()).toISOString(),
                status: booking.payment?.status || 'pending',
            };
        });

        return NextResponse.json({
            success: true,
            data,
            summary: {
                totalAmount: summary.totalAmount || 0,
                totalPaid: summary.totalPaid || 0,
                totalOutstanding,
                count: summary.count || 0,
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Finance transactions error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب حركة المالية' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.REPORT_VIEW, handler);
