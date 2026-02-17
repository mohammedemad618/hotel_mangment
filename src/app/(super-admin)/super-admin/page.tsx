'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertTriangle,
    Building2,
    CalendarClock,
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
    plan: Plan;
    paymentDate: string;
    currentEndDate: string | null;
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
    graceEndDate?: string | null;
    daysRemaining: number;
    daysPastEnd?: number;
    daysUntilSuspension?: number | null;
    isInGracePeriod?: boolean;
    isBeyondGracePeriod?: boolean;
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
    inGrace?: number;
    critical: number;
    warning: number;
    info: number;
    warningDays?: number;
    graceDays?: number;
    maintenance: {
        updatedCount: number;
        affectedIds: string[];
    };
    windowDays: number;
}

const planLabels: Record<Plan, string> = {
    free: 'Ù…Ø¬Ø§Ù†ÙŠ',
    basic: 'Ø£Ø³Ø§Ø³ÙŠ',
    premium: 'Ø§Ø­ØªØ±Ø§ÙÙŠ',
    enterprise: 'Ù…Ø¤Ø³Ø³ÙŠ',
};

const statusLabels: Record<SubscriptionStatus, string> = {
    active: 'Ù†Ø´Ø·',
    suspended: 'Ù…Ø¹Ù„Ù‘Ù‚',
    cancelled: 'Ù…Ù„ØºÙŠ',
};

const alertLabels: Record<AlertSeverity, string> = {
    info: 'Ù…ØªØ§Ø¨Ø¹Ø©',
    warning: 'ØªÙ†Ø¨ÙŠÙ‡',
    critical: 'Ø­Ø±Ø¬',
    expired: 'Ù…Ù†ØªÙ‡ÙŠ',
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
    if (daysRemaining === 1) return 'ينتهي غدًا';
    return `متبقي ${daysRemaining} أيام`;
};

