import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Hotel } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import mongoose from 'mongoose';

async function updateHotel(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: 'معرف الفندق غير صالح' },
                { status: 400 }
            );
        }

        const body = await request.json();
        if (typeof body.isActive !== 'boolean') {
            return NextResponse.json(
                { error: 'قيمة الحالة غير صالحة' },
                { status: 400 }
            );
        }

        const hotel = await Hotel.findByIdAndUpdate(
            id,
            { $set: { isActive: body.isActive } },
            { new: true }
        ).lean();

        if (!hotel) {
            return NextResponse.json(
                { error: 'الفندق غير موجود' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: hotel });
    } catch (error) {
        console.error('Update hotel error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء تحديث الفندق' },
            { status: 500 }
        );
    }
}

export const PATCH = withSuperAdmin(updateHotel);
