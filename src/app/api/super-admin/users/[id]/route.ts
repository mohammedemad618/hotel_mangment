import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { User, Hotel } from '@/core/db/models';
import { withSuperAdmin, withMainSuperAdmin, AuthContext } from '@/core/middleware/auth';
import mongoose from 'mongoose';
import { writeAuditLog } from '@/core/audit/logger';

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function isMainSuperAdmin(auth: AuthContext): boolean {
    return auth.role === 'super_admin';
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toAuditValue(value: unknown): unknown {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof mongoose.Types.ObjectId) return value.toString();
    return value;
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
        const target = await User.findById(id)
            .select('_id role hotelId isActive name email phone verification')
            .lean();
        let adminNote: string | null = null;

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

        if (hasOwn(body, 'isVerified')) {
            if (!isMainSuperAdmin(auth)) {
                return NextResponse.json({ error: 'Only main super admin can verify accounts' }, { status: 403 });
            }

            if (target.role !== 'sub_super_admin') {
                return NextResponse.json({ error: 'Verification is available only for sub super admin accounts' }, { status: 400 });
            }

            if (typeof body.isVerified !== 'boolean') {
                return NextResponse.json({ error: 'Invalid verification value' }, { status: 400 });
            }

            updates['verification.isVerified'] = body.isVerified;
            updates['verification.verifiedAt'] = body.isVerified ? new Date() : null;
            updates['verification.verifiedBy'] = body.isVerified
                ? new mongoose.Types.ObjectId(auth.userId)
                : null;
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

        if (hasOwn(body, 'adminNote')) {
            if (body.adminNote === null || body.adminNote === '') {
                adminNote = null;
            } else if (typeof body.adminNote === 'string') {
                const normalized = body.adminNote.trim();
                if (normalized.length > 500) {
                    return NextResponse.json({ error: 'Admin note is too long' }, { status: 400 });
                }
                adminNote = normalized || null;
            } else {
                return NextResponse.json({ error: 'Invalid admin note' }, { status: 400 });
            }
        }

        if (Object.keys(updates).length === 0 && Object.keys(unset).length === 0) {
            return NextResponse.json({ error: 'No valid update fields provided' }, { status: 400 });
        }

        const updateDoc: Record<string, unknown> = {};
        if (Object.keys(updates).length > 0) updateDoc.$set = updates;
        if (Object.keys(unset).length > 0) updateDoc.$unset = unset;

        const user = await User.findByIdAndUpdate(id, updateDoc, { new: true })
            .select('name email phone role hotelId isActive createdAt createdBy verification')
            .populate('hotel', 'name slug')
            .populate('createdBy', 'name email role')
            .lean();

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const trackedFields = new Set<string>([
            ...Object.keys(updates),
            ...Object.keys(unset),
        ]);

        const beforeMap: Record<string, unknown> = {
            isActive: target.isActive,
            name: (target as any).name,
            email: (target as any).email,
            phone: (target as any).phone ?? null,
            'verification.isVerified': (target as any).verification?.isVerified ?? null,
            'verification.verifiedAt': (target as any).verification?.verifiedAt ?? null,
            'verification.verifiedBy': (target as any).verification?.verifiedBy ?? null,
        };

        const afterMap: Record<string, unknown> = {
            isActive: user.isActive,
            name: user.name,
            email: user.email,
            phone: (user as any).phone ?? null,
            'verification.isVerified': (user as any).verification?.isVerified ?? null,
            'verification.verifiedAt': (user as any).verification?.verifiedAt ?? null,
            'verification.verifiedBy': (user as any).verification?.verifiedBy ?? null,
        };

        const changes: Record<string, { before: unknown; after: unknown }> = {};
        trackedFields.forEach((field) => {
            changes[field] = {
                before: toAuditValue(beforeMap[field]),
                after: toAuditValue(afterMap[field]),
            };
        });

        await writeAuditLog({
            request,
            auth,
            action: 'user.update',
            entityType: 'user',
            entityId: id,
            targetUserId: id,
            targetHotelId: user.hotelId,
            metadata: {
                updatedFields: Object.keys(updates),
                unsetFields: Object.keys(unset),
                changes,
                adminNote,
            },
        });

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }
}

export const PATCH = withSuperAdmin(updateUser);

async function deleteUser(
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

        if (id === auth.userId) {
            return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
        }

        const target = await User.findById(id).select('_id role hotelId email').lean();
        if (!target) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (target.role === 'super_admin') {
            return NextResponse.json({ error: 'Main super admin account cannot be deleted' }, { status: 400 });
        }

        await User.findByIdAndDelete(id);

        await writeAuditLog({
            request,
            auth,
            action: 'user.delete',
            entityType: 'user',
            entityId: id,
            targetUserId: id,
            targetHotelId: target.hotelId,
            metadata: {
                deletedRole: target.role,
                deletedEmail: target.email,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
    }
}

export const DELETE = withMainSuperAdmin(deleteUser);
