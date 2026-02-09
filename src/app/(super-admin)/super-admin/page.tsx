'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertTriangle,
    Building2,
    Plus,
    Search,
    Loader2,
    CheckCircle,
    XCircle,
    Users,
    RefreshCcw,
    Settings2,
    Pencil,
    ShieldCheck,
} from 'lucide-react';
import { registerHotelSchema, RegisterHotelInput } from '@/lib/validations';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';

type PlatformRole = 'super_admin' | 'sub_super_admin';
type Plan = 'free' | 'basic' | 'premium' | 'enterprise';
type SubscriptionStatus = 'active' | 'suspended' | 'cancelled';
type AlertSeverity = 'info' | 'warning' | 'critical' | 'expired';

interface HotelAdmin {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    isActive: boolean;
}

interface HotelItem {
    _id: string;
    name: string;
    email: string;
    phone: string;
    address?: { city?: string; country?: string };
    subscription?: {
        plan?: Plan;
        status?: SubscriptionStatus;
        paymentDate?: string | null;
        endDate?: string | null;
    };
    verification?: { isVerified?: boolean };
    createdBy?: { name?: string } | null;
    admin?: HotelAdmin | null;
    isActive: boolean;
    createdAt: string;
}

interface SubscriptionForm {
    hotelId: string;
    isActive: boolean;
    plan: Plan;
    status: SubscriptionStatus;
    paymentDate: string;
    endDate: string;
}

interface AdminForm {
    hotelId: string;
    userId: string;
    name: string;
    email: string;
    phone: string;
    isActive: boolean;
}

interface SubscriptionAlert {
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

interface AlertsSummary {
    totalAlerts: number;
    expired: number;
    critical: number;
    warning: number;
    info: number;
    maintenance: {
        updatedCount: number;
        affectedIds: string[];
    };
    windowDays: number;
}

const planLabels: Record<Plan, string> = {
    free: 'مجاني',
    basic: 'أساسي',
    premium: 'احترافي',
    enterprise: 'مؤسسي',
};

const statusLabels: Record<SubscriptionStatus, string> = {
    active: 'نشط',
    suspended: 'معلّق',
    cancelled: 'ملغي',
};

const alertLabels: Record<AlertSeverity, string> = {
    info: 'متابعة',
    warning: 'تنبيه',
    critical: 'حرج',
    expired: 'منتهي',
};

const toDateInput = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
};

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDaysRemaining = (daysRemaining: number) => {
    if (daysRemaining < 0) return `منتهي منذ ${Math.abs(daysRemaining)} يوم`;
    if (daysRemaining === 0) return 'ينتهي اليوم';
    if (daysRemaining === 1) return 'ينتهي غداً';
    return `متبقي ${daysRemaining} أيام`;
};

function alertBadgeClass(severity: AlertSeverity): string {
    if (severity === 'expired') return 'badge-danger';
    if (severity === 'critical') return 'badge-danger';
    if (severity === 'warning') return 'badge-warning';
    return 'badge-primary';
}

