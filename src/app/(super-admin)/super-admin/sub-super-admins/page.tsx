'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle, Loader2, RefreshCcw, ShieldCheck, ShieldX, UserCog, XCircle } from 'lucide-react';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';

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
    lastLogin?: string;
    stats: {
        hotelsCreated: number;
        accountsCreated: number;
        operationsCount: number;
    };
    recentActions: RecentAction[];
}

function formatDate(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatDateTime(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function SubSuperAdminsAuditPage() {
    const [currentRole, setCurrentRole] = useState<string | null>(null);
    const [items, setItems] = useState<SubSuperAdminItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchCurrentRole = async () => {
        try {
            const response = await fetchWithRefresh('/api/auth/me');
            if (!response.ok) return;
            const payload = await response.json();
            setCurrentRole(payload?.user?.role || null);
        } catch {
            setCurrentRole(null);
        }
    };

    const fetchOverview = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetchWithRefresh('/api/super-admin/sub-super-admins');
            const payload = await response.json();
            if (!response.ok) {
                setError(payload.error || 'تعذر تحميل بيانات المتابعة');
                return;
            }
            setItems(Array.isArray(payload.data) ? payload.data : []);
        } catch {
            setError('تعذر تحميل بيانات المتابعة');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCurrentRole();
        fetchOverview();
    }, []);

    const stats = useMemo(() => {
        const total = items.length;
        const verified = items.filter((item) => item.verification?.isVerified).length;
        const active = items.filter((item) => item.isActive).length;
        const hotels = items.reduce((acc, item) => acc + (item.stats?.hotelsCreated || 0), 0);
        const accounts = items.reduce((acc, item) => acc + (item.stats?.accountsCreated || 0), 0);
        const operations = items.reduce((acc, item) => acc + (item.stats?.operationsCount || 0), 0);
        return { total, verified, active, hotels, accounts, operations };
    }, [items]);

    const patchSubUser = async (id: string, body: Record<string, unknown>, successMessage: string) => {
        setUpdatingId(id);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const payload = await response.json();
            if (!response.ok) {
                setError(payload.error || 'فشل تحديث حساب الصب سوبر أدمن');
                return;
            }
            setSuccess(successMessage);
            await fetchOverview();
        } catch {
            setError('فشل تحديث حساب الصب سوبر أدمن');
        } finally {
            setUpdatingId(null);
        }
    };

    const isMainSuperAdmin = currentRole === 'super_admin';

    return (
        <div className="space-y-6">
            <section className="page-hero">
                <div className="page-hero-content flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">مراقبة الصب سوبر أدمن</h1>
                        <p className="mt-2 text-white/60">
                            متابعة الحسابات التابعة، التحقق منها، ومراجعة تفاصيل العمليات المنفذة.
                        </p>
                    </div>
                    <button type="button" onClick={fetchOverview} className="btn-secondary text-sm">
                        <RefreshCcw className="w-4 h-4" />
                        تحديث
                    </button>
                </div>
            </section>

            {!isMainSuperAdmin && (
                <div className="p-4 rounded-xl border border-warning-500/30 bg-warning-500/10 text-warning-500 text-sm">
                    فقط السوبر أدمن الرئيسي يمكنه تنفيذ إجراءات التحقق الكاملة.
                </div>
            )}

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

            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="stat-card">
                    <p className="text-xs text-white/50">عدد الصب سوبر أدمن</p>
                    <p className="text-lg font-semibold text-primary-300">{stats.total}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">موثق</p>
                    <p className="text-lg font-semibold text-success-500">{stats.verified}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">نشط</p>
                    <p className="text-lg font-semibold text-accent-300">{stats.active}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">فنادق تم إنشاؤها</p>
                    <p className="text-lg font-semibold text-primary-300">{stats.hotels}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">حسابات تم إنشاؤها</p>
                    <p className="text-lg font-semibold text-warning-500">{stats.accounts}</p>
                </div>
                <div className="stat-card">
                    <p className="text-xs text-white/50">عمليات مسجلة</p>
                    <p className="text-lg font-semibold text-danger-500">{stats.operations}</p>
                </div>
            </div>

            <div className="card p-5 space-y-4">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="spinner w-10 h-10" />
                    </div>
                ) : items.length === 0 ? (
                    <p className="text-white/60 text-center py-8">لا توجد حسابات صب سوبر أدمن.</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>الحساب</th>
                                    <th>التحقق</th>
                                    <th>الحالة</th>
                                    <th>الفنادق</th>
                                    <th>الحسابات</th>
                                    <th>العمليات</th>
                                    <th>تاريخ الإنشاء</th>
                                    <th>آخر دخول</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => {
                                    const isVerified = Boolean(item.verification?.isVerified);
                                    const isUpdating = updatingId === item._id;

                                    return (
                                        <Fragment key={item._id}>
                                            <tr>
                                                <td>
                                                    <p className="font-medium text-white">{item.name}</p>
                                                    <p className="text-xs text-white/60" dir="ltr">{item.email}</p>
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
                                                    {item.isActive ? (
                                                        <span className="badge-success inline-flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" />
                                                            نشط
                                                        </span>
                                                    ) : (
                                                        <span className="badge-danger inline-flex items-center gap-1">
                                                            <XCircle className="w-3 h-3" />
                                                            غير نشط
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-white/80">{item.stats?.hotelsCreated || 0}</td>
                                                <td className="text-white/80">{item.stats?.accountsCreated || 0}</td>
                                                <td className="text-white/80">{item.stats?.operationsCount || 0}</td>
                                                <td className="text-white/60">{formatDate(item.createdAt)}</td>
                                                <td className="text-white/60">{formatDateTime(item.lastLogin)}</td>
                                                <td>
                                                    <div className="flex flex-wrap gap-1">
                                                        <button
                                                            type="button"
                                                            className="btn-secondary text-xs"
                                                            disabled={!isMainSuperAdmin || isUpdating}
                                                            onClick={() =>
                                                                patchSubUser(
                                                                    item._id,
                                                                    { isVerified: !isVerified },
                                                                    !isVerified
                                                                        ? 'تم توثيق الحساب بنجاح'
                                                                        : 'تم إلغاء توثيق الحساب'
                                                                )
                                                            }
                                                        >
                                                                    {isUpdating ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <>
                                                                            <ShieldCheck className="w-3.5 h-3.5" />
                                                                    {isVerified ? 'إلغاء التحقق' : 'تحقق'}
                                                                        </>
                                                                    )}
                                                                </button>
                                                        <button
                                                            type="button"
                                                            className="btn-secondary text-xs"
                                                            disabled={!isMainSuperAdmin || isUpdating}
                                                            onClick={() =>
                                                                patchSubUser(
                                                                    item._id,
                                                                    { isActive: !item.isActive },
                                                                    item.isActive
                                                                        ? 'تم تعطيل الحساب'
                                                                        : 'تم تفعيل الحساب'
                                                                )
                                                            }
                                                        >
                                                            <UserCog className="w-3.5 h-3.5" />
                                                            {item.isActive ? 'تعطيل' : 'تفعيل'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn-secondary text-xs"
                                                            onClick={() => setExpandedId((prev) => (prev === item._id ? null : item._id))}
                                                        >
                                                            <Activity className="w-3.5 h-3.5" />
                                                            {expandedId === item._id ? 'إخفاء العمليات' : 'عرض العمليات'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {expandedId === item._id && (
                                                <tr key={`${item._id}-logs`}>
                                                    <td colSpan={9}>
                                                        <div className="surface-tile space-y-2">
                                                            <p className="text-sm font-medium text-white">آخر العمليات</p>
                                                            {item.recentActions?.length ? (
                                                                <div className="space-y-2">
                                                                    {item.recentActions.map((log) => (
                                                                        <div
                                                                            key={log._id}
                                                                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-white/70 border border-white/10 rounded-lg p-2"
                                                                        >
                                                                            <div>
                                                                                <span className="text-white/90 font-medium">{log.action}</span>
                                                                                <span className="mx-1">-</span>
                                                                                <span>{log.entityType}</span>
                                                                            </div>
                                                                            <span>{formatDateTime(log.createdAt)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-white/50">لا توجد عمليات مسجلة بعد.</p>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
