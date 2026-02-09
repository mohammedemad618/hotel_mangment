import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { User, Hotel } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import { createUserSchema } from '@/lib/validations';
import { hashPassword, validatePasswordStrength } from '@/core/auth';
import { escapeRegex, normalizeSearchTerm } from '@/core/security/input';
import mongoose from 'mongoose';

const MAX_LIMIT = 100;
const SUB_SUPER_ALLOWED_ROLES = new Set(['admin', 'manager', 'receptionist', 'housekeeping', 'accountant']);

function isMainSuperAdmin(auth: AuthContext): boolean {
    return auth.role === 'super_admin';
}

async function getManagedHotelIds(auth: AuthContext): Promise<mongoose.Types.ObjectId[]> {
    if (isMainSuperAdmin(auth)) return [];
    const hotels = await Hotel.find({ createdBy: new mongoose.Types.ObjectId(auth.userId) }).select('_id').lean();
    return hotels.map((hotel) => hotel._id);
}

async function listUsers(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), MAX_LIMIT);
        const search = normalizeSearchTerm(searchParams.get('search'));
        const role = searchParams.get('role');
        const hotelId = searchParams.get('hotelId');

        const filter: Record<string, unknown> = {};

        if (search) {
            const safeSearch = escapeRegex(search);
            filter.$or = [
                { name: { $regex: safeSearch, $options: 'i' } },
                { email: { $regex: safeSearch, $options: 'i' } },
            ];
        }

        if (role) filter.role = role;

        if (isMainSuperAdmin(auth)) {
            if (hotelId) {
                if (!mongoose.Types.ObjectId.isValid(hotelId)) {
                    return NextResponse.json({ error: 'Invalid hotel id' }, { status: 400 });
                }
                filter.hotelId = new mongoose.Types.ObjectId(hotelId);
            }
        } else {
            const managedHotelIds = await getManagedHotelIds(auth);
            if (managedHotelIds.length === 0) {
                return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } });
            }

            if (role === 'super_admin' || role === 'sub_super_admin') {
                return NextResponse.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } });
            }

            if (hotelId) {
                if (!mongoose.Types.ObjectId.isValid(hotelId)) {
                    return NextResponse.json({ error: 'Invalid hotel id' }, { status: 400 });
                }

                const requestedHotelId = new mongoose.Types.ObjectId(hotelId);
                const isOwned = managedHotelIds.some((id) => id.equals(requestedHotelId));
                if (!isOwned) {
                    return NextResponse.json({ error: 'Not allowed for this hotel' }, { status: 403 });
                }

                filter.hotelId = requestedHotelId;
            } else {
                filter.hotelId = { $in: managedHotelIds };
            }
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('name email phone role hotelId isActive createdAt createdBy')
                .populate('hotel', 'name slug')
                .populate('createdBy', 'name email role')
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
        return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
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
            return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
        }

        const { name, email, password, role, hotelId } = validation.data;
        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.isValid) {
            return NextResponse.json({ error: passwordCheck.errors[0] }, { status: 400 });
        }

        if (!isMainSuperAdmin(auth) && (role === 'super_admin' || role === 'sub_super_admin')) {
            return NextResponse.json({ error: 'Not allowed to create this role' }, { status: 403 });
        }

        if (!isMainSuperAdmin(auth) && !SUB_SUPER_ALLOWED_ROLES.has(role)) {
            return NextResponse.json({ error: 'Role is not allowed for current account' }, { status: 403 });
        }

        const existingUser = await User.findOne({ email }).select('_id').lean();
        if (existingUser) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
        }

        let resolvedHotelId: mongoose.Types.ObjectId | null = null;
        if (role !== 'super_admin' && role !== 'sub_super_admin') {
            if (!hotelId || !mongoose.Types.ObjectId.isValid(hotelId)) {
                return NextResponse.json({ error: 'Hotel is required for this role' }, { status: 400 });
            }

            const hotel = await Hotel.findById(hotelId).select('_id createdBy').lean();
            if (!hotel) {
                return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
            }

            if (!isMainSuperAdmin(auth) && hotel.createdBy?.toString() !== auth.userId) {
                return NextResponse.json({ error: 'Not allowed to manage this hotel' }, { status: 403 });
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
            createdBy: new mongoose.Types.ObjectId(auth.userId),
            permissions: [],
            isActive: true,
        });

        return NextResponse.json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone || null,
                role: user.role,
                hotelId: user.hotelId,
                isActive: user.isActive,
                createdBy: user.createdBy,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

export const GET = withSuperAdmin(listUsers);
export const POST = withSuperAdmin(createUser);
