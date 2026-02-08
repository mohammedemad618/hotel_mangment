import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Booking } from '@/core/db/models';
import { withPermission, withTenant, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS, hasPermission, Permission } from '@/core/auth';
import { createTenantQuery } from '@/core/db/tenantMiddleware';
import mongoose from 'mongoose';

const allowedStatusTransitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['checked_in', 'cancelled', 'no_show'],
    checked_in: ['checked_out'],
    checked_out: [],
    cancelled: [],
    no_show: [],
};

const allowedPaymentMethods = ['cash', 'card', 'bank_transfer', 'online'];
const allowedPaymentStatuses = ['pending', 'partial', 'paid', 'refunded'];
const statusPermissionMap: Record<string, Permission> = {
    confirmed: PERMISSIONS.BOOKING_CONFIRM,
    cancelled: PERMISSIONS.BOOKING_CANCEL,
    checked_in: PERMISSIONS.BOOKING_CHECKIN,
    checked_out: PERMISSIONS.BOOKING_CHECKOUT,
    no_show: PERMISSIONS.BOOKING_CANCEL,
};

async function getBooking(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: 'معرف الحجز غير صالح' },
                { status: 400 }
            );
        }

        const tenantQuery = createTenantQuery(auth.hotelId!);
        const booking = await Booking.findOne(tenantQuery.filter({ _id: id }))
            .populate('roomId', 'roomNumber type floor')
            .populate('guestId', 'firstName lastName phone email')
            .lean();

        if (!booking) {
            return NextResponse.json(
                { error: 'الحجز غير موجود' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: booking });
    } catch (error) {
        console.error('Get booking error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب بيانات الحجز' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.BOOKING_READ, getBooking);

async function updateBooking(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: 'معرف الحجز غير صالح' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const tenantQuery = createTenantQuery(auth.hotelId!);

        const booking = await Booking.findOne(tenantQuery.filter({ _id: id }));
        if (!booking) {
            return NextResponse.json(
                { error: 'الحجز غير موجود' },
                { status: 404 }
            );
        }

        const canBookingUpdate = hasPermission(auth.role, auth.permissions, PERMISSIONS.BOOKING_UPDATE);
        const canPaymentCreate = hasPermission(auth.role, auth.permissions, PERMISSIONS.PAYMENT_CREATE);
        const canPaymentRefund = hasPermission(auth.role, auth.permissions, PERMISSIONS.PAYMENT_REFUND);

        const wantsNotesUpdate =
            Object.prototype.hasOwnProperty.call(body, 'notes') ||
            Object.prototype.hasOwnProperty.call(body, 'specialRequests');

        if (wantsNotesUpdate && !canBookingUpdate) {
            return NextResponse.json(
                { error: 'غير مصرح - لا تملك صلاحية تحديث بيانات الحجز' },
                { status: 403 }
            );
        }

        const updates: Record<string, any> = {};

        if (typeof body.notes === 'string' || body.notes === '') {
            updates.notes = body.notes || undefined;
        }
        if (typeof body.specialRequests === 'string' || body.specialRequests === '') {
            updates.specialRequests = body.specialRequests || undefined;
        }

        if (body.status) {
            const nextStatus = String(body.status);
            const currentStatus = booking.status;
            const allowed = allowedStatusTransitions[currentStatus] || [];
            if (!allowed.includes(nextStatus)) {
                return NextResponse.json(
                    { error: 'لا يمكن تغيير حالة الحجز إلى الحالة المطلوبة' },
                    { status: 400 }
                );
            }

            const requiredStatusPermission = statusPermissionMap[nextStatus];
            if (!canBookingUpdate && requiredStatusPermission && !hasPermission(auth.role, auth.permissions, requiredStatusPermission)) {
                return NextResponse.json(
                    { error: 'غير مصرح - لا تملك صلاحية تغيير حالة الحجز' },
                    { status: 403 }
                );
            }

            updates.status = nextStatus;
            if (nextStatus === 'checked_in' && !booking.actualCheckIn) {
                updates.actualCheckIn = new Date();
            }
            if (nextStatus === 'checked_out' && !booking.actualCheckOut) {
                updates.actualCheckOut = new Date();
            }
            if (nextStatus === 'cancelled') {
                updates.cancelledAt = new Date();
                if (typeof body.cancellationReason === 'string' && body.cancellationReason.trim()) {
                    updates.cancellationReason = body.cancellationReason.trim();
                }
            }
        }

        if (body.payment) {
            const wantsPaymentUpdate =
                !!body.payment.addPayment ||
                body.payment.paidAmount !== undefined ||
                !!body.payment.status;

            if (wantsPaymentUpdate && !canPaymentCreate) {
                return NextResponse.json(
                    { error: 'غير مصرح - لا تملك صلاحية تسجيل أو تعديل الدفعات' },
                    { status: 403 }
                );
            }

            if (body.payment.addPayment) {
                const amount = Number(body.payment.addPayment.amount);
                const method = String(body.payment.addPayment.method || '');
                const reference = body.payment.addPayment.reference?.toString().trim();

                if (!Number.isFinite(amount) || amount <= 0) {
                    return NextResponse.json(
                        { error: 'قيمة الدفعة غير صحيحة' },
                        { status: 400 }
                    );
                }
                if (!allowedPaymentMethods.includes(method)) {
                    return NextResponse.json(
                        { error: 'طريقة الدفع غير صالحة' },
                        { status: 400 }
                    );
                }

                booking.payment = booking.payment || { status: 'pending', paidAmount: 0, transactions: [] } as any;
                booking.payment.transactions = booking.payment.transactions || [];
                booking.payment.transactions.push({
                    amount,
                    method,
                    reference: reference || undefined,
                    date: new Date(),
                });
                booking.payment.paidAmount = (booking.payment.paidAmount || 0) + amount;

                const total = booking.pricing?.total || 0;
                if (booking.payment.paidAmount >= total && total > 0) {
                    booking.payment.status = 'paid';
                } else if (booking.payment.paidAmount > 0) {
                    booking.payment.status = 'partial';
                } else {
                    booking.payment.status = 'pending';
                }
            }

            if (body.payment.status) {
                const status = String(body.payment.status);
                if (!allowedPaymentStatuses.includes(status)) {
                    return NextResponse.json(
                        { error: 'حالة الدفع غير صالحة' },
                        { status: 400 }
                    );
                }
                if (status === 'refunded' && !canPaymentRefund) {
                    return NextResponse.json(
                        { error: 'غير مصرح - لا تملك صلاحية استرداد الدفعات' },
                        { status: 403 }
                    );
                }
                booking.payment = booking.payment || { status: 'pending', paidAmount: 0, transactions: [] } as any;
                booking.payment.status = status as any;
            }

            if (body.payment.paidAmount !== undefined) {
                const paidAmount = Number(body.payment.paidAmount);
                if (!Number.isFinite(paidAmount) || paidAmount < 0) {
                    return NextResponse.json(
                        { error: 'المبلغ المدفوع غير صالح' },
                        { status: 400 }
                    );
                }
                booking.payment = booking.payment || { status: 'pending', paidAmount: 0, transactions: [] } as any;
                booking.payment.paidAmount = paidAmount;

                if (!body.payment.status) {
                    const total = booking.pricing?.total || 0;
                    if (booking.payment.paidAmount >= total && total > 0) {
                        booking.payment.status = 'paid';
                    } else if (booking.payment.paidAmount > 0) {
                        booking.payment.status = 'partial';
                    } else {
                        booking.payment.status = 'pending';
                    }
                }
            }
        }

        Object.keys(updates).forEach((key) => {
            booking.set(key, updates[key]);
        });

        await booking.save();

        const updatedBooking = await Booking.findOne(tenantQuery.filter({ _id: id }))
            .populate('roomId', 'roomNumber type floor')
            .populate('guestId', 'firstName lastName phone email')
            .lean();

        return NextResponse.json({ success: true, data: updatedBooking });
    } catch (error) {
        console.error('Update booking error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء تحديث الحجز' },
            { status: 500 }
        );
    }
}

export const PUT = withTenant(updateBooking);
