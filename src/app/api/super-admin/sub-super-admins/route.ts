import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/core/db/connection';
import { AuditLog, Hotel, User } from '@/core/db/models';
import { withMainSuperAdmin, AuthContext } from '@/core/middleware/auth';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const DEFAULT_SORT_BY = 'riskScore';
const DEFAULT_SORT_ORDER = 'desc';

type StatusFilter = 'all' | 'active' | 'inactive';
type VerificationFilter = 'all' | 'verified' | 'pending';
type ActivityFilter = 'all' | 'has_activity' | 'no_activity';
type SortBy =
    | 'createdAt'
    | 'lastLogin'
    | 'operationsCount'
    | 'operationsInRange'
    | 'operations24h'
    | 'hotelsCreated'
    | 'accountsCreated'
    | 'lastActivityAt'
    | 'riskScore';
type SortOrder = 'asc' | 'desc';
type RiskLevel = 'low' | 'medium' | 'high';

interface RiskSummary {
    score: number;
    level: RiskLevel;
    flags: string[];
}

interface QueryOptions {
    page: number;
    limit: number;
    search: string;
    status: StatusFilter;
    verification: VerificationFilter;
    activity: ActivityFilter;
    sortBy: SortBy;
    sortOrder: SortOrder;
    fromDate: Date | null;
    toDate: Date | null;
}

interface StatsItem {
    hotelsCreated: number;
    accountsCreated: number;
    operationsCount: number;
    operationsInRange: number;
    operations24h: number;
    suspiciousOperations: number;
    lastActivityAt: Date | null;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDateValue(raw: string | null, endOfDay = false): Date | null {
    if (!raw) return null;

    // Date-only inputs from HTML date picker are normalized to full day range.
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const normalized = endOfDay ? `${raw}T23:59:59.999Z` : `${raw}T00:00:00.000Z`;
        const date = new Date(normalized);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
}

function parseQueryOptions(searchParams: URLSearchParams): QueryOptions | null {
    const page = clamp(Number.parseInt(searchParams.get('page') || '1', 10) || 1, 1, 100000);
    const limit = clamp(Number.parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT, 1, MAX_LIMIT);
    const search = (searchParams.get('search') || '').trim();

    const status = (searchParams.get('status') || 'all') as StatusFilter;
    const verification = (searchParams.get('verification') || 'all') as VerificationFilter;
    const activity = (searchParams.get('activity') || 'all') as ActivityFilter;
    const sortBy = (searchParams.get('sortBy') || DEFAULT_SORT_BY) as SortBy;
    const sortOrder = (searchParams.get('sortOrder') || DEFAULT_SORT_ORDER) as SortOrder;

    const allowedStatus = new Set<StatusFilter>(['all', 'active', 'inactive']);
    const allowedVerification = new Set<VerificationFilter>(['all', 'verified', 'pending']);
    const allowedActivity = new Set<ActivityFilter>(['all', 'has_activity', 'no_activity']);
    const allowedSortBy = new Set<SortBy>([
        'createdAt',
        'lastLogin',
        'operationsCount',
        'operationsInRange',
        'operations24h',
        'hotelsCreated',
        'accountsCreated',
        'lastActivityAt',
        'riskScore',
    ]);
    const allowedSortOrder = new Set<SortOrder>(['asc', 'desc']);

    if (
        !allowedStatus.has(status) ||
        !allowedVerification.has(verification) ||
        !allowedActivity.has(activity) ||
        !allowedSortBy.has(sortBy) ||
        !allowedSortOrder.has(sortOrder)
    ) {
        return null;
    }

    const fromDateRaw = searchParams.get('from');
    const toDateRaw = searchParams.get('to');
    const fromDate = parseDateValue(fromDateRaw, false);
    const toDate = parseDateValue(toDateRaw, true);

    if ((fromDateRaw && !fromDate) || (toDateRaw && !toDate)) {
        return null;
    }

    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
        return null;
    }

    return {
        page,
        limit,
        search,
        status,
        verification,
        activity,
        sortBy,
        sortOrder,
        fromDate,
        toDate,
    };
}

