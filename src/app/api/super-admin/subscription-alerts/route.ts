import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/core/db/connection';
import { Hotel, User } from '@/core/db/models';
import { withSuperAdmin, AuthContext } from '@/core/middleware/auth';
import { writeAuditLog } from '@/core/audit/logger';
import {
    SUBSCRIPTION_GRACE_DAYS,
    SUBSCRIPTION_WARNING_DAYS,
    getSubscriptionTimeline,
} from '@/core/subscription/policy';
import { runSubscriptionMaintenance } from '@/core/subscription/maintenance';
import { runSubscriptionNotificationSweep } from '@/core/subscription/notifications';

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
    graceEndDate: string | null;
    daysRemaining: number;
    daysPastEnd: number;
    daysUntilSuspension: number | null;
    isInGracePeriod: boolean;
    isBeyondGracePeriod: boolean;
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

function getSeverity(args: {
    isInGracePeriod: boolean;
    isBeyondGracePeriod: boolean;
    daysRemaining: number;
}): AlertSeverity {
    if (args.isBeyondGracePeriod) return 'expired';
    if (args.isInGracePeriod) return 'critical';
    if (args.daysRemaining <= SUBSCRIPTION_WARNING_DAYS) return 'warning';
    return 'info';
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
        let maintenanceResult = {
            cutoffDate: '',
            scannedOverdue: 0,
            updatedCount: 0,
            affectedIds: [] as string[],
        };
        if (runMaintenance) {
            maintenanceResult = await runSubscriptionMaintenance(scopedFilter, now);
            if (maintenanceResult.updatedCount > 0) {
                await writeAuditLog({
                    request,
                    auth,
                    action: 'subscription.maintenance',
                    entityType: 'subscription',
                    metadata: {
                        graceDays: SUBSCRIPTION_GRACE_DAYS,
                        warningDays: SUBSCRIPTION_WARNING_DAYS,
                        updatedHotelsCount: maintenanceResult.updatedCount,
                        updatedHotelIds: maintenanceResult.affectedIds,
                        scannedOverdue: maintenanceResult.scannedOverdue,
                        cutoffDate: maintenanceResult.cutoffDate,
                    },
                });
            }
        }
        const notificationResult = await runSubscriptionNotificationSweep(scopedFilter, now);

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
            const timeline = getSubscriptionTimeline(
                hotel.subscription?.endDate || null,
                now,
                SUBSCRIPTION_WARNING_DAYS,
                SUBSCRIPTION_GRACE_DAYS
            );
            if (!timeline.hasEndDate || !timeline.endDate) continue;

            const shouldIncludeUpcoming = timeline.daysRemaining !== null && timeline.daysRemaining >= 0 && timeline.daysRemaining <= windowDays;
            const shouldIncludeGrace = timeline.isInGracePeriod;
            const shouldIncludeExpired = timeline.isBeyondGracePeriod;
            if (!shouldIncludeUpcoming && !shouldIncludeGrace && !shouldIncludeExpired) continue;

            const owner = ownerByHotel.get(hotel._id.toString());
            alerts.push({
                hotelId: hotel._id.toString(),
                hotelName: hotel.name,
                email: hotel.email,
                phone: hotel.phone,
                subscriptionStatus: hotel.subscription?.status || 'active',
                isActive: Boolean(hotel.isActive),
                endDate: timeline.endDate.toISOString(),
                graceEndDate: timeline.graceEndDate ? timeline.graceEndDate.toISOString() : null,
                daysRemaining: timeline.daysRemaining || 0,
                daysPastEnd: timeline.daysPastEnd || 0,
                daysUntilSuspension: timeline.daysUntilSuspension,
                isInGracePeriod: timeline.isInGracePeriod,
                isBeyondGracePeriod: timeline.isBeyondGracePeriod,
                severity: getSeverity({
                    isInGracePeriod: timeline.isInGracePeriod,
                    isBeyondGracePeriod: timeline.isBeyondGracePeriod,
                    daysRemaining: timeline.daysRemaining || 0,
                }),
                owner: {
                    id: owner?._id?.toString() || null,
                    name: owner?.name || '-',
                    email: owner?.email || '-',
                    phone: owner?.phone || '-',
                    isActive: typeof owner?.isActive === 'boolean' ? owner.isActive : null,
                },
            });
        }

        alerts.sort((a, b) => {
            if (a.isBeyondGracePeriod !== b.isBeyondGracePeriod) return a.isBeyondGracePeriod ? -1 : 1;
            if (a.isInGracePeriod !== b.isInGracePeriod) return a.isInGracePeriod ? -1 : 1;
            return a.daysRemaining - b.daysRemaining;
        });

        const summary = {
            totalAlerts: alerts.length,
            expired: alerts.filter((item) => item.isBeyondGracePeriod).length,
            inGrace: alerts.filter((item) => item.isInGracePeriod).length,
            critical: alerts.filter((item) => item.severity === 'critical').length,
            warning: alerts.filter((item) => item.severity === 'warning').length,
            info: alerts.filter((item) => item.severity === 'info').length,
            maintenance: maintenanceResult,
            notifications: notificationResult,
            windowDays,
            warningDays: SUBSCRIPTION_WARNING_DAYS,
            graceDays: SUBSCRIPTION_GRACE_DAYS,
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
