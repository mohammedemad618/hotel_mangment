import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/core/db/connection';
import { AuditLog, User } from '@/core/db/models';
import { withMainSuperAdmin, AuthContext } from '@/core/middleware/auth';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function parseDateValue(raw: string | null, endOfDay = false): Date | null {
    if (!raw) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const normalized = endOfDay ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

async function getSubSuperAdminActivity(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { id } = await context.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid sub super admin id' }, { status: 400 });
        }

        const subUser = await User.findOne({ _id: id, role: 'sub_super_admin' })
            .select('name email isActive verification')
            .lean();

        if (!subUser) {
            return NextResponse.json({ error: 'Sub super admin not found' }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const page = clamp(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1, 100000);
        const limit = clamp(Number.parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1, MAX_LIMIT);
        const action = (searchParams.get('action') || '').trim();
        const entityType = (searchParams.get('entityType') || '').trim();
        const fromDateRaw = searchParams.get('from');
        const toDateRaw = searchParams.get('to');
        const fromDate = parseDateValue(fromDateRaw, false);
        const toDate = parseDateValue(toDateRaw, true);

        if ((fromDateRaw && !fromDate) || (toDateRaw && !toDate)) {
            return NextResponse.json({ error: 'Invalid date filter' }, { status: 400 });
        }

        if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
            return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
        }

        const filter: Record<string, unknown> = {
            actorId: new mongoose.Types.ObjectId(id),
        };

        if (action) filter.action = action;
        if (entityType) filter.entityType = entityType;
        if (fromDate || toDate) {
            const createdAt: Record<string, Date> = {};
            if (fromDate) createdAt.$gte = fromDate;
            if (toDate) createdAt.$lte = toDate;
            filter.createdAt = createdAt;
        }

        const [items, total, byAction, byEntity] = await Promise.all([
            AuditLog.find(filter)
                .select('action entityType entityId targetUserId targetHotelId metadata ip userAgent createdAt')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            AuditLog.countDocuments(filter),
            AuditLog.aggregate([
                { $match: filter },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
            AuditLog.aggregate([
                { $match: filter },
                { $group: { _id: '$entityType', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
        ]);

        return NextResponse.json({
            success: true,
            data: items,
            user: subUser,
            summary: {
                totalOperations: total,
                byAction,
                byEntity,
            },
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            filters: {
                action: action || null,
                entityType: entityType || null,
                from: fromDate ? fromDate.toISOString() : null,
                to: toDate ? toDate.toISOString() : null,
            },
        });
    } catch (error) {
        console.error('Get sub super admin activity error:', error);
        return NextResponse.json({ error: 'Failed to load activity logs' }, { status: 500 });
    }
}

export const GET = withMainSuperAdmin(getSubSuperAdminActivity);