function toCountMap(items: Array<{ _id: unknown; count: number }>): Map<string, number> {
    return new Map(items.map((item) => [String(item._id), item.count]));
}

function calculateRisk(params: {
    isActive: boolean;
    isVerified: boolean;
    createdAt: Date | string;
    stats: StatsItem;
}): RiskSummary {
    const { isActive, isVerified, createdAt, stats } = params;
    const flags: string[] = [];
    let score = 0;

    if (!isVerified) {
        score += 30;
        flags.push('unverified_account');
    }

    if (stats.operations24h >= 80) {
        score += 35;
        flags.push('very_high_24h_activity');
    } else if (stats.operations24h >= 40) {
        score += 25;
        flags.push('high_24h_activity');
    } else if (stats.operations24h >= 20) {
        score += 12;
        flags.push('elevated_24h_activity');
    }

    if (stats.suspiciousOperations >= 8) {
        score += 30;
        flags.push('many_sensitive_actions');
    } else if (stats.suspiciousOperations >= 4) {
        score += 18;
        flags.push('sensitive_actions');
    } else if (stats.suspiciousOperations > 0) {
        score += 8;
        flags.push('few_sensitive_actions');
    }

    if (!isActive) {
        score += 8;
        flags.push('inactive_account');
    }

    const createdAtTime = new Date(createdAt).getTime();
    if (!Number.isNaN(createdAtTime) && Date.now() - createdAtTime < 7 * 24 * 60 * 60 * 1000 && stats.operations24h > 20) {
        score += 10;
        flags.push('new_account_high_activity');
    }

    if (!stats.lastActivityAt) {
        score += 6;
        flags.push('no_recorded_activity');
    } else if (Date.now() - stats.lastActivityAt.getTime() > 45 * 24 * 60 * 60 * 1000) {
        score += 6;
        flags.push('stale_activity');
    }

    const level: RiskLevel = score >= 70 ? 'high' : score >= 35 ? 'medium' : 'low';
    return { score, level, flags };
}

function toTimestamp(value?: Date | string | null): number {
    if (!value) return 0;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 0;
    return date.getTime();
}

