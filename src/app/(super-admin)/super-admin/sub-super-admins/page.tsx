'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Loader2,
    RefreshCcw,
    Search,
    ShieldAlert,
    ShieldCheck,
    ShieldX,
    UserCheck,
    UserX,
} from 'lucide-react';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';

type PlatformRole = 'super_admin' | 'sub_super_admin' | string;
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

interface MonitoringStats {
    hotelsCreated: number;
    accountsCreated: number;
    operationsCount: number;
    operationsInRange: number;
    operations24h: number;
    suspiciousOperations: number;
    lastActivityAt: string | null;
}

interface MonitoringRisk {
    score: number;
    level: RiskLevel;
    flags: string[];
}

interface RecentAction {
    _id: string;
    action: string;
    entityType: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

interface SubSuperAdminItem {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
    verification?: {
        isVerified?: boolean;
        verifiedAt?: string | null;
    };
    createdAt: string;
    lastLogin?: string | null;
    stats: MonitoringStats;
    risk: MonitoringRisk;
    recentActions: RecentAction[];
}

interface MonitoringOverview {
    totalSubAdmins: number;
    activeCount: number;
    verifiedCount: number;
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    totals: {
        hotelsCreated: number;
        accountsCreated: number;
        operationsCount: number;
        operationsInRange: number;
    };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

interface MonitoringResponse {
    success: boolean;
    overview?: MonitoringOverview;
    data?: SubSuperAdminItem[];
    pagination?: Pagination;
    error?: string;
}

interface ActivityItem {
    _id: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    targetUserId?: string | null;
    targetHotelId?: string | null;
    metadata?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    createdAt: string;
}

interface SummaryBucket {
    _id: string;
    count: number;
}

interface ActivitySummary {
    totalOperations: number;
    byAction: SummaryBucket[];
    byEntity: SummaryBucket[];
}

interface ActivityResponse {
    success: boolean;
    data?: ActivityItem[];
    summary?: ActivitySummary;
    pagination?: Pagination;
    error?: string;
}

interface OverviewFiltersState {
    search: string;
    status: StatusFilter;
    verification: VerificationFilter;
    activity: ActivityFilter;
    sortBy: SortBy;
    sortOrder: SortOrder;
    from: string;
    to: string;
    page: number;
    limit: number;
}

interface ActivityFiltersState {
    action: string;
    entityType: string;
    from: string;
    to: string;
    page: number;
    limit: number;
}

interface UserPatchBody {
    isActive?: boolean;
    isVerified?: boolean;
    adminNote?: string;
}

const sortOptions: Array<{ value: SortBy; label: string }> = [
    { value: 'riskScore', label: 'درجة المخاطر' },
    { value: 'operations24h', label: 'عمليات 24 ساعة' },
    { value: 'operationsInRange', label: 'عمليات المدى الزمني' },
    { value: 'operationsCount', label: 'إجمالي العمليات' },
    { value: 'hotelsCreated', label: 'الفنادق المنشأة' },
    { value: 'accountsCreated', label: 'الحسابات المنشأة' },
    { value: 'lastActivityAt', label: 'آخر نشاط' },
    { value: 'lastLogin', label: 'آخر دخول' },
    { value: 'createdAt', label: 'تاريخ الإنشاء' },
];

const riskLabels: Record<RiskLevel, string> = {
    low: 'منخفض',
    medium: 'متوسط',
    high: 'مرتفع',
};

const riskFlagLabels: Record<string, string> = {
    unverified_account: 'الحساب غير موثق',
    very_high_24h_activity: 'نشاط مرتفع جدا خلال 24 ساعة',
    high_24h_activity: 'نشاط مرتفع خلال 24 ساعة',
    elevated_24h_activity: 'نشاط أعلى من المعتاد',
    many_sensitive_actions: 'عدد كبير من الإجراءات الحساسة',
    sensitive_actions: 'إجراءات حساسة متعددة',
    few_sensitive_actions: 'إجراءات حساسة محدودة',
    inactive_account: 'الحساب غير نشط',
    new_account_high_activity: 'حساب جديد بنشاط مرتفع',
    no_recorded_activity: 'لا يوجد نشاط مسجل',
    stale_activity: 'آخر نشاط قديم',
};

const defaultOverviewFilters: OverviewFiltersState = {
    search: '',
    status: 'all',
    verification: 'all',
    activity: 'all',
    sortBy: 'riskScore',
    sortOrder: 'desc',
    from: '',
    to: '',
    page: 1,
    limit: 20,
};

const defaultActivityFilters: ActivityFiltersState = {
    action: '',
    entityType: '',
    from: '',
    to: '',
    page: 1,
    limit: 15,
};

function formatDate(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatDateTime(value?: string | null): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getRiskBadgeClass(level: RiskLevel): string {
    if (level === 'high') return 'badge-danger';
    if (level === 'medium') return 'badge-warning';
    return 'badge-success';
}

function resolveRiskFlag(flag: string): string {
    return riskFlagLabels[flag] || flag;
}

function jsonMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === 'object' && 'error' in payload) {
        const error = (payload as { error?: unknown }).error;
        if (typeof error === 'string' && error.trim()) {
            return error;
        }
    }
    return fallback;
}

function normalizeSummaryBuckets(values: unknown): SummaryBucket[] {
    if (!Array.isArray(values)) return [];
    return values
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const bucket = entry as { _id?: unknown; count?: unknown };
            const id = bucket._id;
            const count = bucket.count;
            if (typeof count !== 'number') return null;
            if (typeof id !== 'string' && id !== null && id !== undefined) return null;
            return { _id: id ? String(id) : '-', count };
        })
        .filter((entry): entry is SummaryBucket => Boolean(entry));
}

