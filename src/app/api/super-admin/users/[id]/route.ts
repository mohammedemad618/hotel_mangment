import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { User, Hotel } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import mongoose from 'mongoose';

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function isMainSuperAdmin(auth: AuthContext): boolean {
    return auth.role === 'super_admin';
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function updateUser(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
        }

        const body = await request.json() as Record<string, unknown>;
        const target = await User.findById(id).select('_id role hotelId isActive').lean();

        if (!target) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (!isMainSuperAdmin(auth)) {
            if (target.role === 'super_admin' || target.role === 'sub_super_admin') {
                return NextResponse.json({ error: 'Not allowed to edit this user' }, { status: 403 });
            }

            if (!target.hotelId) {
                return NextResponse.json({ error: 'Not allowed to edit this user' }, { status: 403 });
            }

            const ownedHotel = await Hotel.findOne({
                _id: target.hotelId,
                createdBy: new mongoose.Types.ObjectId(auth.userId),
            }).select('_id').lean();

            if (!ownedHotel) {
                return NextResponse.json({ error: 'Not allowed to edit this user' }, { status: 403 });
            }
        }

        if (id === auth.userId && hasOwn(body, 'isActive') && body.isActive === false) {
            return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });
        }

        const updates: Record<string, unknown> = {};
        const unset: Record<string, 1> = {};

        if (hasOwn(body, 'isActive')) {
            if (typeof body.isActive !== 'boolean') {
                return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
            }
            updates.isActive = body.isActive;
        }

        if (hasOwn(body, 'name')) {
            if (typeof body.name !== 'string') {
                return NextResponse.json({ error: 'Invalid name value' }, { status: 400 });
            }
            const name = body.name.trim();
            if (name.length < 2 || name.length > 100) {
                return NextResponse.json({ error: 'Name must be between 2 and 100 chars' }, { status: 400 });
            }
            updates.name = name;
        }

        if (hasOwn(body, 'email')) {
            if (typeof body.email !== 'string') {
                return NextResponse.json({ error: 'Invalid email value' }, { status: 400 });
            }

            const email = body.email.trim().toLowerCase();
            if (!isValidEmail(email)) {
                return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
            }

            const existingUser = await User.findOne({ email, _id: { $ne: target._id } }).select('_id').lean();
            if (existingUser) {
                return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
            }

            updates.email = email;
        }

        if (hasOwn(body, 'phone')) {
            if (body.phone === null || body.phone === '') {
                unset.phone = 1;
            } else if (typeof body.phone === 'string') {
                const phone = body.phone.trim();
                if (phone.length < 6 || phone.length > 25) {
                    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
                }
                updates.phone = phone;
            } else {
                return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
            }
        }

        if (Object.keys(updates).length === 0 && Object.keys(unset).length === 0) {
            return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
        }

        const updateDoc: Record<string, unknown> = {};
        if (Object.keys(updates).length > 0) updateDoc.$set = updates;
        if (Object.keys(unset).length > 0) updateDoc.$unset = unset;

        const user = await User.findByIdAndUpdate(id, updateDoc, { new: true })
            .select('name email phone role hotelId isActive createdAt createdBy')
            .populate('hotel', 'name slug')
            .populate('createdBy', 'name email role')
            .lean();

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

export const PATCH = withSuperAdmin(updateUser);
