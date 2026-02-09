import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Guest } from '@/core/db/models';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { PERMISSIONS } from '@/core/auth';
import { createGuestSchema } from '@/lib/validations';
import { createTenantQuery } from '@/core/db/tenantMiddleware';
import { escapeRegex, normalizeSearchTerm } from '@/core/security/input';
import mongoose from 'mongoose';

// GET: List guests
async function listGuests(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
        const search = normalizeSearchTerm(searchParams.get('search'));
        const guestType = searchParams.get('guestType');

        const tenantQuery = createTenantQuery(auth.hotelId!);
        const filter: Record<string, any> = tenantQuery.filter({});

        if (search) {
            const safeSearch = escapeRegex(search);
            filter.$or = [
                { firstName: { $regex: safeSearch, $options: 'i' } },
                { lastName: { $regex: safeSearch, $options: 'i' } },
                { phone: { $regex: safeSearch, $options: 'i' } },
                { email: { $regex: safeSearch, $options: 'i' } },
                { idNumber: { $regex: safeSearch, $options: 'i' } },
            ];
        }

        if (guestType) filter.guestType = guestType;

        const [guests, total] = await Promise.all([
            Guest.find(filter)
                .sort({ lastName: 1, firstName: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Guest.countDocuments(filter),
        ]);

        return NextResponse.json({
            success: true,
            data: guests,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });

    } catch (error) {
        console.error('List guests error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب النزلاء' },
            { status: 500 }
        );
    }
}

// POST: Create guest
async function createGuest(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const body = await request.json();
        const validation = createGuestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const guest = await Guest.create({
            ...validation.data,
            hotelId: new mongoose.Types.ObjectId(auth.hotelId!),
        });

        return NextResponse.json({
            success: true,
            data: guest,
        }, { status: 201 });

    } catch (error) {
        console.error('Create guest error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء إنشاء النزيل' },
            { status: 500 }
        );
    }
}

export const GET = withPermission(PERMISSIONS.GUEST_READ, listGuests);
export const POST = withPermission(PERMISSIONS.GUEST_CREATE, createGuest);