const formatAlertTimeline = (alert: SubscriptionAlert) => {
    if (alert.isBeyondGracePeriod) {
        return `متجاوز للمهلة منذ ${alert.daysPastEnd || 0} يوم`;
    }
    if (alert.isInGracePeriod) {
        return `مهلة سماح - متبقي ${alert.daysUntilSuspension ?? 0} يوم للتعليق`;
    }
    return formatDaysRemaining(alert.daysRemaining);
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
                setError(data.error || 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙÙ†Ø§Ø¯Ù‚');
                return false;
            }
            setHotels(Array.isArray(data.data) ? data.data : []);
            return true;
        } catch {
            setError('ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„ÙÙ†Ø§Ø¯Ù‚');
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
                setError(data.error || 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª');
                return false;
            }
            setAlerts(Array.isArray(data.data) ? data.data : []);
            setAlertsSummary(data.summary || null);
            return true;
        } catch {
            setError('ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª');
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
                setError(result.error || 'ÙØ´Ù„ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙÙ†Ø¯Ù‚');
                return;
            }
            setSuccess('ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙÙ†Ø¯Ù‚ ÙˆØ­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¯ÙŠØ± Ø¨Ù†Ø¬Ø§Ø­');
            reset();
            await fetchHotels(search);
            await fetchSubscriptionAlerts(false);
        } catch {
            setError('ÙØ´Ù„ Ø§Ù„Ø§ØªØµØ§Ù„ Ø¨Ø§Ù„Ø®Ø§Ø¯Ù…');
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
        if (!response.ok) throw new Error(result.error || 'ØªØ¹Ø°Ø± ØªØ­Ø¯ÙŠØ« Ø§Ù„ÙÙ†Ø¯Ù‚');
        setHotels((prev) => prev.map((h) => (h._id === hotelId ? result.data : h)));
    };

    const toggleHotel = async (hotel: HotelItem) => {
        setError(null);
        setSuccess(null);
        try {
            await patchHotel(hotel._id, { isActive: !hotel.isActive });
            setSuccess('ØªÙ… ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„ØªÙØ¹ÙŠÙ„');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„ÙÙ†Ø¯Ù‚');
        }
    };

    const toggleVerify = async (hotel: HotelItem) => {
        setError(null);
        setSuccess(null);
        try {
            await patchHotel(hotel._id, { isVerified: !hotel.verification?.isVerified });
            setSuccess('ØªÙ… ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„ØªØ­Ù‚Ù‚');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« Ø­Ø§Ù„Ø© Ø§Ù„ØªØ­Ù‚Ù‚');
        }
    };

    const openSubscription = (hotel: HotelItem) => {
        const todayDate = new Date().toISOString().slice(0, 10);
        setSubscriptionForm({
            hotelId: hotel._id,
            plan: hotel.subscription?.plan || 'basic',
            paymentDate: todayDate,
            currentEndDate: hotel.subscription?.endDate || null,
        });
    };

    const saveSubscription = async () => {
        if (!subscriptionForm) return;
        setSavingSubscription(true);
        setError(null);
        setSuccess(null);
        try {
            await patchHotel(subscriptionForm.hotelId, {
                subscription: {
                    plan: subscriptionForm.plan,
                    paymentDate: subscriptionForm.paymentDate || null,
                    renew: true,
                },
            });
            setSubscriptionForm(null);
            await fetchSubscriptionAlerts(false);
            setSuccess('ØªÙ… Ø­ÙØ¸ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ÙØ´Ù„ Ø­ÙØ¸ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ');
        } finally {
            setSavingSubscription(false);
        }
    };

    const openAdmin = (hotel: HotelItem) => {
        if (!hotel.admin) {
            setError('Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø­Ø³Ø§Ø¨ Ù…Ø¯ÙŠØ± Ù…Ø±ØªØ¨Ø· Ø¨Ù‡Ø°Ø§ Ø§Ù„ÙÙ†Ø¯Ù‚');
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
            if (!response.ok) throw new Error(result.error || 'ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« Ø­Ø³Ø§Ø¨ Ù…Ø¯ÙŠØ± Ø§Ù„ÙÙ†Ø¯Ù‚');
            setSuccess('ØªÙ… ØªØ­Ø¯ÙŠØ« Ø­Ø³Ø§Ø¨ Ù…Ø¯ÙŠØ± Ø§Ù„ÙÙ†Ø¯Ù‚');
            setAdminForm(null);
            await fetchHotels(search);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'ÙØ´Ù„ ØªØ­Ø¯ÙŠØ« Ø­Ø³Ø§Ø¨ Ù…Ø¯ÙŠØ± Ø§Ù„ÙÙ†Ø¯Ù‚');
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
                setSuccess('ØªÙ… ØªØ´ØºÙŠÙ„ ØµÙŠØ§Ù†Ø© Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ø¨Ù†Ø¬Ø§Ø­');
            }
        } catch {
            setError('ÙØ´Ù„ ØªØ´ØºÙŠÙ„ ØµÙŠØ§Ù†Ø© Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª');
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
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">Ù„ÙˆØ­Ø© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„ÙÙ†Ø§Ø¯Ù‚ ÙˆØ§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª</h1>
                        <p className="mt-2 text-white/60">Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨Ø§Øª Ù…Ø§Ù„ÙƒÙŠ Ø§Ù„ÙÙ†Ø§Ø¯Ù‚ØŒ Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§ØªØŒ ÙˆØ§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª ÙˆØ§Ù„Ù…Ø±Ø§ÙÙ‚.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/super-admin/subscriptions" className="btn-secondary text-sm">
                            <CalendarClock className="w-4 h-4" />
                            مراقبة الاشتراكات
                        </Link>
                        <Link href="/super-admin/users" className="btn-secondary text-sm">
                            <Users className="w-4 h-4" />
                            Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†
                        </Link>
                        {isMainSuperAdmin && (
                            <Link href="/super-admin/sub-super-admins" className="btn-secondary text-sm">
                                <ShieldCheck className="w-4 h-4" />
                                Ù…Ø±Ø§Ù‚Ø¨Ø© Ø§Ù„ØµØ¨ Ø³ÙˆØ¨Ø± Ø£Ø¯Ù…Ù†
                            </Link>
                        )}
                        <button type="button" onClick={() => fetchHotels(search)} className="btn-secondary text-sm">
                            <RefreshCcw className="w-4 h-4" />
                            ØªØ­Ø¯ÙŠØ« Ø§Ù„ÙÙ†Ø§Ø¯Ù‚
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
                <div className="stat-card"><p className="text-xs text-white/50">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ÙÙ†Ø§Ø¯Ù‚</p><p className="text-lg font-semibold text-primary-300">{stats.total}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ù†Ø´Ø·Ø©</p><p className="text-lg font-semibold text-success-500">{stats.active}</p></div>
                <div className="stat-card"><p className="text-xs text-white/50">ÙÙ†Ø§Ø¯Ù‚ Ù…ÙˆØ«Ù‚Ø©</p><p className="text-lg font-semibold text-accent-300">{stats.verified}</p></div>
            </div>

            <div className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-warning-500" />
                            ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª
                        </h2>
                        <p className="text-xs text-white/60 mt-1">Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ø§Ù„Ù‚Ø±ÙŠØ¨Ø© Ù…Ù† Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡ Ù…Ø¹ ØªØ¹Ù„ÙŠÙ‚ ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ù…Ù†ØªÙ‡ÙŠØ©.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={alertsWindowDays}
                            onChange={(e) => setAlertsWindowDays(Number(e.target.value))}
                            className="input-compact text-sm min-w-[160px]"
                        >
                            <option value={3}>Ù†Ø§ÙØ°Ø© 3 Ø£ÙŠØ§Ù…</option>
                            <option value={7}>Ù†Ø§ÙØ°Ø© 7 Ø£ÙŠØ§Ù…</option>
                            <option value={14}>Ù†Ø§ÙØ°Ø© 14 ÙŠÙˆÙ…</option>
                            <option value={30}>Ù†Ø§ÙØ°Ø© 30 ÙŠÙˆÙ…</option>
                        </select>
                        <button type="button" onClick={() => fetchSubscriptionAlerts(false)} className="btn-secondary text-sm">
                            <RefreshCcw className="w-4 h-4" />
                            ØªØ­Ø¯ÙŠØ« Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª
                        </button>
                        <button type="button" className="btn-primary text-sm" onClick={runMaintenanceNow} disabled={runningMaintenance}>
                            {runningMaintenance ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Settings2 className="w-4 h-4" />
                                    ØªØ´ØºÙŠÙ„ Ø§Ù„ØµÙŠØ§Ù†Ø©
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª</p>
                        <p className="text-lg font-semibold text-primary-300">{alertsSummary?.totalAlerts || 0}</p>
                    </div>
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">Ù…Ù†ØªÙ‡ÙŠØ©</p>
                        <p className="text-lg font-semibold text-danger-500">{alertsSummary?.expired || 0}</p>
                    </div>
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">داخل مهلة السماح</p>
                        <p className="text-lg font-semibold text-warning-500">{alertsSummary?.inGrace || 0}</p>
                    </div>
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">Ø­Ø±Ø¬Ø©</p>
                        <p className="text-lg font-semibold text-danger-500">{alertsSummary?.critical || 0}</p>
                    </div>
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">ØªÙ†Ø¨ÙŠÙ‡</p>
                        <p className="text-lg font-semibold text-warning-500">{alertsSummary?.warning || 0}</p>
                    </div>
                    <div className="surface-tile">
                        <p className="text-xs text-white/60">ØªÙ… ØªØ¹Ù„ÙŠÙ‚Ù‡Ø§ Ø¨Ø§Ù„ØµÙŠØ§Ù†Ø©</p>
                        <p className="text-lg font-semibold text-accent-300">{alertsSummary?.maintenance?.updatedCount || 0}</p>
                    </div>
                </div>

                {alertsLoading ? (
                    <div className="flex justify-center py-8"><div className="spinner w-9 h-9" /></div>
                ) : alerts.length === 0 ? (
                    <p className="text-white/60 text-center py-8">Ù„Ø§ ØªÙˆØ¬Ø¯ Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ø¶Ù…Ù† Ù†Ø§ÙØ°Ø© Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡ Ø§Ù„Ø­Ø§Ù„ÙŠØ©.</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Ø§Ù„ÙÙ†Ø¯Ù‚</th>
                                    <th>Ù…Ø¯ÙŠØ± Ø§Ù„ÙÙ†Ø¯Ù‚</th>
                                    <th>Ø§Ù„Ø­Ø§Ù„Ø©</th>
                                    <th>ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡</th>
                                    <th>Ø§Ù„ÙˆÙ‚Øª Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ</th>
                                    <th>ØªÙØ§ØµÙŠÙ„</th>
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
                                        <td className="text-white/70">{formatAlertTimeline(alert)}</td>
                                        <td>
                                            <p className="text-xs text-white/60">Ø­Ø§Ù„Ø© Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ: {statusLabels[(alert.subscriptionStatus as SubscriptionStatus)] || alert.subscriptionStatus}</p>
                                            {alert.graceEndDate && <p className="text-xs text-white/60">نهاية مهلة السماح: {formatDate(alert.graceEndDate)}</p>}
                                            <p className="text-xs text-white/60">Ø­Ø§Ù„Ø© Ø§Ù„Ø­Ø³Ø§Ø¨: {alert.isActive ? 'Ù†Ø´Ø·' : 'Ù…Ø¹Ù„Ù‘Ù‚'}</p>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="card p-5 space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2"><Building2 className="w-5 h-5 text-primary-300" />Ø¥Ù†Ø´Ø§Ø¡ ÙÙ†Ø¯Ù‚ Ø¬Ø¯ÙŠØ¯</h2>
                <form onSubmit={handleSubmit(onCreateHotel)} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <input {...register('hotelName')} className="input-compact w-full" placeholder="Ø§Ø³Ù… Ø§Ù„ÙÙ†Ø¯Ù‚" />
                    <input {...register('adminName')} className="input-compact w-full" placeholder="Ø§Ø³Ù… Ø§Ù„Ù…Ø¯ÙŠØ±" />
                    <input {...register('email')} type="email" className="input-compact w-full" placeholder="Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ" dir="ltr" />
                    <input {...register('phone')} className="input-compact w-full" placeholder="Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ" dir="ltr" />
                    <input {...register('city')} className="input-compact w-full" placeholder="Ø§Ù„Ù…Ø¯ÙŠÙ†Ø©" />
                    <input {...register('country')} className="input-compact w-full" placeholder="Ø§Ù„Ø¯ÙˆÙ„Ø©" />
                    <div className="md:col-span-2 xl:col-span-2">
                        <input {...register('password')} type="password" className="input-compact w-full" placeholder="ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± Ø§Ù„Ù…Ø¯ÙŠØ±" dir="ltr" />
                    </div>
                    <div className="md:col-span-2 xl:col-span-4 flex justify-end">
                        <button type="submit" className="btn-primary text-sm" disabled={submitting}>
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙÙ†Ø¯Ù‚</>}
                        </button>
                    </div>
                </form>
                {(errors.hotelName || errors.adminName || errors.email || errors.password) && (
                    <p className="text-xs text-danger-500">ÙŠØ±Ø¬Ù‰ Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø© Ù‚Ø¨Ù„ Ø§Ù„Ø­ÙØ¸.</p>
                )}
            </div>

            <div className="card p-5 space-y-4">
                <div className="flex flex-col lg:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="input-compact w-full pr-9" placeholder="Ø¨Ø­Ø« Ø¨Ø§Ø³Ù… Ø§Ù„ÙÙ†Ø¯Ù‚ Ø£Ùˆ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ" />
                    </div>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="input-compact min-w-[120px]">
                        <option value="all">ÙƒÙ„ Ø§Ù„Ø­Ø§Ù„Ø§Øª</option><option value="active">Ù†Ø´Ø·</option><option value="inactive">ØºÙŠØ± Ù†Ø´Ø·</option>
                    </select>
                    <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)} className="input-compact min-w-[120px]">
                        <option value="all">ÙƒÙ„ Ø§Ù„Ø¨Ø§Ù‚Ø§Øª</option><option value="free">Ù…Ø¬Ø§Ù†ÙŠ</option><option value="basic">Ø£Ø³Ø§Ø³ÙŠ</option><option value="premium">Ø§Ø­ØªØ±Ø§ÙÙŠ</option><option value="enterprise">Ù…Ø¤Ø³Ø³ÙŠ</option>
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><div className="spinner w-9 h-9" /></div>
                ) : filteredHotels.length === 0 ? (
                    <p className="text-white/60 text-center py-8">Ù„Ø§ ØªÙˆØ¬Ø¯ ÙÙ†Ø§Ø¯Ù‚ Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„Ù„ÙÙ„Ø§ØªØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ©.</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead><tr><th>Ø§Ù„ÙÙ†Ø¯Ù‚</th><th>Ø§Ù„Ù…Ø¯ÙŠØ±</th><th>Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ</th><th>Ø§Ù„Ø¯ÙØ¹ / Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡</th><th>Ø§Ù„Ø­Ø§Ù„Ø©</th>{isMainSuperAdmin && <th>Ø§Ù„ØªØ­Ù‚Ù‚</th>}<th>Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª</th></tr></thead>
                            <tbody>
                                {filteredHotels.map((hotel) => (
                                    <tr key={hotel._id}>
                                        <td><p className="font-medium text-white">{hotel.name}</p><p className="text-xs text-white/50">{hotel.address?.city || '-'}</p></td>
                                        <td>{hotel.admin ? <><p className="font-medium text-white text-sm">{hotel.admin.name}</p><p className="text-xs text-white/60" dir="ltr">{hotel.admin.email}</p></> : <span className="text-xs text-warning-500">Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ø¯ÙŠØ±</span>}</td>
                                        <td><p className="text-xs">{planLabels[hotel.subscription?.plan || 'free']}</p><p className="text-xs text-white/60">{statusLabels[hotel.subscription?.status || 'active']}</p></td>
                                        <td><p className="text-xs">Ø§Ù„Ø¯ÙØ¹: {formatDate(hotel.subscription?.paymentDate)}</p><p className="text-xs text-white/60">Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡: {formatDate(hotel.subscription?.endDate)}</p></td>
                                        <td>{hotel.isActive ? <span className="badge-success inline-flex items-center gap-1"><CheckCircle className="w-3 h-3" />Ù†Ø´Ø·</span> : <span className="badge-danger inline-flex items-center gap-1"><XCircle className="w-3 h-3" />ØºÙŠØ± Ù†Ø´Ø·</span>}</td>
                                        {isMainSuperAdmin && <td>{hotel.verification?.isVerified ? <span className="badge-success">Ù…ÙˆØ«Ù‚</span> : <span className="badge-warning">Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„ØªØ­Ù‚Ù‚</span>}</td>}
                                        <td>
                                            <div className="flex flex-wrap gap-1">
                                                <button className="btn-secondary text-xs" onClick={() => toggleHotel(hotel)}>{hotel.isActive ? 'ØªØ¹Ø·ÙŠÙ„' : 'ØªÙØ¹ÙŠÙ„'}</button>
                                                <button className="btn-secondary text-xs" onClick={() => openSubscription(hotel)}><Settings2 className="w-3.5 h-3.5" />ØªØ¬Ø¯ÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ</button>
                                                <button className="btn-secondary text-xs" onClick={() => openAdmin(hotel)}><Pencil className="w-3.5 h-3.5" />Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¯ÙŠØ±</button>
                                                {isMainSuperAdmin && <button className="btn-secondary text-xs" onClick={() => toggleVerify(hotel)}>{hotel.verification?.isVerified ? 'Ø¥Ù„ØºØ§Ø¡ Ø§Ù„ØªØ­Ù‚Ù‚' : 'ØªØ­Ù‚Ù‚'}</button>}
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
                    <h3 className="text-base font-semibold text-white">ØªØ¬Ø¯ÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ (30 ÙŠÙˆÙ…)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select value={subscriptionForm.plan} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, plan: e.target.value as Plan } : prev)} className="input-compact w-full"><option value="free">Ù…Ø¬Ø§Ù†ÙŠ</option><option value="basic">Ø£Ø³Ø§Ø³ÙŠ</option><option value="premium">Ø§Ø­ØªØ±Ø§ÙÙŠ</option><option value="enterprise">Ù…Ø¤Ø³Ø³ÙŠ</option></select>
                        <input type="date" value={subscriptionForm.paymentDate} onChange={(e) => setSubscriptionForm((prev) => prev ? { ...prev, paymentDate: e.target.value } : prev)} className="input-compact w-full" />
                        <div className="surface-tile text-sm text-white/70">
                            <p className="text-xs text-white/50 mb-1">ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„Ø­Ø§Ù„ÙŠ</p>
                            <p className="font-medium text-white">{formatDate(subscriptionForm.currentEndDate)}</p>
                            <p className="text-xs text-white/50 mt-2">Ø¹Ù†Ø¯ Ø§Ù„ØªØ¬Ø¯ÙŠØ¯ Ø³ÙŠØªÙ… ØªÙ…Ø¯ÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ù„Ù…Ø¯Ø© 30 ÙŠÙˆÙ…ØŒ ÙˆØªÙØ¹ÙŠÙ„ Ø§Ù„Ø­Ø³Ø§Ø¨.</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2"><button className="btn-secondary text-sm" onClick={() => setSubscriptionForm(null)}>Ø¥ØºÙ„Ø§Ù‚</button><button className="btn-primary text-sm" onClick={saveSubscription} disabled={savingSubscription}>{savingSubscription ? <Loader2 className="w-4 h-4 animate-spin" /> : 'ØªØ¬Ø¯ÙŠØ¯ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ'}</button></div>
                </div>
            )}

            {adminForm && (
                <div className="card p-5 space-y-3">
                    <h3 className="text-base font-semibold text-white">ØªØ¹Ø¯ÙŠÙ„ Ø­Ø³Ø§Ø¨ Ù…Ø¯ÙŠØ± Ø§Ù„ÙÙ†Ø¯Ù‚</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input value={adminForm.name} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, name: e.target.value } : prev)} className="input-compact w-full" placeholder="Ø§Ù„Ø§Ø³Ù…" />
                        <input value={adminForm.email} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, email: e.target.value } : prev)} className="input-compact w-full" placeholder="Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ" dir="ltr" />
                        <input value={adminForm.phone} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, phone: e.target.value } : prev)} className="input-compact w-full" placeholder="Ø±Ù‚Ù… Ø§Ù„Ù‡Ø§ØªÙ" dir="ltr" />
                        <label className="surface-tile flex items-center justify-between text-sm">ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø­Ø³Ø§Ø¨<input type="checkbox" checked={adminForm.isActive} onChange={(e) => setAdminForm((prev) => prev ? { ...prev, isActive: e.target.checked } : prev)} /></label>
                    </div>
                    <div className="flex justify-end gap-2"><button className="btn-secondary text-sm" onClick={() => setAdminForm(null)}>Ø¥ØºÙ„Ø§Ù‚</button><button className="btn-primary text-sm" onClick={saveAdmin} disabled={savingAdmin}>{savingAdmin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ø­ÙØ¸ Ø§Ù„Ø­Ø³Ø§Ø¨'}</button></div>
                </div>
            )}
        </div>
    );
}
