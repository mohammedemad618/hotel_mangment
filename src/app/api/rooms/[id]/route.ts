import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Room } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';
import { updateRoomSchema } from '@/lib/validations';
import { createTenantQuery } from '@/core/db/tenantMiddleware';
import mongoose from 'mongoose';

// GET: Get single room
async function getRoom(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: 'معرف الغرفة غير صالح' },
                { status: 400 }
            );
        }

        const tenantQuery = createTenantQuery(auth.hotelId!);
        const room = await Room.findOne(tenantQuery.filter({ _id: id }));

        if (!room) {
            return NextResponse.json(
                { error: 'الغرفة غير موجودة' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: room,
        });

    } catch (error) {
        console.error('Get room error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب الغرفة' },
            { status: 500 }
        );
    }
}

// PUT: Update room
async function updateRoom(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;
        const body = await request.json();

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: 'معرف الغرفة غير صالح' },
                { status: 400 }
            );
        }

        // Validate input
        const validation = updateRoomSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const tenantQuery = createTenantQuery(auth.hotelId!);

        // Check if room exists and belongs to tenant
        const existingRoom = await Room.findOne(tenantQuery.filter({ _id: id }));
        if (!existingRoom) {
            return NextResponse.json(
                { error: 'الغرفة غير موجودة' },
                { status: 404 }
            );
        }

        // Check for duplicate room number if changing
        if (validation.data.roomNumber && validation.data.roomNumber !== existingRoom.roomNumber) {
            const duplicate = await Room.findOne(tenantQuery.filter({
                roomNumber: validation.data.roomNumber,
                _id: { $ne: id },
            }));

            if (duplicate) {
                return NextResponse.json(
                    { error: 'رقم الغرفة موجود مسبقاً' },
                    { status: 409 }
                );
            }
        }

        const room = await Room.findByIdAndUpdate(
            id,
            { $set: validation.data },
            { new: true, runValidators: true }
        );

        return NextResponse.json({
            success: true,
            data: room,
        });

    } catch (error) {
        console.error('Update room error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء تحديث الغرفة' },
            { status: 500 }
        );
    }
}

// DELETE: Delete room (soft delete)
async function deleteRoom(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: 'معرف الغرفة غير صالح' },
                { status: 400 }
            );
        }

        const tenantQuery = createTenantQuery(auth.hotelId!);
        const room = await Room.findOne(tenantQuery.filter({ _id: id }));

        if (!room) {
            return NextResponse.json(
                { error: 'الغرفة غير موجودة' },
                { status: 404 }
            );
        }

        // Soft delete
        room.isActive = false;
        await room.save();

        return NextResponse.json({
            success: true,
            message: 'تم حذف الغرفة بنجاح',
        });

    } catch (error) {
        console.error('Delete room error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء حذف الغرفة' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.ROOM_READ, getRoom);
export const PUT = withPermission(PERMISSIONS.ROOM_UPDATE, updateRoom);
export const DELETE = withPermission(PERMISSIONS.ROOM_DELETE, deleteRoom);