export default function SubSuperAdminsMonitoringPage() {
    const [currentRole, setCurrentRole] = useState<PlatformRole | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);

    const [filters, setFilters] = useState<OverviewFiltersState>(defaultOverviewFilters);
    const [searchInput, setSearchInput] = useState('');

    const [overview, setOverview] = useState<MonitoringOverview | null>(null);
    const [items, setItems] = useState<SubSuperAdminItem[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: defaultOverviewFilters.limit,
        total: 0,
        pages: 0,
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [adminNote, setAdminNote] = useState('');
    const [updatingAction, setUpdatingAction] = useState<string | null>(null);

    const [activityFilters, setActivityFilters] = useState<ActivityFiltersState>(defaultActivityFilters);
    const [activityDraft, setActivityDraft] = useState<ActivityFiltersState>(defaultActivityFilters);
    const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
    const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
    const [activityPagination, setActivityPagination] = useState<Pagination>({
        page: 1,
        limit: defaultActivityFilters.limit,
        total: 0,
        pages: 0,
    });
    const [activityLoading, setActivityLoading] = useState(false);

    const isMainSuperAdmin = currentRole === 'super_admin';

    const loadCurrentRole = useCallback(async () => {
        setRoleLoading(true);
        try {
            const response = await fetchWithRefresh('/api/auth/me');
            if (!response.ok) {
                setCurrentRole(null);
                return;
            }

            const payload = await response.json();
            setCurrentRole(payload?.user?.role || null);
        } catch {
            setCurrentRole(null);
        } finally {
            setRoleLoading(false);
        }
    }, []);

    const fetchOverview = useCallback(async (silent = false) => {
        if (!isMainSuperAdmin) return;

        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            const params = new URLSearchParams({
                page: String(filters.page),
                limit: String(filters.limit),
                sortBy: filters.sortBy,
                sortOrder: filters.sortOrder,
            });

            if (filters.search) params.set('search', filters.search);
            if (filters.status !== 'all') params.set('status', filters.status);
            if (filters.verification !== 'all') params.set('verification', filters.verification);
            if (filters.activity !== 'all') params.set('activity', filters.activity);
            if (filters.from) params.set('from', filters.from);
            if (filters.to) params.set('to', filters.to);

            const response = await fetchWithRefresh(`/api/super-admin/sub-super-admins?${params.toString()}`);
            const payload: MonitoringResponse = await response.json().catch(() => ({} as MonitoringResponse));

            if (!response.ok) {
                setError(jsonMessage(payload, 'تعذر تحميل بيانات مراقبة الصب سوبر أدمن'));
                return;
            }

            setItems(Array.isArray(payload.data) ? payload.data : []);
            setOverview(payload.overview || null);
            setPagination(
                payload.pagination || {
                    page: filters.page,
                    limit: filters.limit,
                    total: 0,
                    pages: 0,
                }
            );
        } catch {
            setError('تعذر تحميل بيانات مراقبة الصب سوبر أدمن');
        } finally {
            if (silent) {
                setRefreshing(false);
            } else {
                setLoading(false);
            }
        }
    }, [filters, isMainSuperAdmin]);

    const fetchActivity = useCallback(async (subSuperAdminId: string) => {
        if (!isMainSuperAdmin) return;

        setActivityLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: String(activityFilters.page),
                limit: String(activityFilters.limit),
            });

            if (activityFilters.action) params.set('action', activityFilters.action);
            if (activityFilters.entityType) params.set('entityType', activityFilters.entityType);
            if (activityFilters.from) params.set('from', activityFilters.from);
            if (activityFilters.to) params.set('to', activityFilters.to);

            const response = await fetchWithRefresh(
                `/api/super-admin/sub-super-admins/${subSuperAdminId}/activity?${params.toString()}`
            );
            const payload: ActivityResponse = await response.json().catch(() => ({} as ActivityResponse));

            if (!response.ok) {
                setError(jsonMessage(payload, 'تعذر تحميل سجل النشاط التفصيلي'));
                return;
            }

            setActivityItems(Array.isArray(payload.data) ? payload.data : []);
            setActivitySummary(
                payload.summary
                    ? {
                        totalOperations: payload.summary.totalOperations || 0,
                        byAction: normalizeSummaryBuckets(payload.summary.byAction),
                        byEntity: normalizeSummaryBuckets(payload.summary.byEntity),
                    }
                    : null
            );
            setActivityPagination(
                payload.pagination || {
                    page: activityFilters.page,
                    limit: activityFilters.limit,
                    total: 0,
                    pages: 0,
                }
            );
        } catch {
            setError('تعذر تحميل سجل النشاط التفصيلي');
        } finally {
            setActivityLoading(false);
        }
    }, [activityFilters, isMainSuperAdmin]);

    const patchSubSuperAdmin = useCallback(async (
        item: SubSuperAdminItem,
        changes: UserPatchBody,
        successMessage: string
    ) => {
        if (!isMainSuperAdmin) return;

        setUpdatingAction(`${item._id}:${Object.keys(changes).join('.')}`);
        setError(null);
        setSuccess(null);

        try {
            const body: UserPatchBody = { ...changes };
            const normalizedNote = adminNote.trim();
            if (normalizedNote) body.adminNote = normalizedNote;

            const response = await fetchWithRefresh(`/api/super-admin/users/${item._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                setError(jsonMessage(payload, 'فشل تحديث حساب الصب سوبر أدمن'));
                return;
            }

            setSuccess(successMessage);
            await fetchOverview(true);

            if (selectedId === item._id) {
                await fetchActivity(item._id);
            }
        } catch {
            setError('فشل تحديث حساب الصب سوبر أدمن');
        } finally {
            setUpdatingAction(null);
        }
    }, [adminNote, fetchActivity, fetchOverview, isMainSuperAdmin, selectedId]);

    useEffect(() => {
        loadCurrentRole();
    }, [loadCurrentRole]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setFilters((prev) => ({
                ...prev,
                search: searchInput.trim(),
                page: 1,
            }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        if (!isMainSuperAdmin) {
            setLoading(false);
            return;
        }

        fetchOverview(false);
    }, [fetchOverview, isMainSuperAdmin]);

    useEffect(() => {
        if (!selectedId || !isMainSuperAdmin) return;
        fetchActivity(selectedId);
    }, [fetchActivity, isMainSuperAdmin, selectedId]);

    useEffect(() => {
        if (!selectedId) return;
        if (!items.some((item) => item._id === selectedId)) {
            setSelectedId(null);
            setAdminNote('');
        }
    }, [items, selectedId]);

    useEffect(() => {
        if (!selectedId) {
            setActivityFilters({ ...defaultActivityFilters });
            setActivityDraft({ ...defaultActivityFilters });
            setActivityItems([]);
            setActivitySummary(null);
            setActivityPagination({
                page: 1,
                limit: defaultActivityFilters.limit,
                total: 0,
                pages: 0,
            });
        }
    }, [selectedId]);

    const selectedItem = useMemo(
        () => items.find((item) => item._id === selectedId) || null,
        [items, selectedId]
    );

    const resolvedOverview = useMemo<MonitoringOverview>(() => {
        if (overview) return overview;
        return {
            totalSubAdmins: items.length,
            activeCount: items.filter((item) => item.isActive).length,
            verifiedCount: items.filter((item) => item.verification?.isVerified).length,
            highRiskCount: items.filter((item) => item.risk?.level === 'high').length,
            mediumRiskCount: items.filter((item) => item.risk?.level === 'medium').length,
            lowRiskCount: items.filter((item) => item.risk?.level === 'low').length,
            totals: {
                hotelsCreated: items.reduce((acc, item) => acc + (item.stats?.hotelsCreated || 0), 0),
                accountsCreated: items.reduce((acc, item) => acc + (item.stats?.accountsCreated || 0), 0),
                operationsCount: items.reduce((acc, item) => acc + (item.stats?.operationsCount || 0), 0),
                operationsInRange: items.reduce((acc, item) => acc + (item.stats?.operationsInRange || 0), 0),
            },
        };
    }, [items, overview]);

    const selectedActionOptions = useMemo(() => {
        if (!activitySummary?.byAction?.length) return [];
        return activitySummary.byAction.map((bucket) => bucket._id).filter((value) => Boolean(value && value !== '-'));
    }, [activitySummary?.byAction]);

    const selectedEntityOptions = useMemo(() => {
        if (!activitySummary?.byEntity?.length) return [];
        return activitySummary.byEntity.map((bucket) => bucket._id).filter((value) => Boolean(value && value !== '-'));
    }, [activitySummary?.byEntity]);

    if (roleLoading) {
        return (
            <div className="flex justify-center py-16">
                <div className="spinner w-12 h-12" />
            </div>
        );
    }

    if (!isMainSuperAdmin) {
        return (
            <div className="card p-6">
                <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-warning-500 mt-1" />
                    <div>
                        <h1 className="text-lg font-semibold text-white">الوصول محدود</h1>
                        <p className="text-sm text-white/70 mt-1">
                            مراقبة الصب سوبر أدمن متاحة فقط لحساب السوبر أدمن الرئيسي.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="page-hero">
                <div className="page-hero-content flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">مراقبة الصب سوبر أدمن</h1>
                        <p className="mt-2 text-white/60">
                            مركز متابعة موحد للسوبر أدمن الرئيسي لمراجعة الأداء، المخاطر، وسجل العمليات بالكامل.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => fetchOverview(true)}
                        disabled={refreshing}
                    >
                        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                        تحديث البيانات
                    </button>
                </div>
            </section>

            {(error || success) && (
                <div className="space-y-2">
                    {error && (
                        <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-success-500/10 border border-success-500/20 rounded-xl text-success-500 text-sm">
                            {success}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
                <div className="stat-card">
                    <p className="text-xs text-white/50">إجمالي الحسابات</p>
                    <p className="text-lg font-semibold text-primary-300">{resolvedOverview.totalSubAdmins}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">حسابات نشطة</p>
                    <p className="text-lg font-semibold text-success-500">{resolvedOverview.activeCount}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">حسابات موثقة</p>
                    <p className="text-lg font-semibold text-accent-300">{resolvedOverview.verifiedCount}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">مخاطر مرتفعة</p>
                    <p className="text-lg font-semibold text-danger-500">{resolvedOverview.highRiskCount}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">مخاطر متوسطة</p>
                    <p className="text-lg font-semibold text-warning-500">{resolvedOverview.mediumRiskCount}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">فنادق منشأة</p>
                    <p className="text-lg font-semibold text-primary-300">{resolvedOverview.totals.hotelsCreated}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">حسابات منشأة</p>
                    <p className="text-lg font-semibold text-primary-300">{resolvedOverview.totals.accountsCreated}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">عمليات بالنطاق</p>
                    <p className="text-lg font-semibold text-primary-300">{resolvedOverview.totals.operationsInRange}</p>
                </div>
            </div>

            <div className="filter-shell space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-2">
                    <div className="relative xl:col-span-3">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            className="input-compact w-full pr-9"
                            placeholder="بحث بالاسم أو البريد أو الهاتف"
                        />
                    </div>
                    <select
                        value={filters.status}
                        onChange={(event) =>
                            setFilters((prev) => ({
                                ...prev,
                                status: event.target.value as StatusFilter,
                                page: 1,
                            }))
                        }
                        className="input-compact xl:col-span-1"
                    >
                        <option value="all">كل الحالات</option>
                        <option value="active">نشط</option>
                        <option value="inactive">غير نشط</option>
                    </select>
                    <select
                        value={filters.verification}
                        onChange={(event) =>
                            setFilters((prev) => ({
                                ...prev,
                                verification: event.target.value as VerificationFilter,
                                page: 1,
                            }))
                        }
                        className="input-compact xl:col-span-2"
                    >
                        <option value="all">كل حالات التحقق</option>
                        <option value="verified">موثق</option>
                        <option value="pending">بانتظار التحقق</option>
                    </select>
                    <select
                        value={filters.activity}
                        onChange={(event) =>
                            setFilters((prev) => ({
                                ...prev,
                                activity: event.target.value as ActivityFilter,
                                page: 1,
                            }))
                        }
                        className="input-compact xl:col-span-2"
                    >
                        <option value="all">كل مستويات النشاط</option>
                        <option value="has_activity">لديه نشاط</option>
                        <option value="no_activity">بدون نشاط</option>
                    </select>
                    <input
                        type="date"
                        value={filters.from}
                        onChange={(event) =>
                            setFilters((prev) => ({
                                ...prev,
                                from: event.target.value,
                                page: 1,
                            }))
                        }
                        className="input-compact xl:col-span-1"
                    />
                    <input
                        type="date"
                        value={filters.to}
                        onChange={(event) =>
                            setFilters((prev) => ({
                                ...prev,
                                to: event.target.value,
                                page: 1,
                            }))
                        }
                        className="input-compact xl:col-span-1"
                    />
                    <select
                        value={filters.sortBy}
                        onChange={(event) =>
                            setFilters((prev) => ({
                                ...prev,
                                sortBy: event.target.value as SortBy,
                                page: 1,
                            }))
                        }
                        className="input-compact xl:col-span-1"
                    >
                        {sortOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.sortOrder}
                        onChange={(event) =>
                            setFilters((prev) => ({
                                ...prev,
                                sortOrder: event.target.value as SortOrder,
                                page: 1,
                            }))
                        }
                        className="input-compact xl:col-span-1"
                    >
                        <option value="desc">تنازلي</option>
                        <option value="asc">تصاعدي</option>
                    </select>
                </div>

                <div className="flex flex-wrap gap-2 justify-between items-center">
                    <div className="text-xs text-white/60">
                        عرض {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1} -{' '}
                        {Math.min(pagination.page * pagination.limit, pagination.total)} من {pagination.total}
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={filters.limit}
                            onChange={(event) =>
                                setFilters((prev) => ({
                                    ...prev,
                                    limit: Number(event.target.value),
                                    page: 1,
                                }))
                            }
                            className="input-compact text-xs"
                        >
                            <option value={10}>10 / صفحة</option>
                            <option value={20}>20 / صفحة</option>
                            <option value={50}>50 / صفحة</option>
                        </select>
                        <button
                            type="button"
                            className="btn-secondary text-xs"
                            onClick={() => {
                                setSearchInput('');
                                setFilters({ ...defaultOverviewFilters });
                            }}
                        >
                            إعادة ضبط
                        </button>
                    </div>
                </div>
            </div>

            <div className={`grid gap-4 ${selectedItem ? 'xl:grid-cols-3' : 'grid-cols-1'}`}>
                <div className={selectedItem ? 'xl:col-span-2 card p-4 space-y-4' : 'card p-4 space-y-4'}>
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="spinner w-10 h-10" />
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-white/60 text-center py-10">لا توجد حسابات صب سوبر أدمن مطابقة للفلاتر.</p>
                    ) : (
                        <>
                            <div className="table-container">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>الحساب</th>
                                            <th>الحالة</th>
                                            <th>التحقق</th>
                                            <th>المخاطر</th>
                                            <th>الإحصائيات</th>
                                            <th>آخر نشاط</th>
                                            <th>إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item) => {
                                            const isVerified = Boolean(item.verification?.isVerified);
                                            const toggleVerifyLabel = isVerified ? 'إلغاء التحقق' : 'توثيق';
                                            const toggleStatusLabel = item.isActive ? 'تعطيل' : 'تفعيل';
                                            const isVerifyUpdating = updatingAction === `${item._id}:isVerified`;
                                            const isStatusUpdating = updatingAction === `${item._id}:isActive`;

                                            return (
                                                <tr key={item._id}>
                                                    <td>
                                                        <p className="font-medium text-white">{item.name}</p>
                                                        <p className="text-xs text-white/60" dir="ltr">
                                                            {item.email}
                                                        </p>
                                                        <p className="text-xs text-white/50">{item.phone || '-'}</p>
                                                    </td>
                                                    <td>
                                                        {item.isActive ? (
                                                            <span className="badge-success inline-flex items-center gap-1">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                نشط
                                                            </span>
                                                        ) : (
                                                            <span className="badge-danger inline-flex items-center gap-1">
                                                                <UserX className="w-3 h-3" />
                                                                غير نشط
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {isVerified ? (
                                                            <span className="badge-success inline-flex items-center gap-1">
                                                                <ShieldCheck className="w-3 h-3" />
                                                                موثق
                                                            </span>
                                                        ) : (
                                                            <span className="badge-warning inline-flex items-center gap-1">
                                                                <ShieldX className="w-3 h-3" />
                                                                بانتظار التحقق
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`${getRiskBadgeClass(item.risk.level)} inline-flex items-center gap-1`}>
                                                            <AlertTriangle className="w-3 h-3" />
                                                            {riskLabels[item.risk.level]} ({item.risk.score})
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="text-xs text-white/80 space-y-1">
                                                            <p>فنادق: {item.stats.hotelsCreated}</p>
                                                            <p>حسابات: {item.stats.accountsCreated}</p>
                                                            <p>عمليات: {item.stats.operationsInRange}</p>
                                                            <p>24 ساعة: {item.stats.operations24h}</p>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="text-xs text-white/70 space-y-1">
                                                            <p>آخر دخول: {formatDateTime(item.lastLogin)}</p>
                                                            <p>آخر عملية: {formatDateTime(item.stats.lastActivityAt)}</p>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="flex flex-wrap gap-1">
                                                            <button
                                                                type="button"
                                                                className="btn-secondary text-xs"
                                                                onClick={() => setSelectedId(item._id)}
                                                            >
                                                                <Activity className="w-3.5 h-3.5" />
                                                                تفاصيل
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn-secondary text-xs"
                                                                onClick={() =>
                                                                    patchSubSuperAdmin(
                                                                        item,
                                                                        { isVerified: !isVerified },
                                                                        isVerified
                                                                            ? 'تم إلغاء توثيق الحساب'
                                                                            : 'تم توثيق الحساب'
                                                                    )
                                                                }
                                                                disabled={isVerifyUpdating || Boolean(updatingAction)}
                                                            >
                                                                {isVerifyUpdating ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <ShieldCheck className="w-3.5 h-3.5" />
                                                                )}
                                                                {toggleVerifyLabel}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="btn-secondary text-xs"
                                                                onClick={() =>
                                                                    patchSubSuperAdmin(
                                                                        item,
                                                                        { isActive: !item.isActive },
                                                                        item.isActive
                                                                            ? 'تم تعطيل الحساب'
                                                                            : 'تم تفعيل الحساب'
                                                                    )
                                                                }
                                                                disabled={isStatusUpdating || Boolean(updatingAction)}
                                                            >
                                                                {isStatusUpdating ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : item.isActive ? (
                                                                    <UserX className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <UserCheck className="w-3.5 h-3.5" />
                                                                )}
                                                                {toggleStatusLabel}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    className="btn-secondary text-xs"
                                    disabled={pagination.page <= 1}
                                    onClick={() =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            page: Math.max(prev.page - 1, 1),
                                        }))
                                    }
                                >
                                    السابق
                                </button>
                                <p className="text-xs text-white/60">
                                    صفحة {pagination.page} من {Math.max(pagination.pages || 1, 1)}
                                </p>
                                <button
                                    type="button"
                                    className="btn-secondary text-xs"
                                    disabled={pagination.page >= Math.max(pagination.pages, 1)}
                                    onClick={() =>
                                        setFilters((prev) => ({
                                            ...prev,
                                            page: prev.page + 1,
                                        }))
                                    }
                                >
                                    التالي
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {selectedItem && (
                    <div className="card p-4 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h2 className="text-base font-semibold text-white">{selectedItem.name}</h2>
                                <p className="text-xs text-white/60" dir="ltr">{selectedItem.email}</p>
                            </div>
                            <button
                                type="button"
                                className="btn-secondary text-xs"
                                onClick={() => {
                                    setSelectedId(null);
                                    setAdminNote('');
                                }}
                            >
                                إغلاق
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="surface-tile">
                                <p className="text-xs text-white/60">الحالة</p>
                                <p className="text-sm font-medium text-white">
                                    {selectedItem.isActive ? 'نشط' : 'غير نشط'}
                                </p>
                            </div>
                            <div className="surface-tile">
                                <p className="text-xs text-white/60">التحقق</p>
                                <p className="text-sm font-medium text-white">
                                    {selectedItem.verification?.isVerified ? 'موثق' : 'بانتظار التحقق'}
                                </p>
                            </div>
                            <div className="surface-tile">
                                <p className="text-xs text-white/60">درجة المخاطر</p>
                                <p className="text-sm font-medium text-white">
                                    {riskLabels[selectedItem.risk.level]} ({selectedItem.risk.score})
                                </p>
                            </div>
                            <div className="surface-tile">
                                <p className="text-xs text-white/60">آخر نشاط</p>
                                <p className="text-sm font-medium text-white">
                                    {formatDateTime(selectedItem.stats.lastActivityAt)}
                                </p>
                            </div>
                        </div>

                        <div className="surface-tile space-y-2">
                            <p className="text-xs text-white/60">مؤشرات المخاطر</p>
                            {selectedItem.risk.flags.length === 0 ? (
                                <p className="text-xs text-white/50">لا توجد مؤشرات إضافية</p>
                            ) : (
                                <div className="flex flex-wrap gap-1">
                                    {selectedItem.risk.flags.map((flag) => (
                                        <span key={flag} className="badge-warning">
                                            {resolveRiskFlag(flag)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-white/60 block">
                                ملاحظة إدارية (اختياري - تسجل في الـ Audit Log)
                            </label>
                            <textarea
                                value={adminNote}
                                onChange={(event) => setAdminNote(event.target.value)}
                                className="input-compact w-full min-h-[84px] resize-y"
                                placeholder="سبب التعديل أو ملاحظة المتابعة..."
                            />
                            <div className="flex flex-wrap gap-1">
                                <button
                                    type="button"
                                    className="btn-secondary text-xs"
                                    onClick={() =>
                                        patchSubSuperAdmin(
                                            selectedItem,
                                            { isVerified: !Boolean(selectedItem.verification?.isVerified) },
                                            selectedItem.verification?.isVerified
                                                ? 'تم إلغاء توثيق الحساب'
                                                : 'تم توثيق الحساب'
                                        )
                                    }
                                    disabled={Boolean(updatingAction)}
                                >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    {selectedItem.verification?.isVerified ? 'إلغاء التحقق' : 'توثيق الحساب'}
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary text-xs"
                                    onClick={() =>
                                        patchSubSuperAdmin(
                                            selectedItem,
                                            { isActive: !selectedItem.isActive },
                                            selectedItem.isActive ? 'تم تعطيل الحساب' : 'تم تفعيل الحساب'
                                        )
                                    }
                                    disabled={Boolean(updatingAction)}
                                >
                                    {selectedItem.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                    {selectedItem.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                                </button>
                            </div>
                        </div>

                        <div className="surface-tile space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-white/60">آخر العمليات المختصرة</p>
                                <Clock3 className="w-4 h-4 text-white/40" />
                            </div>
                            {selectedItem.recentActions?.length ? (
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                    {selectedItem.recentActions.map((log) => (
                                        <div key={log._id} className="rounded-lg border border-white/10 p-2">
                                            <p className="text-xs text-white font-medium">{log.action}</p>
                                            <p className="text-[11px] text-white/60">{log.entityType}</p>
                                            <p className="text-[11px] text-white/50">{formatDateTime(log.createdAt)}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-white/50">لا توجد عمليات حديثة.</p>
                            )}
                        </div>

                        <div className="surface-tile space-y-3">
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-primary-300" />
                                <p className="text-sm font-medium text-white">سجل النشاط التفصيلي</p>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                                <select
                                    value={activityDraft.action}
                                    onChange={(event) =>
                                        setActivityDraft((prev) => ({ ...prev, action: event.target.value }))
                                    }
                                    className="input-compact w-full"
                                >
                                    <option value="">كل الإجراءات</option>
                                    {selectedActionOptions.map((action) => (
                                        <option key={action} value={action}>
                                            {action}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={activityDraft.entityType}
                                    onChange={(event) =>
                                        setActivityDraft((prev) => ({ ...prev, entityType: event.target.value }))
                                    }
                                    className="input-compact w-full"
                                >
                                    <option value="">كل الكيانات</option>
                                    {selectedEntityOptions.map((entityType) => (
                                        <option key={entityType} value={entityType}>
                                            {entityType}
                                        </option>
                                    ))}
                                </select>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        value={activityDraft.from}
                                        onChange={(event) =>
                                            setActivityDraft((prev) => ({ ...prev, from: event.target.value }))
                                        }
                                        className="input-compact w-full"
                                    />
                                    <input
                                        type="date"
                                        value={activityDraft.to}
                                        onChange={(event) =>
                                            setActivityDraft((prev) => ({ ...prev, to: event.target.value }))
                                        }
                                        className="input-compact w-full"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    <button
                                        type="button"
                                        className="btn-secondary text-xs"
                                        onClick={() =>
                                            setActivityFilters((prev) => ({
                                                ...prev,
                                                action: activityDraft.action,
                                                entityType: activityDraft.entityType,
                                                from: activityDraft.from,
                                                to: activityDraft.to,
                                                page: 1,
                                            }))
                                        }
                                    >
                                        تطبيق فلاتر النشاط
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-secondary text-xs"
                                        onClick={() => {
                                            setActivityDraft({ ...defaultActivityFilters });
                                            setActivityFilters({ ...defaultActivityFilters });
                                        }}
                                    >
                                        مسح الفلاتر
                                    </button>
                                </div>
                            </div>

                            {activitySummary && (
                                <div className="space-y-2">
                                    <p className="text-xs text-white/60">
                                        إجمالي العمليات: {activitySummary.totalOperations}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {activitySummary.byAction.slice(0, 5).map((entry) => (
                                            <span key={`action-${entry._id}`} className="badge-primary">
                                                {entry._id}: {entry.count}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activityLoading ? (
                                <div className="flex justify-center py-4">
                                    <div className="spinner w-8 h-8" />
                                </div>
                            ) : activityItems.length === 0 ? (
                                <p className="text-xs text-white/50 py-2">لا توجد عمليات ضمن الفلاتر الحالية.</p>
                            ) : (
                                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                    {activityItems.map((log) => (
                                        <div key={log._id} className="border border-white/10 rounded-lg p-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-xs font-medium text-white">{log.action}</p>
                                                <p className="text-[11px] text-white/50">{formatDateTime(log.createdAt)}</p>
                                            </div>
                                            <p className="text-[11px] text-white/60 mt-1">
                                                {log.entityType} {log.entityId ? `(${String(log.entityId).slice(-6)})` : ''}
                                            </p>
                                            {(log.ip || log.userAgent) && (
                                                <p className="text-[11px] text-white/40 mt-1">
                                                    {log.ip || '-'} {log.userAgent ? `- ${log.userAgent.slice(0, 42)}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    className="btn-secondary text-xs"
                                    disabled={activityPagination.page <= 1}
                                    onClick={() =>
                                        setActivityFilters((prev) => ({
                                            ...prev,
                                            page: Math.max(prev.page - 1, 1),
                                        }))
                                    }
                                >
                                    السابق
                                </button>
                                <p className="text-[11px] text-white/60">
                                    صفحة {activityPagination.page} من {Math.max(activityPagination.pages || 1, 1)}
                                </p>
                                <button
                                    type="button"
                                    className="btn-secondary text-xs"
                                    disabled={activityPagination.page >= Math.max(activityPagination.pages, 1)}
                                    onClick={() =>
                                        setActivityFilters((prev) => ({
                                            ...prev,
                                            page: prev.page + 1,
                                        }))
                                    }
                                >
                                    التالي
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
