import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/core/db/connection';
import { AuditLog, Hotel, User } from '@/core/db/models';
import { withMainSuperAdmin, AuthContext } from '@/core/middleware/auth';

async function listSubSuperAdmins(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const subSuperAdmins = await User.find({ role: 'sub_super_admin' })
            .select('name email phone isActive verification createdAt lastLogin')
            .sort({ createdAt: -1 })
            .lean();

        if (subSuperAdmins.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        const subIds = subSuperAdmins.map((item) => item._id as mongoose.Types.ObjectId);

        const [hotelsByCreator, usersByCreator, actionsByActor, recentLogs] = await Promise.all([
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
            AuditLog.find({ actorId: { $in: subIds } })
                .select('actorId action entityType entityId targetUserId targetHotelId metadata createdAt')
                .sort({ createdAt: -1 })
                .limit(500)
                .lean(),
        ]);

        const hotelsMap = new Map(hotelsByCreator.map((item) => [String(item._id), item.count as number]));
        const usersMap = new Map(usersByCreator.map((item) => [String(item._id), item.count as number]));
        const actionsMap = new Map(actionsByActor.map((item) => [String(item._id), item.count as number]));

        const recentActionsMap = new Map<string, any[]>();
        for (const log of recentLogs) {
            const actorKey = String(log.actorId);
            const current = recentActionsMap.get(actorKey) || [];
            if (current.length >= 12) continue;
            current.push(log);
            recentActionsMap.set(actorKey, current);
        }

        const data = subSuperAdmins.map((sub) => {
            const key = String(sub._id);
            return {
                ...sub,
                stats: {
                    hotelsCreated: hotelsMap.get(key) || 0,
                    accountsCreated: usersMap.get(key) || 0,
                    operationsCount: actionsMap.get(key) || 0,
                },
                recentActions: recentActionsMap.get(key) || [],
            };
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('List sub super admins overview error:', error);
        return NextResponse.json(
            { error: 'Failed to load sub super admin overview' },
            { status: 500 }
        );
    }
}

export const GET = withMainSuperAdmin(listSubSuperAdmins);

