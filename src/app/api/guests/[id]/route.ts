import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Guest } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';
import { createTenantQuery } from '@/core/db/tenantMiddleware';
import { updateGuestSchema } from '@/lib/validations';
import mongoose from 'mongoose';

async function getGuest(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: 'معرف النزيل غير صالح' },
                { status: 400 }
            );
        }

        const tenantQuery = createTenantQuery(auth.hotelId!);
        const guest = await Guest.findOne(tenantQuery.filter({ _id: id })).lean();

        if (!guest) {
            return NextResponse.json(
                { error: 'النزيل غير موجود' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: guest });
    } catch (error) {
        console.error('Get guest error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب بيانات النزيل' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.GUEST_READ, getGuest);

async function updateGuest(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: 'معرف النزيل غير صالح' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const validation = updateGuestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const payload = validation.data;
        if (payload.email === undefined) {
            delete (payload as Record<string, unknown>).email;
        }

        const tenantQuery = createTenantQuery(auth.hotelId!);
        const updatedGuest = await Guest.findOneAndUpdate(
            tenantQuery.filter({ _id: id }),
            { $set: payload },
            { new: true, runValidators: true }
        ).lean();

        if (!updatedGuest) {
            return NextResponse.json(
                { error: 'النزيل غير موجود' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: updatedGuest });
    } catch (error) {
        console.error('Update guest error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء تحديث بيانات النزيل' },
            { status: 500 }
        );
    }
}

export const PUT = withPermission(PERMISSIONS.GUEST_UPDATE, updateGuest);
