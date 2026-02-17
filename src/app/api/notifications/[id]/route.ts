import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/core/db/connection';
import { Hotel } from '@/core/db/models';
import { withAuth, AuthContext } from '@/core/middleware/auth';

async function markNotification(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        if (!auth.hotelId) {
            return NextResponse.json(
                { error: 'Hotel context is required' },
                { status: 403 }
            );
        }

        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: 'Invalid notification id' },
                { status: 400 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const isRead = body?.isRead !== false;
        const now = new Date();

        const result = await Hotel.updateOne(
            {
                _id: auth.hotelId,
                'notificationsLog._id': new mongoose.Types.ObjectId(id),
            },
            {
                $set: {
                    'notificationsLog.$.isRead': isRead,
                    'notificationsLog.$.readAt': isRead ? now : null,
                },
            }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json(
                { error: 'Notification not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                id,
                isRead,
                readAt: isRead ? now.toISOString() : null,
            },
        });
    } catch (error) {
        console.error('Mark notification error:', error);
        return NextResponse.json(
            { error: 'Failed to update notification' },
            { status: 500 }
        );
    }
}

export const PATCH = withAuth(markNotification);
