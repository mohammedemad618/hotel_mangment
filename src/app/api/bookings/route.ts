import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Booking, Room, Guest, Hotel } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';
import { createBookingSchema } from '@/lib/validations';
import { createTenantQuery } from '@/core/db/tenantMiddleware';
import mongoose from 'mongoose';

// GET: List bookings
async function listBookings(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
        const status = searchParams.get('status');
        const paymentStatus = searchParams.get('paymentStatus');
        const fromDate = searchParams.get('fromDate');
        const toDate = searchParams.get('toDate');

        const tenantQuery = createTenantQuery(auth.hotelId!);
        const filter: Record<string, any> = tenantQuery.filter({});

        if (status) filter.status = status;
        if (paymentStatus) filter['payment.status'] = paymentStatus;
        if (fromDate) filter.checkInDate = { $gte: new Date(fromDate) };
        if (toDate) {
            filter.checkOutDate = filter.checkOutDate || {};
            filter.checkOutDate.$lte = new Date(toDate);
        }

        const [bookings, total] = await Promise.all([
            Booking.find(filter)
                .populate('roomId', 'roomNumber type floor')
                .populate('guestId', 'firstName lastName phone email')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Booking.countDocuments(filter),
        ]);

        return NextResponse.json({
            success: true,
            data: bookings,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });

    } catch (error) {
        console.error('List bookings error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب الحجوزات' },
            { status: 500 }
        );
    }
}

// POST: Create booking
async function createBooking(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const body = await request.json();
        const validation = createBookingSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const { roomId, guestId, checkInDate, checkOutDate, numberOfGuests, source, specialRequests, notes } = validation.data;
        const tenantQuery = createTenantQuery(auth.hotelId!);

        if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(guestId)) {
            return NextResponse.json(
                { error: 'بيانات الغرفة أو النزيل غير صحيحة' },
                { status: 400 }
            );
        }

        const hotel = await Hotel.findById(auth.hotelId).select('settings').lean();
        if (!hotel) {
            return NextResponse.json(
                { error: 'الفندق غير موجود' },
                { status: 404 }
            );
        }

        const applyTimeToDate = (date: Date, time: string) => {
            const [hours, minutes] = time.split(':').map((value) => Number(value));
            const result = new Date(date);
            if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
                result.setHours(hours, minutes, 0, 0);
            }
            return result;
        };

        const checkInTime = hotel.settings?.checkInTime || '14:00';
        const checkOutTime = hotel.settings?.checkOutTime || '12:00';
        const taxRate = typeof hotel.settings?.taxRate === 'number' ? hotel.settings.taxRate : 15;
        const checkInDateTime = applyTimeToDate(checkInDate, checkInTime);
        const checkOutDateTime = applyTimeToDate(checkOutDate, checkOutTime);

        if (Number.isNaN(checkInDateTime.getTime()) || Number.isNaN(checkOutDateTime.getTime())) {
            return NextResponse.json(
                { error: 'تواريخ الحجز غير صالحة' },
                { status: 400 }
            );
        }

        if (checkOutDateTime <= checkInDateTime) {
            return NextResponse.json(
                { error: 'تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول' },
                { status: 400 }
            );
        }

        // Verify room exists and belongs to hotel
        const room = await Room.findOne(tenantQuery.filter({ _id: roomId, isActive: true }));
        if (!room) {
            return NextResponse.json(
                { error: 'الغرفة غير موجودة' },
                { status: 404 }
            );
        }

        // Verify guest exists and belongs to hotel
        const guest = await Guest.findOne(tenantQuery.filter({ _id: guestId }));
        if (!guest) {
            return NextResponse.json(
                { error: 'النزيل غير موجود' },
                { status: 404 }
            );
        }

        // Check room availability
        const conflictingBooking = await Booking.findOne({
            hotelId: new mongoose.Types.ObjectId(auth.hotelId!),
            roomId: new mongoose.Types.ObjectId(roomId),
            status: { $nin: ['cancelled', 'checked_out', 'no_show'] },
            $or: [
                { checkInDate: { $lt: checkOutDateTime, $gte: checkInDateTime } },
                { checkOutDate: { $gt: checkInDateTime, $lte: checkOutDateTime } },
                { checkInDate: { $lte: checkInDateTime }, checkOutDate: { $gte: checkOutDateTime } },
            ],
        });

        if (conflictingBooking) {
            return NextResponse.json(
                { error: 'الغرفة محجوزة في هذه الفترة' },
                { status: 409 }
            );
        }

        // Calculate pricing
        const nights = Math.ceil((checkOutDateTime.getTime() - checkInDateTime.getTime()) / (1000 * 60 * 60 * 24));
        if (!Number.isFinite(nights) || nights < 1) {
            return NextResponse.json(
                { error: 'عدد الليالي غير صالح' },
                { status: 400 }
            );
        }
        const subtotal = room.pricePerNight * nights;
        const taxes = subtotal * (taxRate / 100);
        const total = subtotal + taxes;

        // Create booking
        const booking = await Booking.create({
            hotelId: new mongoose.Types.ObjectId(auth.hotelId!),
            roomId: new mongoose.Types.ObjectId(roomId),
            guestId: new mongoose.Types.ObjectId(guestId),
            checkInDate: checkInDateTime,
            checkOutDate: checkOutDateTime,
            numberOfGuests,
            source: source || 'direct',
            specialRequests,
            notes,
            pricing: {
                roomRate: room.pricePerNight,
                numberOfNights: nights,
                subtotal,
                taxes,
                discount: 0,
                total,
            },
            payment: { status: 'pending', paidAmount: 0, transactions: [] },
            createdBy: new mongoose.Types.ObjectId(auth.userId),
        });

        if (hotel.settings?.notifications?.newBooking) {
            const guestName = `${guest.firstName} ${guest.lastName}`.trim();
            const message = `تم إنشاء حجز جديد للغرفة ${room.roomNumber} باسم ${guestName}.`;

            await Hotel.findByIdAndUpdate(auth.hotelId, {
                $push: {
                    notificationsLog: {
                        $each: [
                            {
                                type: 'booking_new',
                                message,
                                createdAt: new Date(),
                            },
                        ],
                        $slice: -50,
                    },
                },
            });
        }

        return NextResponse.json({
            success: true,
            data: booking,
        }, { status: 201 });

    } catch (error) {
        console.error('Create booking error:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }
        if (typeof error === 'object' && error && 'code' in error && (error as { code?: number }).code === 11000) {
            return NextResponse.json(
                { error: 'رقم الحجز موجود مسبقاً، حاول مرة أخرى' },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { error: 'حدث خطأ أثناء إنشاء الحجز' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.BOOKING_READ, listBookings);
export const POST = withPermission(PERMISSIONS.BOOKING_CREATE, createBooking);
