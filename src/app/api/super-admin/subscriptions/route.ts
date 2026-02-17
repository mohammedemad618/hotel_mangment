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
import { escapeRegex, normalizeSearchTerm } from '@/core/security/input';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

type StateFilter = 'all' | 'healthy' | 'warning' | 'grace' | 'suspended' | 'cancelled';
type PlanFilter = 'all' | 'free' | 'basic' | 'premium' | 'enterprise';

interface SubscriptionItem {
    hotelId: string;
    hotelName: string;
    email: string;
    phone: string;
    city: string;
    plan: string;
    status: string;
    isActive: boolean;
    paymentDate: string | null;
    endDate: string | null;
    graceEndDate: string | null;
    daysRemaining: number | null;
    daysPastEnd: number | null;
    daysUntilSuspension: number | null;
    isWarningWindow: boolean;
    isInGracePeriod: boolean;
    isBeyondGracePeriod: boolean;
    renewalRequest: {
        isPending: boolean;
        requestedAt: string | null;
        note: string;
    };
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

function parsePositiveNumber(value: string | null, fallback: number, min: number, max: number): number {
    const parsed = Number.parseInt(value || String(fallback), 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

function parseState(value: string | null): StateFilter {
    const allowed = new Set<StateFilter>(['all', 'healthy', 'warning', 'grace', 'suspended', 'cancelled']);
    if (value && allowed.has(value as StateFilter)) return value as StateFilter;
    return 'all';
}

function parsePlan(value: string | null): PlanFilter {
    const allowed = new Set<PlanFilter>(['all', 'free', 'basic', 'premium', 'enterprise']);
    if (value && allowed.has(value as PlanFilter)) return value as PlanFilter;
    return 'all';
}

function matchState(item: SubscriptionItem, state: StateFilter): boolean {
    if (state === 'all') return true;
    if (state === 'cancelled') return item.status === 'cancelled';
    if (state === 'suspended') return item.status === 'suspended' || item.isBeyondGracePeriod;
    if (state === 'grace') return item.isInGracePeriod;
    if (state === 'warning') return item.isWarningWindow;
    if (state === 'healthy') {
        return (
            item.status === 'active' &&
            !item.isWarningWindow &&
            !item.isInGracePeriod &&
            !item.isBeyondGracePeriod
        );
    }
    return true;
}

async function listSubscriptions(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();
        const { searchParams } = new URL(request.url);

        const search = normalizeSearchTerm(searchParams.get('search'));
        const state = parseState(searchParams.get('state'));
        const plan = parsePlan(searchParams.get('plan'));
        const page = parsePositiveNumber(searchParams.get('page'), 1, 1, 100000);
        const limit = parsePositiveNumber(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT);
        const runMaintenance = searchParams.get('runMaintenance') === 'true';
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
                    action: 'subscription.monitoring.maintenance',
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

        const conditions: Record<string, unknown>[] = [];
        if (Object.keys(scopedFilter).length > 0) conditions.push(scopedFilter);
        if (plan !== 'all') conditions.push({ 'subscription.plan': plan });
        if (search) {
            const safeSearch = escapeRegex(search);
            conditions.push({
                $or: [
                    { name: { $regex: safeSearch, $options: 'i' } },
                    { email: { $regex: safeSearch, $options: 'i' } },
                    { phone: { $regex: safeSearch, $options: 'i' } },
                    { 'address.city': { $regex: safeSearch, $options: 'i' } },
                ],
            });
        }

        const filter = conditions.length > 0 ? { $and: conditions } : {};

        const hotels = await Hotel.find(filter)
            .select('name email phone address.city subscription isActive')
            .sort({ 'subscription.endDate': 1, createdAt: -1 })
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

        const allItems: SubscriptionItem[] = hotels.map((hotel) => {
            const timeline = getSubscriptionTimeline(
                hotel.subscription?.endDate || null,
                now,
                SUBSCRIPTION_WARNING_DAYS,
                SUBSCRIPTION_GRACE_DAYS
            );
            const owner = ownerByHotel.get(hotel._id.toString());
            const renewalRequest = hotel.subscription?.renewalRequest;

            return {
                hotelId: hotel._id.toString(),
                hotelName: hotel.name,
                email: hotel.email,
                phone: hotel.phone,
                city: hotel.address?.city || '-',
                plan: hotel.subscription?.plan || 'free',
                status: hotel.subscription?.status || 'active',
                isActive: Boolean(hotel.isActive),
                paymentDate: hotel.subscription?.paymentDate ? new Date(hotel.subscription.paymentDate).toISOString() : null,
                endDate: timeline.endDate ? timeline.endDate.toISOString() : null,
                graceEndDate: timeline.graceEndDate ? timeline.graceEndDate.toISOString() : null,
                daysRemaining: timeline.daysRemaining,
                daysPastEnd: timeline.daysPastEnd,
                daysUntilSuspension: timeline.daysUntilSuspension,
                isWarningWindow: timeline.isWarningWindow,
                isInGracePeriod: timeline.isInGracePeriod,
                isBeyondGracePeriod: timeline.isBeyondGracePeriod,
                renewalRequest: {
                    isPending: Boolean(renewalRequest?.isPending),
                    requestedAt: renewalRequest?.requestedAt
                        ? new Date(renewalRequest.requestedAt).toISOString()
                        : null,
                    note: renewalRequest?.note || '',
                },
                owner: {
                    id: owner?._id?.toString() || null,
                    name: owner?.name || '-',
                    email: owner?.email || '-',
                    phone: owner?.phone || '-',
                    isActive: typeof owner?.isActive === 'boolean' ? owner.isActive : null,
                },
            };
        });

        const filteredItems = allItems.filter((item) => matchState(item, state));
        const total = filteredItems.length;
        const pages = Math.ceil(total / limit);
        const start = (page - 1) * limit;
        const data = filteredItems.slice(start, start + limit);

        const summary = {
            total: allItems.length,
            healthy: allItems.filter((item) => matchState(item, 'healthy')).length,
            warning: allItems.filter((item) => matchState(item, 'warning')).length,
            grace: allItems.filter((item) => matchState(item, 'grace')).length,
            suspended: allItems.filter((item) => matchState(item, 'suspended')).length,
            cancelled: allItems.filter((item) => matchState(item, 'cancelled')).length,
            pendingRenewals: allItems.filter((item) => item.renewalRequest.isPending).length,
            expiringIn3Days: allItems.filter((item) => item.daysRemaining !== null && item.daysRemaining >= 0 && item.daysRemaining <= SUBSCRIPTION_WARNING_DAYS).length,
            graceDays: SUBSCRIPTION_GRACE_DAYS,
            warningDays: SUBSCRIPTION_WARNING_DAYS,
            maintenance: maintenanceResult,
            notifications: notificationResult,
        };

        return NextResponse.json({
            success: true,
            summary,
            filters: {
                search: search || '',
                plan,
                state,
            },
            pagination: {
                page,
                limit,
                total,
                pages,
            },
            data,
        });
    } catch (error) {
        console.error('List subscriptions monitoring error:', error);
        return NextResponse.json(
            { error: 'Failed to load subscriptions monitoring' },
            { status: 500 }
        );
    }
}

export const GET = withSuperAdmin(listSubscriptions);