async function listSubSuperAdmins(
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
    auth: AuthContext
) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const options = parseQueryOptions(searchParams);
        if (!options) {
            return NextResponse.json({ error: 'Invalid monitoring query params' }, { status: 400 });
        }

        const userFilter: Record<string, unknown> = {
            role: 'sub_super_admin',
        };

        if (options.status === 'active') userFilter.isActive = true;
        if (options.status === 'inactive') userFilter.isActive = false;
        if (options.verification === 'verified') userFilter['verification.isVerified'] = true;
        if (options.verification === 'pending') userFilter['verification.isVerified'] = false;

        if (options.search) {
            const safeSearch = escapeRegex(options.search);
            userFilter.$or = [
                { name: { $regex: safeSearch, $options: 'i' } },
                { email: { $regex: safeSearch, $options: 'i' } },
                { phone: { $regex: safeSearch, $options: 'i' } },
            ];
        }

        const subSuperAdmins = await User.find(userFilter)
            .select('name email phone isActive verification createdAt lastLogin')
            .sort({ createdAt: -1 })
            .lean();

        if (subSuperAdmins.length === 0) {
            return NextResponse.json({
                success: true,
                overview: {
                    totalSubAdmins: 0,
                    activeCount: 0,
                    verifiedCount: 0,
                    highRiskCount: 0,
                    mediumRiskCount: 0,
                    lowRiskCount: 0,
                    totals: {
                        hotelsCreated: 0,
                        accountsCreated: 0,
                        operationsCount: 0,
                        operationsInRange: 0,
                    },
                },
                data: [],
                pagination: {
                    page: options.page,
                    limit: options.limit,
                    total: 0,
                    pages: 0,
                },
                filters: {
                    ...options,
                },
            });
        }

        const subIds = subSuperAdmins.map((item) => item._id as mongoose.Types.ObjectId);
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const dateRangeMatch: Record<string, unknown> = {};
        if (options.fromDate) dateRangeMatch.$gte = options.fromDate;
        if (options.toDate) dateRangeMatch.$lte = options.toDate;
        const hasDateRange = Object.keys(dateRangeMatch).length > 0;

        const suspiciousActionRegex = /(delete|verify|role|permission|suspend|deactivate|reactivate)/i;

        const [
            hotelsByCreator,
            usersByCreator,
            allActionsByActor,
            actionsInRangeByActor,
            actions24hByActor,
            suspiciousByActor,
            recentLogsByActor,
        ] = await Promise.all([
            Hotel.aggregate([
                { $match: { createdBy: { $in: subIds } } },
                { $group: { _id: '$createdBy', count: { $sum: 1 } } },
            ]),
            User.aggregate([
                {
                    $match: {
                        createdBy: { $in: subIds },
                        role: { $nin: ['super_admin', 'sub_super_admin'] },
                    },
                },
                { $group: { _id: '$createdBy', count: { $sum: 1 } } },
            ]),
            AuditLog.aggregate([
                { $match: { actorId: { $in: subIds } } },
                {
                    $group: {
                        _id: '$actorId',
                        count: { $sum: 1 },
                        lastActivityAt: { $max: '$createdAt' },
                    },
                },
            ]),
            AuditLog.aggregate([
                {
                    $match: {
                        actorId: { $in: subIds },
                        ...(hasDateRange ? { createdAt: dateRangeMatch } : {}),
                    },
                },
                { $group: { _id: '$actorId', count: { $sum: 1 } } },
            ]),
            AuditLog.aggregate([
                {
                    $match: {
                        actorId: { $in: subIds },
                        createdAt: { $gte: last24h },
                    },
                },
                { $group: { _id: '$actorId', count: { $sum: 1 } } },
            ]),
            AuditLog.aggregate([
                {
                    $match: {
                        actorId: { $in: subIds },
                        action: { $regex: suspiciousActionRegex },
                    },
                },
                { $group: { _id: '$actorId', count: { $sum: 1 } } },
            ]),
            AuditLog.aggregate([
                { $match: { actorId: { $in: subIds } } },
                { $sort: { createdAt: -1 } },
                {
                    $group: {
                        _id: '$actorId',
                        recentActions: {
                            $push: {
                                _id: '$_id',
                                action: '$action',
                                entityType: '$entityType',
                                targetUserId: '$targetUserId',
                                targetHotelId: '$targetHotelId',
                                metadata: '$metadata',
                                createdAt: '$createdAt',
                            },
                        },
                    },
                },
                {
                    $project: {
                        recentActions: { $slice: ['$recentActions', 8] },
                    },
                },
            ]),
        ]);

        const hotelsMap = toCountMap(hotelsByCreator as Array<{ _id: unknown; count: number }>);
        const usersMap = toCountMap(usersByCreator as Array<{ _id: unknown; count: number }>);
        const inRangeMap = toCountMap(actionsInRangeByActor as Array<{ _id: unknown; count: number }>);
        const dailyMap = toCountMap(actions24hByActor as Array<{ _id: unknown; count: number }>);
        const suspiciousMap = toCountMap(suspiciousByActor as Array<{ _id: unknown; count: number }>);

        const operationsMap = new Map<string, { count: number; lastActivityAt: Date | null }>();
        (allActionsByActor as Array<{ _id: unknown; count: number; lastActivityAt?: Date | null }>).forEach((item) => {
            operationsMap.set(String(item._id), {
                count: item.count,
                lastActivityAt: item.lastActivityAt || null,
            });
        });

        const recentActionsMap = new Map<string, unknown[]>();
        (recentLogsByActor as Array<{ _id: unknown; recentActions: unknown[] }>).forEach((item) => {
            recentActionsMap.set(String(item._id), item.recentActions || []);
        });

        const items = subSuperAdmins.map((sub) => {
            const key = String(sub._id);
            const operations = operationsMap.get(key);

            const stats: StatsItem = {
                hotelsCreated: hotelsMap.get(key) || 0,
                accountsCreated: usersMap.get(key) || 0,
                operationsCount: operations?.count || 0,
                operationsInRange: inRangeMap.get(key) || 0,
                operations24h: dailyMap.get(key) || 0,
                suspiciousOperations: suspiciousMap.get(key) || 0,
                lastActivityAt: operations?.lastActivityAt || null,
            };

            const risk = calculateRisk({
                isActive: Boolean(sub.isActive),
                isVerified: Boolean(sub.verification?.isVerified),
                createdAt: sub.createdAt,
                stats,
            });

            return {
                ...sub,
                stats,
                risk,
                recentActions: recentActionsMap.get(key) || [],
            };
        });

        const activityFiltered = items.filter((item) => {
            if (options.activity === 'has_activity') return item.stats.operationsInRange > 0;
            if (options.activity === 'no_activity') return item.stats.operationsInRange === 0;
            return true;
        });

        const direction = options.sortOrder === 'asc' ? 1 : -1;
        activityFiltered.sort((a, b) => {
            const numericDiff = (x: number, y: number) => (x - y) * direction;
            switch (options.sortBy) {
                case 'createdAt':
                    return numericDiff(toTimestamp(a.createdAt), toTimestamp(b.createdAt));
                case 'lastLogin':
                    return numericDiff(toTimestamp(a.lastLogin), toTimestamp(b.lastLogin));
                case 'operationsCount':
                    return numericDiff(a.stats.operationsCount, b.stats.operationsCount);
                case 'operationsInRange':
                    return numericDiff(a.stats.operationsInRange, b.stats.operationsInRange);
                case 'operations24h':
                    return numericDiff(a.stats.operations24h, b.stats.operations24h);
                case 'hotelsCreated':
                    return numericDiff(a.stats.hotelsCreated, b.stats.hotelsCreated);
                case 'accountsCreated':
                    return numericDiff(a.stats.accountsCreated, b.stats.accountsCreated);
                case 'lastActivityAt':
                    return numericDiff(toTimestamp(a.stats.lastActivityAt), toTimestamp(b.stats.lastActivityAt));
                case 'riskScore':
                default:
                    return numericDiff(a.risk.score, b.risk.score);
            }
        });

        const total = activityFiltered.length;
        const pages = Math.ceil(total / options.limit);
        const start = (options.page - 1) * options.limit;
        const paginated = activityFiltered.slice(start, start + options.limit);

        const overview = {
            totalSubAdmins: activityFiltered.length,
            activeCount: activityFiltered.filter((item) => item.isActive).length,
            verifiedCount: activityFiltered.filter((item) => item.verification?.isVerified).length,
            highRiskCount: activityFiltered.filter((item) => item.risk.level === 'high').length,
            mediumRiskCount: activityFiltered.filter((item) => item.risk.level === 'medium').length,
            lowRiskCount: activityFiltered.filter((item) => item.risk.level === 'low').length,
            totals: {
                hotelsCreated: activityFiltered.reduce((acc, item) => acc + item.stats.hotelsCreated, 0),
                accountsCreated: activityFiltered.reduce((acc, item) => acc + item.stats.accountsCreated, 0),
                operationsCount: activityFiltered.reduce((acc, item) => acc + item.stats.operationsCount, 0),
                operationsInRange: activityFiltered.reduce((acc, item) => acc + item.stats.operationsInRange, 0),
            },
        };

        return NextResponse.json({
            success: true,
            overview,
            data: paginated,
            pagination: {
                page: options.page,
                limit: options.limit,
                total,
                pages,
            },
            filters: {
                search: options.search,
                status: options.status,
                verification: options.verification,
                activity: options.activity,
                sortBy: options.sortBy,
                sortOrder: options.sortOrder,
                from: options.fromDate ? options.fromDate.toISOString() : null,
                to: options.toDate ? options.toDate.toISOString() : null,
            },
        });
    } catch (error) {
        console.error('List sub super admins overview error:', error);
        return NextResponse.json(
            { error: 'Failed to load sub super admin monitoring' },
            { status: 500 }
        );
    }
}

export const GET = withMainSuperAdmin(listSubSuperAdmins);

