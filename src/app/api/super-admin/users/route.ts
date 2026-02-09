import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { User, Hotel, AuditLog } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import { createUserSchema } from '@/lib/validations';
import { hashPassword, validatePasswordStrength } from '@/core/auth';
import { escapeRegex, normalizeSearchTerm } from '@/core/security/input';
import mongoose from 'mongoose';
import { writeAuditLog } from '@/core/audit/logger';

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
        const includeStats = searchParams.get('includeStats') === 'true';

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
                .select('name email phone role hotelId isActive createdAt createdBy verification')
                .populate('hotel', 'name slug')
                .populate('createdBy', 'name email role')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            User.countDocuments(filter),
        ]);

        let data: any[] = users;
        if (includeStats && isMainSuperAdmin(auth)) {
            const subSuperAdmins = users.filter((item) => item.role === 'sub_super_admin');
            const subIds = subSuperAdmins.map((item) => item._id);

            if (subIds.length > 0) {
                const [hotelsByCreator, usersByCreator, actionsByActor] = await Promise.all([
                    Hotel.aggregate([
                        { $match: { createdBy: { $in: subIds } } },
                        { $group: { _id: '$createdBy', count: { $sum: 1 } } },
                    ]),
                    User.aggregate([
                        {
                            $match: {
                                createdBy: { $in: subIds },
                                role: { $ne: 'sub_super_admin' },
                            },
                        },
                        { $group: { _id: '$createdBy', count: { $sum: 1 } } },
                    ]),
                    AuditLog.aggregate([
                        { $match: { actorId: { $in: subIds } } },
                        { $group: { _id: '$actorId', count: { $sum: 1 } } },
                    ]),
                ]);

                const hotelsMap = new Map(hotelsByCreator.map((item) => [String(item._id), item.count as number]));
                const usersMap = new Map(usersByCreator.map((item) => [String(item._id), item.count as number]));
                const actionsMap = new Map(actionsByActor.map((item) => [String(item._id), item.count as number]));

                data = users.map((item) => {
                    if (item.role !== 'sub_super_admin') return item;
                    const key = String(item._id);
                    return {
                        ...item,
                        stats: {
                            hotelsCreated: hotelsMap.get(key) || 0,
                            accountsCreated: usersMap.get(key) || 0,
                            operationsCount: actionsMap.get(key) || 0,
                        },
                    };
                });
            }
        }

        return NextResponse.json({
            success: true,
            data,
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
        const initialVerification =
            role === 'sub_super_admin'
                ? {
                    isVerified: false,
                    verifiedBy: null,
                    verifiedAt: null,
                }
                : {
                    isVerified: true,
                    verifiedBy: new mongoose.Types.ObjectId(auth.userId),
                    verifiedAt: new Date(),
                };

        const user = await User.create({
            name,
            email,
            passwordHash,
            role,
            hotelId: resolvedHotelId,
            createdBy: new mongoose.Types.ObjectId(auth.userId),
            verification: initialVerification,
            permissions: [],
            isActive: true,
        });

        await writeAuditLog({
            request,
            auth,
            action: 'user.create',
            entityType: 'user',
            entityId: user._id,
            targetUserId: user._id,
            targetHotelId: resolvedHotelId,
            metadata: {
                createdRole: role,
                createdEmail: user.email,
            },
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
                verification: user.verification,
            },
        }, { status: 201 });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}

export const GET = withSuperAdmin(listUsers);
export const POST = withSuperAdmin(createUser);