export default function SuperAdminPage() {
    const [role, setRole] = useState<PlatformRole | null>(null);
    const [hotels, setHotels] = useState<HotelItem[]>([]);
    const [alerts, setAlerts] = useState<SubscriptionAlert[]>([]);
    const [alertsSummary, setAlertsSummary] = useState<AlertsSummary | null>(null);
    const [alertsWindowDays, setAlertsWindowDays] = useState<number>(7);
    const [loading, setLoading] = useState(true);
    const [alertsLoading, setAlertsLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [savingSubscription, setSavingSubscription] = useState(false);
    const [savingAdmin, setSavingAdmin] = useState(false);
    const [runningMaintenance, setRunningMaintenance] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [planFilter, setPlanFilter] = useState<'all' | Plan>('all');
    const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionForm | null>(null);
    const [adminForm, setAdminForm] = useState<AdminForm | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<RegisterHotelInput>({ resolver: zodResolver(registerHotelSchema) });

    const isMainSuperAdmin = role === 'super_admin';

    const fetchMe = async () => {
        try {
            const response = await fetchWithRefresh('/api/auth/me');
            if (!response.ok) return;
            const data = await response.json();
            if (data.user?.role === 'super_admin' || data.user?.role === 'sub_super_admin') {
                setRole(data.user.role);
            }
        } catch {
            // layout handles auth
        }
    };

    const fetchHotels = async (searchValue = ''): Promise<boolean> => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '200' });
            if (searchValue) params.set('search', searchValue);
            const response = await fetchWithRefresh(`/api/super-admin/hotels?${params.toString()}`);
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'تعذر تحميل الفنادق');
                return false;
            }
            setHotels(Array.isArray(data.data) ? data.data : []);
            return true;
        } catch {
            setError('تعذر تحميل الفنادق');
            return false;
        } finally {
            setLoading(false);
        }
    };

    const fetchSubscriptionAlerts = useCallback(async (runMaintenance = false): Promise<boolean> => {
        setAlertsLoading(true);
        try {
            const params = new URLSearchParams({
                windowDays: String(alertsWindowDays),
                runMaintenance: runMaintenance ? 'true' : 'false',
            });
            const response = await fetchWithRefresh(`/api/super-admin/subscription-alerts?${params.toString()}`);
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'تعذر تحميل تنبيهات الاشتراكات');
                return false;
            }
            setAlerts(Array.isArray(data.data) ? data.data : []);
            setAlertsSummary(data.summary || null);
            return true;
        } catch {
            setError('تعذر تحميل تنبيهات الاشتراكات');
            return false;
        } finally {
            setAlertsLoading(false);
        }
    }, [alertsWindowDays]);

    useEffect(() => {
        fetchMe();
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        fetchHotels(search);
    }, [search]);

    useEffect(() => {
        fetchSubscriptionAlerts(false);
    }, [fetchSubscriptionAlerts]);

    const onCreateHotel = async (data: RegisterHotelInput) => {
        setError(null);
        setSuccess(null);
        setSubmitting(true);
        try {
            const response = await fetchWithRefresh('/api/super-admin/hotels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'فشل إنشاء الفندق');
                return;
            }
            setSuccess('تم إنشاء الفندق وحساب المدير بنجاح');
            reset();
            await fetchHotels(search);
            await fetchSubscriptionAlerts(false);
        } catch {
            setError('فشل الاتصال بالخادم');
        } finally {
            setSubmitting(false);
        }
    };

    const patchHotel = async (hotelId: string, payload: Record<string, unknown>) => {
        const response = await fetchWithRefresh(`/api/super-admin/hotels/${hotelId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'تعذر تحديث الفندق');
        setHotels((prev) => prev.map((h) => (h._id === hotelId ? result.data : h)));
    };

    const toggleHotel = async (hotel: HotelItem) => {
        setError(null);
        setSuccess(null);
        try {
            await patchHotel(hotel._id, { isActive: !hotel.isActive });
            setSuccess('تم تحديث حالة التفعيل');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'فشل تحديث حالة الفندق');
        }
    };

    const toggleVerify = async (hotel: HotelItem) => {
        setError(null);
        setSuccess(null);
        try {
            await patchHotel(hotel._id, { isVerified: !hotel.verification?.isVerified });
            setSuccess('تم تحديث حالة التحقق');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'فشل تحديث حالة التحقق');
        }
    };

    const openSubscription = (hotel: HotelItem) => {
        setSubscriptionForm({
            hotelId: hotel._id,
            isActive: hotel.isActive,
            plan: hotel.subscription?.plan || 'basic',
            status: hotel.subscription?.status || 'active',
            paymentDate: toDateInput(hotel.subscription?.paymentDate),
            endDate: toDateInput(hotel.subscription?.endDate),
        });
    };

    const saveSubscription = async () => {
        if (!subscriptionForm) return;
        setSavingSubscription(true);
        setError(null);
        setSuccess(null);
        try {
            await patchHotel(subscriptionForm.hotelId, {
                isActive: subscriptionForm.isActive,
                subscription: {
                    plan: subscriptionForm.plan,
                    status: subscriptionForm.status,
                    paymentDate: subscriptionForm.paymentDate || null,
                    endDate: subscriptionForm.endDate || null,
                },
            });
            setSubscriptionForm(null);
            await fetchSubscriptionAlerts(false);
            setSuccess('تم حفظ بيانات الاشتراك');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'فشل حفظ الاشتراك');
        } finally {
            setSavingSubscription(false);
        }
    };

    const openAdmin = (hotel: HotelItem) => {
        if (!hotel.admin) {
            setError('لا يوجد حساب مدير مرتبط بهذا الفندق');
            return;
        }
        setAdminForm({
            hotelId: hotel._id,
            userId: hotel.admin._id,
            name: hotel.admin.name,
            email: hotel.admin.email,
            phone: hotel.admin.phone || '',
            isActive: hotel.admin.isActive,
        });
    };

    const saveAdmin = async () => {
        if (!adminForm) return;
        setSavingAdmin(true);
        setError(null);
        setSuccess(null);
        try {
            const response = await fetchWithRefresh(`/api/super-admin/users/${adminForm.userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: adminForm.name,
                    email: adminForm.email,
                    phone: adminForm.phone.trim() || null,
                    isActive: adminForm.isActive,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'فشل تحديث حساب مدير الفندق');
            setSuccess('تم تحديث حساب مدير الفندق');
            setAdminForm(null);
            await fetchHotels(search);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'فشل تحديث حساب مدير الفندق');
        } finally {
            setSavingAdmin(false);
        }
    };

    const runMaintenanceNow = async () => {
        setRunningMaintenance(true);
        setError(null);
        try {
            const alertsOk = await fetchSubscriptionAlerts(true);
            const hotelsOk = await fetchHotels(search);
            if (alertsOk && hotelsOk) {
                setSuccess('تم تشغيل صيانة الاشتراكات بنجاح');
            }
        } catch {
            setError('فشل تشغيل صيانة الاشتراكات');
        } finally {
            setRunningMaintenance(false);
        }
    };

    const filteredHotels = useMemo(() => hotels.filter((hotel) => {
        if (statusFilter === 'active' && !hotel.isActive) return false;
        if (statusFilter === 'inactive' && hotel.isActive) return false;
        if (planFilter !== 'all' && (hotel.subscription?.plan || 'free') !== planFilter) return false;
        if (search && !`${hotel.name} ${hotel.email}`.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    }), [hotels, statusFilter, planFilter, search]);

    const stats = useMemo(() => ({
        total: hotels.length,
        active: hotels.filter((h) => h.isActive).length,
        verified: hotels.filter((h) => h.verification?.isVerified).length,
    }), [hotels]);

    return (
        <div className="space-y-6">
            <section className="page-hero">
                <div className="page-hero-content flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">لوحة إدارة الفنادق والاشتراكات</h1>
                        <p className="mt-2 text-white/60">إنشاء حسابات مالكي الفنادق، إدارة الاشتراكات، والتحقق من الحسابات والمرافق.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/super-admin/users" className="btn-secondary text-sm">
                            <Users className="w-4 h-4" />
                            إدارة المستخدمين
                        </Link>
                        {isMainSuperAdmin && (
                            <Link href="/super-admin/sub-super-admins" className="btn-secondary text-sm">
                                <ShieldCheck className="w-4 h-4" />
                                مراقبة الصب سوبر أدمن
                            </Link>
                        )}
                        <button type="button" onClick={() => fetchHotels(search)} className="btn-secondary text-sm">
                            <RefreshCcw className="w-4 h-4" />
                            تحديث الفنادق
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="stat-card"><p className="text-xs text-white/50">إجمالي الفنادق</p><p className="text-lg font-semibold text-primary-300">{stats.total}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">الحسابات النشطة</p><p className="text-lg font-semibold text-success-500">{stats.active}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">فنادق موثقة</p><p className="text-lg font-semibold text-accent-300">{stats.verified}</p></div>
            </div>

            <div className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-warning-500" />
                            تنبيهات الاشتراكات
                        </h2>
                        <p className="text-xs text-white/60 mt-1">متابعة الاشتراكات القريبة من الانتهاء مع تعليق تلقائي للحسابات المنتهية.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={alertsWindowDays}
                            onChange={(e) => setAlertsWindowDays(Number(e.target.value))}
                            className="input-compact text-sm min-w-[160px]"
                        >
                            <option value={3}>نافذة 3 أيام</option>
                            <option value={7}>نافذة 7 أيام</option>
                            <option value={14}>نافذة 14 يوم</option>
                            <option value={30}>نافذة 30 يوم</option>
                        </select>
                        <button type="button" onClick={() => fetchSubscriptionAlerts(false)} className="btn-secondary text-sm">
                            <RefreshCcw className="w-4 h-4" />
                            تحديث التنبيهات
                        </button>
                        <button type="button" className="btn-primary text-sm" onClick={runMaintenanceNow} disabled={runningMaintenance}>
                            {runningMaintenance ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Settings2 className="w-4 h-4" />
                                    تشغيل الصيانة
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">إجمالي التنبيهات</p>
                        <p className="text-lg font-semibold text-primary-300">{alertsSummary?.totalAlerts || 0}</p>
                    </div>
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">منتهية</p>
                        <p className="text-lg font-semibold text-danger-500">{alertsSummary?.expired || 0}</p>
                    </div>
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">حرجة</p>
                        <p className="text-lg font-semibold text-danger-500">{alertsSummary?.critical || 0}</p>
                    </div>
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">تنبيه</p>
                        <p className="text-lg font-semibold text-warning-500">{alertsSummary?.warning || 0}</p>
                    </div>
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">تم تعليقها بالصيانة</p>
                        <p className="text-lg font-semibold text-accent-300">{alertsSummary?.maintenance?.updatedCount || 0}</p>
                    </div>
                </div>

                {alertsLoading ? (
                    <div className="flex justify-center py-8"><div className="spinner w-9 h-9" /></div>
                ) : alerts.length === 0 ? (
                    <p className="text-white/60 text-center py-8">لا توجد اشتراكات ضمن نافذة التنبيه الحالية.</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>الفندق</th>
                                    <th>مدير الفندق</th>
                                    <th>الحالة</th>
                                    <th>تاريخ الانتهاء</th>
                                    <th>الوقت المتبقي</th>
                                    <th>تفاصيل</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map((alert) => (
                                    <tr key={`${alert.hotelId}-${alert.endDate}`}>
                                        <td>
                                            <p className="font-medium text-white">{alert.hotelName}</p>
                                            <p className="text-xs text-white/60" dir="ltr">{alert.email}</p>
                                        </td>
                                        <td>
                                            <p className="text-sm text-white">{alert.owner.name || '-'}</p>
                                            <p className="text-xs text-white/60" dir="ltr">{alert.owner.email || '-'}</p>
                                        </td>
                                        <td>
                                            <span className={`${alertBadgeClass(alert.severity)} inline-flex items-center gap-1`}>
                                                {alertLabels[alert.severity]}
                                            </span>
                                        </td>
                                        <td className="text-white/80">{formatDate(alert.endDate)}</td>
                                        <td className="text-white/70">{formatDaysRemaining(alert.daysRemaining)}</td>
                                        <td>
                                            <p className="text-xs text-white/60">حالة الاشتراك: {statusLabels[(alert.subscriptionStatus as SubscriptionStatus)] || alert.subscriptionStatus}</p>
                                            <p className="text-xs text-white/60">حالة الحساب: {alert.isActive ? 'نشط' : 'معلّق'}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Building2 className="w-5 h-5 text-primary-300" />إنشاء فندق جديد</h2>
                <form onSubmit={handleSubmit(onCreateHotel)} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <input {...register('hotelName')} className="input-compact w-full" placeholder="اسم الفندق" />
                    <input {...register('adminName')} className="input-compact w-full" placeholder="اسم المدير" />
                    <input {...register('email')} type="email" className="input-compact w-full" placeholder="البريد الإلكتروني" dir="ltr" />
                    <input {...register('phone')} className="input-compact w-full" placeholder="رقم الهاتف" dir="ltr" />
                    <input {...register('city')} className="input-compact w-full" placeholder="المدينة" />
                    <input {...register('country')} className="input-compact w-full" placeholder="الدولة" />
                    <div className="md:col-span-2 xl:col-span-2">
                        <input {...register('password')} type="password" className="input-compact w-full" placeholder="كلمة مرور المدير" dir="ltr" />
                    </div>
                    <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                        <button type="submit" className="btn-primary text-sm" disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />إنشاء الفندق</>}
                        </button>
                    </div>
                </form>
                {(errors.hotelName || errors.adminName || errors.email || errors.password) && (
                    <p className="text-xs text-danger-500">يرجى مراجعة الحقول المطلوبة قبل الحفظ.</p>
                )}
            </div>

            <div className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="input-compact w-full pr-9" placeholder="بحث باسم الفندق أو البريد الإلكتروني" />
                    </div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="input-compact min-w-[120px]">
                        <option value="all">كل الحالات</option><option value="active">نشط</option><option value="inactive">غير نشط</option>
                    </select>
                    <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)} className="input-compact min-w-[120px]">
                        <option value="all">كل الباقات</option><option value="free">مجاني</option><option value="basic">أساسي</option><option value="premium">احترافي</option><option value="enterprise">مؤسسي</option>
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><div className="spinner w-9 h-9" /></div>
                ) : filteredHotels.length === 0 ? (
                    <p className="text-white/60 text-center py-8">لا توجد فنادق مطابقة للفلاتر الحالية.</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>الفندق</th><th>المدير</th><th>الاشتراك</th><th>الدفع / الانتهاء</th><th>الحالة</th>{isMainSuperAdmin && <th>التحقق</th>}<th>إجراءات</th></tr></thead>
                            <tbody>
                                {filteredHotels.map((hotel) => (
                                    <tr key={hotel._id}>
                                        <td><p className="font-medium text-white">{hotel.name}</p><p className="text-xs text-white/50">{hotel.address?.city || '-'}</p></td>
                                        <td>{hotel.admin ? <><p className="font-medium text-white text-sm">{hotel.admin.name}</p><p className="text-xs text-white/60" dir="ltr">{hotel.admin.email}</p></> : <span className="text-xs text-warning-500">لا يوجد مدير</span>}</td>
                                        <td><p className="text-xs">{planLabels[hotel.subscription?.plan || 'free']}</p><p className="text-xs text-white/60">{statusLabels[hotel.subscription?.status || 'active']}</p></td>
                                        <td><p className="text-xs">الدفع: {formatDate(hotel.subscription?.paymentDate)}</p><p className="text-xs text-white/60">الانتهاء: {formatDate(hotel.subscription?.endDate)}</p></td>
                                        <td>{hotel.isActive ? <span className="badge-success inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" />نشط</span> : <span className="badge-danger inline-flex items-center gap-1"><XCircle className="w-3 h-3" />غير نشط</span>}</td>
                                        {isMainSuperAdmin && <td>{hotel.verification?.isVerified ? <span className="badge-success">موثق</span> : <span className="badge-warning">بانتظار التحقق</span>}</td>}
                                        <td>
                                            <div className="flex flex-wrap gap-1">
                                                <button className="btn-secondary text-xs" onClick={() => toggleHotel(hotel)}>{hotel.isActive ? 'تعطيل' : 'تفعيل'}</button>
                                                <button className="btn-secondary text-xs" onClick={() => openSubscription(hotel)}><Settings2 className="w-3.5 h-3.5" />الاشتراك</button>
                                                <button className="btn-secondary text-xs" onClick={() => openAdmin(hotel)}><Pencil className="w-3.5 h-3.5" />حساب المدير</button>
                                                {isMainSuperAdmin && <button className="btn-secondary text-xs" onClick={() => toggleVerify(hotel)}>{hotel.verification?.isVerified ? 'إلغاء التحقق' : 'تحقق'}</button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {subscriptionForm && (
                <div className="card p-5 space-y-3">
                    <h3 className="text-base font-semibold text-white">تعديل بيانات الاشتراك</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="surface-tile flex items-center justify-between text-sm">تفعيل الحساب<input type="checkbox" checked={subscriptionForm.isActive} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, isActive: e.target.checked } : prev)} /></label>
                        <select value={subscriptionForm.plan} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, plan: e.target.value as Plan } : prev)} className="input-compact w-full"><option value="free">مجاني</option><option value="basic">أساسي</option><option value="premium">احترافي</option><option value="enterprise">مؤسسي</option></select>
                        <select value={subscriptionForm.status} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, status: e.target.value as SubscriptionStatus } : prev)} className="input-compact w-full"><option value="active">نشط</option><option value="suspended">معلّق</option><option value="cancelled">ملغي</option></select>
                        <input type="date" value={subscriptionForm.paymentDate} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, paymentDate: e.target.value } : prev)} className="input-compact w-full" />
                        <input type="date" value={subscriptionForm.endDate} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, endDate: e.target.value } : prev)} className="input-compact w-full" />
                    </div>
                    <div className="flex justify-end gap-2"><button className="btn-secondary text-sm" onClick={() => setSubscriptionForm(null)}>إغلاق</button><button className="btn-primary text-sm" onClick={saveSubscription} disabled={savingSubscription}>{savingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ الاشتراك'}</button></div>
                </div>
            )}

            {adminForm && (
                <div className="card p-5 space-y-3">
                    <h3 className="text-base font-semibold text-white">تعديل حساب مدير الفندق</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={adminForm.name} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} className="input-compact w-full" placeholder="الاسم" />
                        <input value={adminForm.email} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, email: e.target.value } : prev)} className="input-compact w-full" placeholder="البريد الإلكتروني" dir="ltr" />
                        <input value={adminForm.phone} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, phone: e.target.value } : prev)} className="input-compact w-full" placeholder="رقم الهاتف" dir="ltr" />
                        <label className="surface-tile flex items-center justify-between text-sm">تفعيل الحساب<input type="checkbox" checked={adminForm.isActive} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, isActive: e.target.checked } : prev)} /></label>
                    </div>
                    <div className="flex justify-end gap-2"><button className="btn-secondary text-sm" onClick={() => setAdminForm(null)}>إغلاق</button><button className="btn-primary text-sm" onClick={saveAdmin} disabled={savingAdmin}>{savingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ الحساب'}</button></div>
                </div>
            )}
        </div>
    );
}
