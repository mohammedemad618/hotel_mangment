'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CalendarClock,
    Clock3,
    Loader2,
    RefreshCcw,
    Search,
    ShieldAlert,
} from 'lucide-react';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';

type Plan = 'free' | 'basic' | 'premium' | 'enterprise' | 'all';
type StateFilter = 'all' | 'healthy' | 'warning' | 'grace' | 'suspended' | 'cancelled';

interface SubscriptionItem {
    hotelId: string;
    hotelName: string;
    email: string;
    phone: string;
    city: string;
    plan: Exclude<Plan, 'all'>;
    status: 'active' | 'suspended' | 'cancelled' | string;
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

interface Summary {
    total: number;
    healthy: number;
    warning: number;
    grace: number;
    suspended: number;
    cancelled: number;
    pendingRenewals: number;
    expiringIn3Days: number;
    graceDays: number;
    warningDays: number;
    maintenance: {
        updatedCount: number;
        affectedIds: string[];
    };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

const planLabels: Record<Exclude<Plan, 'all'>, string> = {
    free: 'مجاني',
    basic: 'أساسي',
    premium: 'احترافي',
    enterprise: 'مؤسسي',
};

const stateLabels: Record<StateFilter, string> = {
    all: 'الكل',
    healthy: 'سليم',
    warning: 'تنبيه قبل الانتهاء',
    grace: 'داخل مهلة السماح',
    suspended: 'متوقف',
    cancelled: 'ملغي',
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

function getHealthLabel(item: SubscriptionItem): { label: string; className: string } {
    if (item.status === 'cancelled') return { label: 'ملغي', className: 'badge-danger' };
    if (item.isBeyondGracePeriod || item.status === 'suspended') return { label: 'متوقف', className: 'badge-danger' };
    if (item.isInGracePeriod) return { label: 'مهلة سماح', className: 'badge-warning' };
    if (item.isWarningWindow) return { label: 'تنبيه 3 أيام', className: 'badge-warning' };
    return { label: 'سليم', className: 'badge-success' };
}

function getTimelineLabel(item: SubscriptionItem): string {
    if (item.status === 'cancelled') return 'اشتراك ملغي';
    if (item.isBeyondGracePeriod) {
        return `منتهي وتجاوز المهلة منذ ${item.daysPastEnd || 0} يوم`;
    }
    if (item.isInGracePeriod) {
        return `داخل مهلة السماح - متبقي ${item.daysUntilSuspension ?? 0} يوم للإيقاف`;
    }
    if (item.daysRemaining === null) return '-';
    if (item.daysRemaining === 0) return 'ينتهي اليوم';
    if (item.daysRemaining === 1) return 'ينتهي غدًا';
    return `متبقي ${item.daysRemaining} أيام`;
}

export default function SuperAdminSubscriptionsPage() {
    const [items, setItems] = useState<SubscriptionItem[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0,
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [runningMaintenance, setRunningMaintenance] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [plan, setPlan] = useState<Plan>('all');
    const [state, setState] = useState<StateFilter>('all');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);

    const loadData = useCallback(async (options?: { runMaintenance?: boolean; silent?: boolean }) => {
        const runMaintenance = Boolean(options?.runMaintenance);
        const silent = Boolean(options?.silent);

        if (runMaintenance) setRunningMaintenance(true);
        else if (silent) setRefreshing(true);
        else setLoading(true);

        setError(null);
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                plan,
                state,
                runMaintenance: runMaintenance ? 'true' : 'false',
            });
            if (search) params.set('search', search);

            const response = await fetchWithRefresh(`/api/super-admin/subscriptions?${params.toString()}`);
            const payload = await response.json();
            if (!response.ok) {
                setError(payload.error || 'تعذر تحميل مراقبة الاشتراكات');
                return false;
            }

            setItems(Array.isArray(payload.data) ? payload.data : []);
            setSummary(payload.summary || null);
            setPagination(
                payload.pagination || {
                    page,
                    limit,
                    total: 0,
                    pages: 0,
                }
            );

            if (runMaintenance) {
                const updatedCount = payload.summary?.maintenance?.updatedCount || 0;
                setSuccess(updatedCount > 0 ? `تم تعليق ${updatedCount} اشتراكًا متجاوزًا للمهلة` : 'لا توجد اشتراكات متجاوزة للمهلة للتعليق');
            }
            return true;
        } catch {
            setError('تعذر تحميل مراقبة الاشتراكات');
            return false;
        } finally {
            if (runMaintenance) setRunningMaintenance(false);
            else if (silent) setRefreshing(false);
            else setLoading(false);
        }
    }, [limit, page, plan, search, state]);

    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1);
            setSearch(searchInput.trim());
        }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        loadData({ runMaintenance: false, silent: false });
    }, [loadData]);

    const canGoPrev = pagination.page > 1;
    const canGoNext = pagination.page < Math.max(pagination.pages || 1, 1);

    const activePolicyText = useMemo(() => {
        const warning = summary?.warningDays ?? 3;
        const grace = summary?.graceDays ?? 3;
        return `سيتم إرسال تنبيه قبل ${warning} أيام من الانتهاء، وبعد الانتهاء توجد مهلة سماح ${grace} أيام قبل التعليق التلقائي.`;
    }, [summary?.graceDays, summary?.warningDays]);

    return (
        <div className="space-y-6">
            <section className="page-hero">
                <div className="page-hero-content flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">مراقبة الاشتراكات</h1>
                        <p className="mt-2 text-white/60">{activePolicyText}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => loadData({ runMaintenance: false, silent: true })} className="btn-secondary text-sm" disabled={refreshing}>
                            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCcw className="w-4 h-4" />تحديث</>}
                        </button>
                        <button type="button" className="btn-primary text-sm" onClick={() => loadData({ runMaintenance: true, silent: false })} disabled={runningMaintenance}>
                            {runningMaintenance ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <ShieldAlert className="w-4 h-4" />
                                    تشغيل الصيانة
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </section>

            {(error || success) && (
                <div className="space-y-2">
                    {error && <div className="p-3 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">{error}</div>}
                    {success && <div className="p-3 bg-success-500/10 border border-success-500/20 rounded-xl text-success-500 text-sm">{success}</div>}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                <div className="stat-card"><p className="text-xs text-white/50">الإجمالي</p><p className="text-lg font-semibold text-primary-300">{summary?.total || 0}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">سليم</p><p className="text-lg font-semibold text-success-500">{summary?.healthy || 0}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">تنبيه 3 أيام</p><p className="text-lg font-semibold text-warning-500">{summary?.warning || 0}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">مهلة سماح</p><p className="text-lg font-semibold text-warning-500">{summary?.grace || 0}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">متوقف</p><p className="text-lg font-semibold text-danger-500">{summary?.suspended || 0}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">ملغي</p><p className="text-lg font-semibold text-danger-500">{summary?.cancelled || 0}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">طلبات التجديد</p><p className="text-lg font-semibold text-accent-300">{summary?.pendingRenewals || 0}</p></div>
            </div>

            <div className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            className="input-compact w-full pr-9"
                            placeholder="بحث باسم الفندق أو البريد أو المدينة"
                        />
                    </div>

                    <select
                        value={plan}
                        onChange={(event) => {
                            setPage(1);
                            setPlan(event.target.value as Plan);
                        }}
                        className="input-compact min-w-[160px]"
                    >
                        <option value="all">كل الباقات</option>
                        <option value="free">مجاني</option>
                        <option value="basic">أساسي</option>
                        <option value="premium">احترافي</option>
                        <option value="enterprise">مؤسسي</option>
                    </select>

                    <select
                        value={state}
                        onChange={(event) => {
                            setPage(1);
                            setState(event.target.value as StateFilter);
                        }}
                        className="input-compact min-w-[200px]"
                    >
                        {Object.entries(stateLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>

                    <select
                        value={String(limit)}
                        onChange={(event) => {
                            const next = Number(event.target.value);
                            setPage(1);
                            setLimit(next);
                        }}
                        className="input-compact min-w-[110px]"
                    >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><div className="spinner w-10 h-10" /></div>
                ) : items.length === 0 ? (
                    <p className="text-white/60 text-center py-8">لا توجد بيانات مطابقة للفلاتر الحالية.</p>
                ) : (
                    <>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>الفندق</th>
                                        <th>الباقة</th>
                                        <th>حالة الاشتراك</th>
                                        <th>تاريخ الانتهاء</th>
                                        <th>مهلة السماح</th>
                                        <th>المؤشر الزمني</th>
                                        <th>طلبات التجديد</th>
                                        <th>مدير الفندق</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item) => {
                                        const health = getHealthLabel(item);
                                        return (
                                            <tr key={item.hotelId}>
                                                <td>
                                                    <p className="font-medium text-white">{item.hotelName}</p>
                                                    <p className="text-xs text-white/60" dir="ltr">{item.email}</p>
                                                    <p className="text-xs text-white/40">{item.city}</p>
                                                </td>
                                                <td>
                                                    <p className="text-sm text-white">{planLabels[item.plan] || item.plan}</p>
                                                    <p className="text-xs text-white/50">{item.status}</p>
                                                </td>
                                                <td>
                                                    <span className={`${health.className} inline-flex items-center gap-1`}>
                                                        {health.label}
                                                    </span>
                                                    <p className="text-[11px] text-white/50 mt-1">
                                                        {item.isActive ? 'حساب الفندق نشط' : 'حساب الفندق معلق'}
                                                    </p>
                                                </td>
                                                <td>
                                                    <p className="text-sm text-white">{formatDate(item.endDate)}</p>
                                                    <p className="text-xs text-white/50">آخر دفع: {formatDate(item.paymentDate)}</p>
                                                </td>
                                                <td>
                                                    <p className="text-sm text-white">{formatDate(item.graceEndDate)}</p>
                                                    <p className="text-xs text-white/50">المدة: {summary?.graceDays || 3} أيام</p>
                                                </td>
                                                <td>
                                                    <p className="text-sm text-white/80">{getTimelineLabel(item)}</p>
                                                    {item.isInGracePeriod && (
                                                        <p className="text-xs text-warning-500 mt-1">سيتم التعليق تلقائيًا عند انتهاء المهلة</p>
                                                    )}
                                                    {item.isBeyondGracePeriod && (
                                                        <p className="text-xs text-danger-500 mt-1">متجاوز للمهلة ويتطلب سداد وتجديد</p>
                                                    )}
                                                </td>
                                                <td>
                                                    {item.renewalRequest?.isPending ? (
                                                        <>
                                                            <span className="badge-primary">طلب قائم</span>
                                                            <p className="text-xs text-white/50 mt-1">
                                                                {formatDate(item.renewalRequest.requestedAt)}
                                                            </p>
                                                            {item.renewalRequest.note && (
                                                                <p className="text-xs text-white/60 mt-1 line-clamp-2">
                                                                    {item.renewalRequest.note}
                                                                </p>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-white/50">لا يوجد</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <p className="text-sm text-white">{item.owner.name || '-'}</p>
                                                    <p className="text-xs text-white/60" dir="ltr">{item.owner.email || '-'}</p>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                            <button
                                type="button"
                                className="btn-secondary text-xs"
                                disabled={!canGoPrev}
                                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                            >
                                السابق
                            </button>
                            <p className="text-xs text-white/60 flex items-center gap-1">
                                <CalendarClock className="w-3.5 h-3.5" />
                                صفحة {pagination.page} من {Math.max(pagination.pages || 1, 1)} - إجمالي {pagination.total}
                            </p>
                            <button
                                type="button"
                                className="btn-secondary text-xs"
                                disabled={!canGoNext}
                                onClick={() => setPage((prev) => prev + 1)}
                            >
                                التالي
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="surface-tile text-xs text-white/60 flex items-start gap-2">
                <Clock3 className="w-4 h-4 mt-0.5 text-warning-500" />
                <div>
                    <p>سياسة الاشتراك الحالية:</p>
                    <p>1. تنبيه آلي قبل {summary?.warningDays || 3} أيام من تاريخ الانتهاء.</p>
                    <p>2. مهلة سماح {summary?.graceDays || 3} أيام بعد الانتهاء.</p>
                    <p>3. عند تجاوز المهلة بدون سداد: يتم تعليق الاشتراك وإيقاف الحساب تلقائيًا.</p>
                </div>
            </div>
        </div>
    );
}
