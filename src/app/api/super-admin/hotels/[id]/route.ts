import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Hotel, User } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import mongoose from 'mongoose';

const PLAN_VALUES = new Set(['free', 'basic', 'premium', 'enterprise']);
const STATUS_VALUES = new Set(['active', 'suspended', 'cancelled']);

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function parseDateInput(value: unknown): Date | null {
    if (value === null || value === '') return null;
    if (typeof value !== 'string') throw new Error('INVALID_DATE_TYPE');
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) throw new Error('INVALID_DATE_VALUE');
    return parsed;
}

async function updateHotel(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid hotel id' }, { status: 400 });
        }

        const targetHotel = await Hotel.findById(id).select('_id createdBy').lean();
        if (!targetHotel) {
            return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
        }

        if (auth.role === 'sub_super_admin' && targetHotel.createdBy?.toString() !== auth.userId) {
            return NextResponse.json({ error: 'Not allowed to manage this hotel' }, { status: 403 });
        }

        const body = await request.json() as Record<string, unknown>;
        const updates: Record<string, unknown> = {};

        if (hasOwn(body, 'isActive')) {
            if (typeof body.isActive !== 'boolean') {
                return NextResponse.json({ error: 'Invalid activation value' }, { status: 400 });
            }
            updates.isActive = body.isActive;
        }

        const subscription = body.subscription;
        if (subscription && typeof subscription === 'object' && !Array.isArray(subscription)) {
            const payload = subscription as Record<string, unknown>;

            if (hasOwn(payload, 'plan')) {
                if (typeof payload.plan !== 'string' || !PLAN_VALUES.has(payload.plan)) {
                    return NextResponse.json({ error: 'Invalid plan value' }, { status: 400 });
                }
                updates['subscription.plan'] = payload.plan;
            }

            if (hasOwn(payload, 'status')) {
                if (typeof payload.status !== 'string' || !STATUS_VALUES.has(payload.status)) {
                    return NextResponse.json({ error: 'Invalid subscription status' }, { status: 400 });
                }
                updates['subscription.status'] = payload.status;
            }

            try {
                if (hasOwn(payload, 'paymentDate')) updates['subscription.paymentDate'] = parseDateInput(payload.paymentDate);
                if (hasOwn(payload, 'endDate')) updates['subscription.endDate'] = parseDateInput(payload.endDate);
            } catch {
                return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
            }
        }

        if (hasOwn(body, 'isVerified')) {
            if (auth.role !== 'super_admin') {
                return NextResponse.json({ error: 'Only main super admin can verify hotels' }, { status: 403 });
            }

            if (typeof body.isVerified !== 'boolean') {
                return NextResponse.json({ error: 'Invalid verification value' }, { status: 400 });
            }

            updates['verification.isVerified'] = body.isVerified;
            updates['verification.verifiedAt'] = body.isVerified ? new Date() : null;
            updates['verification.verifiedBy'] = body.isVerified ? new mongoose.Types.ObjectId(auth.userId) : null;
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
        }

        const hotel = await Hotel.findByIdAndUpdate(id, { $set: updates }, { new: true })
            .select('name email phone slug address subscription verification isActive createdBy createdAt updatedAt')
            .populate('createdBy', 'name email role')
            .lean();

        if (!hotel) {
            return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
        }

        const admin = await User.findOne({ hotelId: hotel._id, role: 'admin' })
            .select('name email phone isActive hotelId createdAt')
            .sort({ createdAt: 1 })
            .lean();

        return NextResponse.json({ success: true, data: { ...hotel, admin: admin || null } });
    } catch (error) {
        console.error('Update hotel error:', error);
        return NextResponse.json({ error: 'Failed to update hotel' }, { status: 500 });
    }
}

export const PATCH = withSuperAdmin(updateHotel);
