import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/core/db/connection';
import { Hotel, User } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import { writeAuditLog } from '@/core/audit/logger';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 30;

type AlertSeverity = 'info' | 'warning' | 'critical' | 'expired';

interface AlertItem {
    hotelId: string;
    hotelName: string;
    email: string;
    phone: string;
    subscriptionStatus: string;
    isActive: boolean;
    endDate: string;
    daysRemaining: number;
    severity: AlertSeverity;
    owner: {
        id: string | null;
        name: string;
        email: string;
        phone: string;
        isActive: boolean | null;
    };
}

function isMainSuperAdmin(auth: AuthContext): boolean {
    return auth.role === 'super_admin';
}

function getScopedFilter(auth: AuthContext): Record<string, unknown> {
    if (isMainSuperAdmin(auth)) return {};
    return { createdBy: new mongoose.Types.ObjectId(auth.userId) };
}

function parseWindowDays(raw: string | null): number {
    const parsed = Number.parseInt(raw || String(DEFAULT_WINDOW_DAYS), 10);
    if (Number.isNaN(parsed)) return DEFAULT_WINDOW_DAYS;
    return Math.min(Math.max(parsed, 1), MAX_WINDOW_DAYS);
}

function getSeverity(daysRemaining: number): AlertSeverity {
    if (daysRemaining < 0) return 'expired';
    if (daysRemaining <= 1) return 'critical';
    if (daysRemaining <= 3) return 'warning';
    return 'info';
}

async function runSubscriptionMaintenance(
    request: NextRequest,
    auth: AuthContext,
    scopedFilter: Record<string, unknown>
): Promise<{ updatedCount: number; affectedIds: string[] }> {
    const now = new Date();
    const expiredFilter = {
        ...scopedFilter,
        'subscription.endDate': { $ne: null, $lt: now },
        'subscription.status': { $ne: 'cancelled' },
    };

    const expiredHotels = await Hotel.find(expiredFilter)
        .select('_id name subscription.status isActive')
        .lean();

    if (expiredHotels.length === 0) {
        return { updatedCount: 0, affectedIds: [] };
    }

    const expiredIds = expiredHotels.map((item) => item._id);
    await Hotel.updateMany(
        { _id: { $in: expiredIds } },
        {
            $set: {
                'subscription.status': 'suspended',
                isActive: false,
            },
        }
    );

    await writeAuditLog({
        request,
        auth,
        action: 'subscription.maintenance',
        entityType: 'subscription',
        metadata: {
            updatedHotelsCount: expiredHotels.length,
            updatedHotelIds: expiredIds.map((id) => id.toString()),
        },
    });

    return {
        updatedCount: expiredHotels.length,
        affectedIds: expiredIds.map((id) => id.toString()),
    };
}

async function getSubscriptionAlerts(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();
        const { searchParams } = new URL(request.url);
        const windowDays = parseWindowDays(searchParams.get('windowDays'));
        const runMaintenance = searchParams.get('runMaintenance') !== 'false';
        const now = new Date();

        const scopedFilter = getScopedFilter(auth);
        let maintenanceResult = { updatedCount: 0, affectedIds: [] as string[] };
        if (runMaintenance) {
            maintenanceResult = await runSubscriptionMaintenance(request, auth, scopedFilter);
        }

        const hotels = await Hotel.find({
            ...scopedFilter,
            'subscription.endDate': { $ne: null },
        })
            .select('name email phone subscription isActive')
            .sort({ 'subscription.endDate': 1 })
            .lean();

        const hotelIds = hotels.map((item) => item._id);
        const admins = hotelIds.length > 0
            ? await User.find({
                hotelId: { $in: hotelIds },
                role: 'admin',
            })
                .select('_id hotelId name email phone isActive createdAt')
                .sort({ createdAt: 1 })
                .lean()
            : [];

        const ownerByHotel = new Map<string, (typeof admins)[number]>();
        for (const admin of admins) {
            const key = admin.hotelId?.toString();
            if (!key || ownerByHotel.has(key)) continue;
            ownerByHotel.set(key, admin);
        }

        const alerts: AlertItem[] = [];
        for (const hotel of hotels) {
            const endDateValue = hotel.subscription?.endDate;
            if (!endDateValue) continue;

            const endDate = new Date(endDateValue);
            if (Number.isNaN(endDate.getTime())) continue;

            const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / DAY_IN_MS);
            if (daysRemaining > windowDays) continue;

            const owner = ownerByHotel.get(hotel._id.toString());
            alerts.push({
                hotelId: hotel._id.toString(),
                hotelName: hotel.name,
                email: hotel.email,
                phone: hotel.phone,
                subscriptionStatus: hotel.subscription?.status || 'active',
                isActive: Boolean(hotel.isActive),
                endDate: endDate.toISOString(),
                daysRemaining,
                severity: getSeverity(daysRemaining),
                owner: {
                    id: owner?._id?.toString() || null,
                    name: owner?.name || '-',
                    email: owner?.email || '-',
                    phone: owner?.phone || '-',
                    isActive: typeof owner?.isActive === 'boolean' ? owner.isActive : null,
                },
            });
        }

        alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

        const summary = {
            totalAlerts: alerts.length,
            expired: alerts.filter((item) => item.daysRemaining < 0).length,
            critical: alerts.filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 1).length,
            warning: alerts.filter((item) => item.daysRemaining >= 2 && item.daysRemaining <= 3).length,
            info: alerts.filter((item) => item.daysRemaining >= 4 && item.daysRemaining <= windowDays).length,
            maintenance: maintenanceResult,
            windowDays,
        };

        return NextResponse.json({
            success: true,
            summary,
            data: alerts,
        });
    } catch (error) {
        console.error('Get subscription alerts error:', error);
        return NextResponse.json(
            { error: 'Failed to load subscription alerts' },
            { status: 500 }
        );
    }
}

export const GET = withSuperAdmin(getSubscriptionAlerts);

