import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Room } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';
import { createRoomSchema } from '@/lib/validations';
import { createTenantQuery } from '@/core/db/tenantMiddleware';
import mongoose from 'mongoose';

// GET: List rooms
async function listRooms(
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
        const type = searchParams.get('type');
        const floor = searchParams.get('floor');

        // Build query with tenant isolation
        const tenantQuery = createTenantQuery(auth.hotelId!);
        const filter: Record<string, any> = tenantQuery.filter({});

        if (status === 'inactive') {
            filter.isActive = false;
        } else {
            filter.isActive = true;
            if (status) filter.status = status;
        }
        if (type) filter.type = type;
        if (floor) filter.floor = parseInt(floor);

        const [rooms, total] = await Promise.all([
            Room.find(filter)
                .sort({ floor: 1, roomNumber: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Room.countDocuments(filter),
        ]);

        return NextResponse.json({
            success: true,
            data: rooms,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });

    } catch (error) {
        console.error('List rooms error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب الغرف' },
            { status: 500 }
        );
    }
}

// POST: Create room
async function createRoom(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const body = await request.json();

        // Validate input
        const validation = createRoomSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        // Check for duplicate room number in this hotel
        const existingRoom = await Room.findOne({
            hotelId: new mongoose.Types.ObjectId(auth.hotelId!),
            roomNumber: validation.data.roomNumber,
        });

        if (existingRoom) {
            return NextResponse.json(
                { error: 'رقم الغرفة موجود مسبقاً' },
                { status: 409 }
            );
        }

        // Create room with tenant ID
        const room = await Room.create({
            ...validation.data,
            hotelId: new mongoose.Types.ObjectId(auth.hotelId!),
        });

        return NextResponse.json({
            success: true,
            data: room,
        }, { status: 201 });

    } catch (error) {
        console.error('Create room error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء إنشاء الغرفة' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.ROOM_READ, listRooms);
export const POST = withPermission(PERMISSIONS.ROOM_CREATE, createRoom);
