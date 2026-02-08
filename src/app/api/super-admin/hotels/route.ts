import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Hotel, User } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import { registerHotelSchema } from '@/lib/validations';
import { hashPassword, validatePasswordStrength } from '@/core/auth';

// GET: List hotels
async function listHotels(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
        const search = searchParams.get('search');

        const filter: Record<string, any> = {};
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } },
            ];
        }

        const [hotels, total] = await Promise.all([
            Hotel.find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            Hotel.countDocuments(filter),
        ]);

        return NextResponse.json({
            success: true,
            data: hotels,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('List hotels error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء جلب الفنادق' },
            { status: 500 }
        );
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

// POST: Create hotel + admin
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
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const { hotelName, email, password, phone, city, country, adminName } = validation.data;

        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.isValid) {
            return NextResponse.json(
                { error: passwordCheck.errors[0] },
                { status: 400 }
            );
        }

        const [existingHotel, existingUser] = await Promise.all([
            Hotel.findOne({ email }),
            User.findOne({ email }),
        ]);

        if (existingHotel || existingUser) {
            return NextResponse.json(
                { error: 'البريد الإلكتروني مستخدم بالفعل' },
                { status: 409 }
            );
        }

        const slug = await generateUniqueSlug(hotelName);

        const hotel = await Hotel.create({
            name: hotelName,
            slug,
            email,
            phone,
            address: {
                city,
                country,
            },
        });

        try {
            const passwordHash = await hashPassword(password);
            const user = await User.create({
                hotelId: hotel._id,
                email,
                passwordHash,
                name: adminName,
                role: 'admin',
                permissions: [],
                isActive: true,
            });

            return NextResponse.json({
                success: true,
                hotel,
                admin: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                },
            }, { status: 201 });
        } catch (error) {
            await Hotel.findByIdAndDelete(hotel._id);
            throw error;
        }
    } catch (error) {
        console.error('Create hotel error:', error);
        return NextResponse.json(
            { error: 'حدث خطأ أثناء إنشاء الفندق' },
            { status: 500 }
        );
    }
}

export const GET = withSuperAdmin(listHotels);
export const POST = withSuperAdmin(createHotel);
