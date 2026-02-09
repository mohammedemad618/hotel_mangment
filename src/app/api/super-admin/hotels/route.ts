import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/core/db/connection';
import { Hotel, User } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import { registerHotelSchema } from '@/lib/validations';
import { hashPassword, validatePasswordStrength } from '@/core/auth';
import { escapeRegex, normalizeSearchTerm } from '@/core/security/input';
import { writeAuditLog } from '@/core/audit/logger';
import { addDays, SUBSCRIPTION_RENEWAL_DAYS } from '@/core/subscription/policy';

const MAX_LIMIT = 100;

function isMainSuperAdmin(auth: AuthContext): boolean {
    return auth.role === 'super_admin';
}

function getHotelsScopeFilter(auth: AuthContext): Record<string, unknown> {
    if (isMainSuperAdmin(auth)) return {};
    return { createdBy: new mongoose.Types.ObjectId(auth.userId) };
}

async function listHotels(
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

        const conditions: Record<string, unknown>[] = [];
        const scopeFilter = getHotelsScopeFilter(auth);
        if (Object.keys(scopeFilter).length > 0) conditions.push(scopeFilter);

        if (search) {
            const safeSearch = escapeRegex(search);
            conditions.push({
                $or: [
                    { name: { $regex: safeSearch, $options: 'i' } },
                    { email: { $regex: safeSearch, $options: 'i' } },
                    { slug: { $regex: safeSearch, $options: 'i' } },
                ],
            });
        }

        const filter = conditions.length > 0 ? { $and: conditions } : {};

        const [hotels, total] = await Promise.all([
            Hotel.find(filter)
                .select('name email phone slug address subscription verification isActive createdBy createdAt updatedAt')
                .populate('createdBy', 'name email role')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Hotel.countDocuments(filter),
        ]);

        const hotelIds = hotels.map((hotel) => hotel._id);
        const admins = hotelIds.length > 0
            ? await User.find({ hotelId: { $in: hotelIds }, role: 'admin' })
                .select('name email phone isActive hotelId createdAt')
                .sort({ createdAt: 1 })
                .lean()
            : [];

        const adminByHotel = new Map<string, (typeof admins)[number]>();
        for (const admin of admins) {
            const hotelId = admin.hotelId?.toString();
            if (!hotelId || adminByHotel.has(hotelId)) continue;
            adminByHotel.set(hotelId, admin);
        }

        const hotelsWithAdmin = hotels.map((hotel) => ({
            ...hotel,
            admin: adminByHotel.get(hotel._id.toString()) || null,
        }));

        return NextResponse.json({
            success: true,
            data: hotelsWithAdmin,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('List hotels error:', error);
        return NextResponse.json({ error: 'Failed to load hotels' }, { status: 500 });
    }
}

function slugify(value: string): string {
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9\u0600-\u06FF-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function generateUniqueSlug(base: string): Promise<string> {
    const baseSlug = slugify(base) || 'hotel';
    let slug = baseSlug;
    let counter = 1;
    while (await Hotel.exists({ slug })) {
        counter += 1;
        slug = `${baseSlug}-${counter}`;
    }
    return slug;
}

async function createHotel(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();
        const body = await request.json();
        const validation = registerHotelSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: validation.error.errors[0].message }, { status: 400 });
        }

        const { hotelName, email, password, phone, city, country, adminName } = validation.data;
        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.isValid) {
            return NextResponse.json({ error: passwordCheck.errors[0] }, { status: 400 });
        }

        const [existingHotel, existingUser] = await Promise.all([
            Hotel.findOne({ email }).select('_id').lean(),
            User.findOne({ email }).select('_id').lean(),
        ]);

        if (existingHotel || existingUser) {
            return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
        }

        const slug = await generateUniqueSlug(hotelName);

        const now = new Date();
        const initialEndDate = addDays(now, SUBSCRIPTION_RENEWAL_DAYS);

        const hotel = await Hotel.create({
            name: hotelName,
            slug,
            email,
            phone,
            createdBy: new mongoose.Types.ObjectId(auth.userId),
            address: { city, country },
            subscription: {
                plan: 'basic',
                status: 'active',
                startDate: now,
                paymentDate: now,
                endDate: initialEndDate,
            },
            verification: { isVerified: false, verifiedBy: null, verifiedAt: null },
        });

        try {
            const passwordHash = await hashPassword(password);
            const user = await User.create({
                hotelId: hotel._id,
                createdBy: new mongoose.Types.ObjectId(auth.userId),
                email,
                passwordHash,
                name: adminName,
                role: 'admin',
                verification: {
                    isVerified: true,
                    verifiedBy: new mongoose.Types.ObjectId(auth.userId),
                    verifiedAt: new Date(),
                },
                permissions: [],
                isActive: true,
            });

            await writeAuditLog({
                request,
                auth,
                action: 'hotel.create',
                entityType: 'hotel',
                entityId: hotel._id,
                targetUserId: user._id,
                targetHotelId: hotel._id,
                metadata: {
                    hotelName: hotel.name,
                    ownerEmail: user.email,
                    creatorRole: auth.role,
                },
            });

            return NextResponse.json({
                success: true,
                hotel,
                admin: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone || null,
                    isActive: user.isActive,
                },
            }, { status: 201 });
        } catch (error) {
            await Hotel.findByIdAndDelete(hotel._id);
            throw error;
        }
    } catch (error) {
        console.error('Create hotel error:', error);
        return NextResponse.json({ error: 'Failed to create hotel' }, { status: 500 });
    }
}

export const GET = withSuperAdmin(listHotels);
export const POST = withSuperAdmin(createHotel);
