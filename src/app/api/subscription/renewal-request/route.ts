import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Hotel } from '@/core/db/models';
import { PERMISSIONS } from '@/core/auth';
import { withPermission, AuthContext } from '@/core/middleware/auth';
import { renewalRequestSchema } from '@/lib/validations';

const MAX_NOTIFICATION_LOG_ITEMS = 50;

function buildRenewalRequestMessage(requestedAt: Date): string {
    const dateLabel = requestedAt.toISOString().slice(0, 10);
    return `Subscription renewal request submitted on ${dateLabel}.`;
}

async function requestRenewal(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        if (!auth.hotelId) {
            return NextResponse.json(
                { error: 'Hotel context is required for renewal requests' },
                { status: 403 }
            );
        }

        let payload: unknown = {};
        try {
            payload = await request.json();
        } catch {
            payload = {};
        }

        const validation = renewalRequestSchema.safeParse(payload || {});
        if (!validation.success) {
            return NextResponse.json(
                { error: validation.error.errors[0].message },
                { status: 400 }
            );
        }

        const note = (validation.data.note || '').trim();
        const now = new Date();
        const requestedBy = new mongoose.Types.ObjectId(auth.userId);

        const updatedHotel = await Hotel.findOneAndUpdate(
            {
                _id: auth.hotelId,
                'subscription.renewalRequest.isPending': { $ne: true },
            },
            {
                $set: {
                    'subscription.renewalRequest.isPending': true,
                    'subscription.renewalRequest.requestedAt': now,
                    'subscription.renewalRequest.note': note,
                    'subscription.renewalRequest.requestedBy': requestedBy,
                },
                $push: {
                    notificationsLog: {
                        $each: [
                            {
                                type: 'subscription_renewal_requested',
                                message: buildRenewalRequestMessage(now),
                                createdAt: now,
                                isRead: false,
                                readAt: null,
                                actionUrl: '/dashboard/settings',
                            },
                        ],
                        $slice: -MAX_NOTIFICATION_LOG_ITEMS,
                    },
                },
            },
            { new: true }
        )
            .select('name subscription settings notificationsLog')
            .lean();

        if (!updatedHotel) {
            const existingHotel = await Hotel.findById(auth.hotelId)
                .select('_id subscription.renewalRequest.isPending')
                .lean();

            if (!existingHotel) {
                return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
            }

            if ((existingHotel as any)?.subscription?.renewalRequest?.isPending) {
                return NextResponse.json(
                    { error: 'A renewal request is already pending' },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                { error: 'Failed to create renewal request' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                hotel: updatedHotel,
            },
        });
    } catch (error) {
        console.error('Create renewal request error:', error);
        return NextResponse.json(
            { error: 'Failed to create renewal request' },
            { status: 500 }
        );
    }
}

export const POST = withPermission(PERMISSIONS.SETTINGS_READ, requestRenewal);
