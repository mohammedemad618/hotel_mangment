import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { User, Hotel } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import { createUserSchema } from '@/lib/validations';
import { hashPassword, validatePasswordStrength } from '@/core/auth';
import { escapeRegex, normalizeSearchTerm } from '@/core/security/input';
import mongoose from 'mongoose';

async function listUsers(
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
        const role = searchParams.get('role');
        const hotelId = searchParams.get('hotelId');

        const filter: Record<string, any> = {};

        if (search) {
            const safeSearch = escapeRegex(search);
            filter.$or = [
                { name: { $regex: safeSearch, $options: 'i' } },
                { email: { $regex: safeSearch, $options: 'i' } },
            ];
        }

        if (role) {
            filter.role = role;
        }

        if (hotelId) {
            if (!mongoose.Types.ObjectId.isValid(hotelId)) {
                return NextResponse.json(
                    { error: 'معرف الفندق غير صالح' },
                    { status: 400 }
                );
            }
            filter.hotelId = new mongoose.Types.ObjectId(hotelId);
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('name email role hotelId isActive createdAt')
                .populate('hotel', 'name slug')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter),
        ]);

        return NextResponse.json({
            success: true,
            data: users,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('List users error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب المستخدمين' },
            { status: 500 }
        );
    }
}

async function createUser(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const body = await request.json();
        const validation = createUserSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const { name, email, password, role, hotelId } = validation.data;

        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.isValid) {
            return NextResponse.json(
                { error: passwordCheck.errors[0] },
                { status: 400 }
            );
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { error: 'البريد الإلكتروني مستخدم بالفعل' },
                { status: 409 }
            );
        }

        let resolvedHotelId: mongoose.Types.ObjectId | null = null;
        if (role !== 'super_admin') {
            if (!hotelId || !mongoose.Types.ObjectId.isValid(hotelId)) {
                return NextResponse.json(
                    { error: 'الفندق مطلوب لهذا الدور' },
                    { status: 400 }
                );
            }

            const hotel = await Hotel.findById(hotelId).select('_id');
            if (!hotel) {
                return NextResponse.json(
                    { error: 'الفندق غير موجود' },
                    { status: 404 }
                );
            }

            resolvedHotelId = hotel._id;
        }

        const passwordHash = await hashPassword(password);
        const user = await User.create({
            name,
            email,
            passwordHash,
            role,
            hotelId: resolvedHotelId,
            permissions: [],
            isActive: true,
        });

        return NextResponse.json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                hotelId: user.hotelId,
                isActive: user.isActive,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء إنشاء المستخدم' },
            { status: 500 }
        );
    }
}

export const GET = withSuperAdmin(listUsers);
export const POST = withSuperAdmin(createUser);
