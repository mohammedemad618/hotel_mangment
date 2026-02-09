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
                { error: 'Invalid booking ID' },
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
                { error: 'Booking not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: booking });
    } catch (error) {
        console.error('Get booking error:', error);
        return NextResponse.json(
            { error: 'Failed to load booking details' },
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
                { error: 'Invalid booking ID' },
                { status: 400 }
            );
        }

        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON body' },
                { status: 400 }
            );
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            );
        }

        const canBookingRead = hasPermission(auth.role, auth.permissions, PERMISSIONS.BOOKING_READ);
        const canBookingUpdate = hasPermission(auth.role, auth.permissions, PERMISSIONS.BOOKING_UPDATE);
        const canPaymentCreate = hasPermission(auth.role, auth.permissions, PERMISSIONS.PAYMENT_CREATE);
        const canPaymentRefund = hasPermission(auth.role, auth.permissions, PERMISSIONS.PAYMENT_REFUND);
        const canStatusTransition = Array.from(new Set(Object.values(statusPermissionMap)))
            .some((permission) => hasPermission(auth.role, auth.permissions, permission));

        if (!canBookingUpdate && !canPaymentCreate && !canPaymentRefund && !canStatusTransition) {
            return NextResponse.json(
                { error: 'Forbidden - missing update permissions' },
                { status: 403 }
            );
        }

        const hasKnownUpdateField =
            Object.prototype.hasOwnProperty.call(body, 'notes') ||
            Object.prototype.hasOwnProperty.call(body, 'specialRequests') ||
            Object.prototype.hasOwnProperty.call(body, 'status') ||
            Object.prototype.hasOwnProperty.call(body, 'payment');

        if (!hasKnownUpdateField) {
            return NextResponse.json(
                { error: 'No valid update fields provided' },
                { status: 400 }
            );
        }

        const tenantQuery = createTenantQuery(auth.hotelId!);
        const booking = await Booking.findOne(tenantQuery.filter({ _id: id }));
        if (!booking) {
            return NextResponse.json(
                { error: 'Booking not found' },
                { status: 404 }
            );
        }

        const wantsNotesUpdate =
            Object.prototype.hasOwnProperty.call(body, 'notes') ||
            Object.prototype.hasOwnProperty.call(body, 'specialRequests');

        if (wantsNotesUpdate && !canBookingUpdate) {
            return NextResponse.json(
                { error: 'Forbidden - missing booking update permission' },
                { status: 403 }
            );
        }

        const updates: Record<string, any> = {};
        let paymentUpdated = false;

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
                    { error: 'Invalid booking status transition' },
                    { status: 400 }
                );
            }

            const requiredStatusPermission = statusPermissionMap[nextStatus];
            if (!canBookingUpdate && requiredStatusPermission && !hasPermission(auth.role, auth.permissions, requiredStatusPermission)) {
                return NextResponse.json(
                    { error: 'Forbidden - missing status transition permission' },
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

        if (body.payment !== undefined) {
            if (!body.payment || typeof body.payment !== 'object' || Array.isArray(body.payment)) {
                return NextResponse.json(
                    { error: 'Invalid payment payload' },
                    { status: 400 }
                );
            }

            const wantsPaymentUpdate =
                !!body.payment.addPayment ||
                body.payment.paidAmount !== undefined ||
                !!body.payment.status;

            if (wantsPaymentUpdate && !canPaymentCreate) {
                return NextResponse.json(
                    { error: 'Forbidden - missing payment update permission' },
                    { status: 403 }
                );
            }

            if (body.payment.addPayment) {
                const amount = Number(body.payment.addPayment.amount);
                const method = String(body.payment.addPayment.method || '');
                const reference = body.payment.addPayment.reference?.toString().trim();

                if (!Number.isFinite(amount) || amount <= 0) {
                    return NextResponse.json(
                        { error: 'Invalid payment amount' },
                        { status: 400 }
                    );
                }
                if (!allowedPaymentMethods.includes(method)) {
                    return NextResponse.json(
                        { error: 'Invalid payment method' },
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
                paymentUpdated = true;

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
                        { error: 'Invalid payment status' },
                        { status: 400 }
                    );
                }
                if (status === 'refunded' && !canPaymentRefund) {
                    return NextResponse.json(
                        { error: 'Forbidden - missing payment refund permission' },
                        { status: 403 }
                    );
                }
                booking.payment = booking.payment || { status: 'pending', paidAmount: 0, transactions: [] } as any;
                booking.payment.status = status as any;
                paymentUpdated = true;
            }

            if (body.payment.paidAmount !== undefined) {
                const paidAmount = Number(body.payment.paidAmount);
                if (!Number.isFinite(paidAmount) || paidAmount < 0) {
                    return NextResponse.json(
                        { error: 'Invalid paid amount' },
                        { status: 400 }
                    );
                }
                booking.payment = booking.payment || { status: 'pending', paidAmount: 0, transactions: [] } as any;
                booking.payment.paidAmount = paidAmount;
                paymentUpdated = true;

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

        if (Object.keys(updates).length === 0 && !paymentUpdated) {
            return NextResponse.json(
                { error: 'No applicable changes to update' },
                { status: 400 }
            );
        }

        Object.keys(updates).forEach((key) => {
            booking.set(key, updates[key]);
        });

        await booking.save();

        if (!canBookingRead) {
            return NextResponse.json({ success: true });
        }

        const updatedBooking = await Booking.findOne(tenantQuery.filter({ _id: id }))
            .populate('roomId', 'roomNumber type floor')
            .populate('guestId', 'firstName lastName phone email')
            .lean();

        return NextResponse.json({ success: true, data: updatedBooking });
    } catch (error) {
        console.error('Update booking error:', error);
        return NextResponse.json(
            { error: 'Failed to update booking' },
            { status: 500 }
        );
    }
}

export const PUT = withTenant(updateBooking);
