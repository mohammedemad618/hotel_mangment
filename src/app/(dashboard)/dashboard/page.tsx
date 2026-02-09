'use client';

import { useEffect, useState } from 'react';
import {
    BedDouble,
    CalendarCheck,
    Users,
    TrendingUp,
    DollarSign,
    Settings,
    ShieldCheck,
    Sparkles,
    Bell,
} from 'lucide-react';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';

interface DashboardStats {
    totalRooms: number;
    availableRooms: number;
    occupiedRooms: number;
    todayCheckIns: number;
    todayCheckOuts: number;
    pendingBookings: number;
    totalGuests: number;
    totalBookings: number;
    specialRequestsToday: number;
    monthlyRevenue: number;
    lastMonthRevenue: number;
}

const defaultStats: DashboardStats = {
    totalRooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    pendingBookings: 0,
    totalGuests: 0,
    totalBookings: 0,
    specialRequestsToday: 0,
    monthlyRevenue: 0,
    lastMonthRevenue: 0,
};

export default function DashboardPage() {
    const { settings: hotelSettings, notifications } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
    const [stats, setStats] = useState<DashboardStats>(defaultStats);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetchWithRefresh('/api/dashboard/stats');
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || t(lang, 'حدث خطأ أثناء جلب بيانات لوحة التحكم', 'Failed to load dashboard data'));
                return;
            }

            setStats(data.data);
        } catch (err) {
            setError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
        } finally {
            setLoading(false);
        }
    };

    const percentOf = (value: number, total: number) => (
        total > 0 ? Math.round((value / total) * 100) : 0
    );

    const availableRate = percentOf(stats.availableRooms, stats.totalRooms);
    const occupiedRate = percentOf(stats.occupiedRooms, stats.totalRooms);
    const pendingRate = percentOf(stats.pendingBookings, stats.totalBookings);

    const statsCards = [
        {
            id: 'availableRooms',
            title: t(lang, 'الغرف المتاحة', 'Available Rooms'),
            value: stats.availableRooms,
            total: stats.totalRooms,
            icon: BedDouble,
            color: 'bg-success-500',
            progress: availableRate,
        },
        {
            id: 'occupiedRooms',
            title: t(lang, 'الغرف المشغولة', 'Occupied Rooms'),
            value: stats.occupiedRooms,
            total: stats.totalRooms,
            icon: BedDouble,
            color: 'bg-primary-500',
            progress: occupiedRate,
        },
        {
            id: 'pendingBookings',
            title: t(lang, 'الحجوزات المعلقة', 'Pending Bookings'),
            value: stats.pendingBookings,
            icon: CalendarCheck,
            color: 'bg-warning-500',
            progress: pendingRate,
        },
        {
            id: 'totalGuests',
            title: t(lang, 'إجمالي النزلاء', 'Total Guests'),
            value: stats.totalGuests,
            icon: Users,
            color: 'bg-accent-500',
            progress: 0,
        },
    ];

    const formatCurrency = (amount: number) => {
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const currency = hotelSettings?.currency || 'SAR';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDateTime = (dateStr: string) => {
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const timeZone = hotelSettings?.timezone || 'Asia/Riyadh';
        return new Date(dateStr).toLocaleString(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone,
        });
    };

    return (
        <div className="space-y-8">
            <div className="card p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary-500/20 border border-primary-500/30">
                        <ShieldCheck className="w-7 h-7 text-primary-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">
                            {t(lang, 'لوحة التحكم التنفيذية', 'Executive Dashboard')}
                        </h1>
                        <p className="mt-1 text-white/60">
                            {t(lang, 'نظرة شاملة على أداء الفندق اليوم.', "A quick snapshot of today's hotel performance.")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="badge-success">{t(lang, 'الحالة: نشط', 'Status: Active')}</span>
                    <span className="badge-primary">{t(lang, 'الأمان: مستقر', 'Security: Stable')}</span>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm">
                    {error}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsCards.map((stat, index) => (
                    <div
                        key={stat.id}
                        className="card p-6 animate-slide-up"
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        <div className="flex items-start justify-between">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <stat.icon className="w-6 h-6 text-primary-300" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-white/60">{stat.title}</p>
                            <p className="text-3xl font-bold text-white mt-1">
                                {stat.value}
                                {stat.total && (
                                    <span className="text-lg text-white/40 font-normal">
                                        /{stat.total}
                                    </span>
                                )}
                            </p>
                            {stat.progress ? (
                                <div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                                        style={{ width: `${stat.progress}%` }}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                ))}
            </div>

            {/* Revenue & Activity Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Card */}
                <div className="card p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-white">
                            {t(lang, 'الإيرادات الشهرية', 'Monthly Revenue')}
                        </h2>
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-success-500" />
                            <span className="text-2xl font-bold text-success-500">
                                {formatCurrency(stats.monthlyRevenue)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/60">
                        <TrendingUp className="w-4 h-4 text-success-500" />
                        {stats.lastMonthRevenue > 0 ? (
                            <span>
                                {stats.monthlyRevenue >= stats.lastMonthRevenue
                                    ? t(
                                        lang,
                                        `زيادة بنسبة ${Math.round(
                                            ((stats.monthlyRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100
                                        )}% مقارنة بالشهر الماضي`,
                                        `Up ${Math.round(
                                        ((stats.monthlyRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100
                                        )}% vs last month`
                                    )
                                    : t(
                                        lang,
                                        `انخفاض بنسبة ${Math.round(
                                            ((stats.lastMonthRevenue - stats.monthlyRevenue) / stats.lastMonthRevenue) * 100
                                        )}% مقارنة بالشهر الماضي`,
                                        `Down ${Math.round(
                                        ((stats.lastMonthRevenue - stats.monthlyRevenue) / stats.lastMonthRevenue) * 100
                                        )}% vs last month`
                                    )}
                            </span>
                        ) : (
                            <span>{t(lang, 'لا توجد بيانات للمقارنة مع الشهر الماضي', 'No comparison data for last month')}</span>
                        )}
                    </div>
                    <div className="mt-6 h-40 rounded-2xl border border-white/5 bg-gradient-to-b from-primary-500/20 via-transparent to-transparent" />
                </div>

                {/* Today's Activity */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-6">
                        {t(lang, 'نشاط اليوم', "Today's Activity")}
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-sm text-white/70">{t(lang, 'تسجيل الوصول', 'Check-ins')}</span>
                            <span className="badge-success">{t(lang, `${stats.todayCheckIns} نزيل`, `${stats.todayCheckIns} guests`)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-sm text-white/70">{t(lang, 'تسجيل المغادرة', 'Check-outs')}</span>
                            <span className="badge-warning">{t(lang, `${stats.todayCheckOuts} نزيل`, `${stats.todayCheckOuts} guests`)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-sm text-white/70">{t(lang, 'طلبات خاصة', 'Special requests')}</span>
                            <span className="badge-primary">{t(lang, `${stats.specialRequestsToday}`, `${stats.specialRequestsToday}`)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-6">
                    {t(lang, 'إجراءات سريعة', 'Quick Actions')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { id: 'newBooking', label: t(lang, 'حجز جديد', 'New Booking'), href: '/dashboard/bookings/new', icon: CalendarCheck },
                        { id: 'newGuest', label: t(lang, 'إضافة نزيل', 'Add Guest'), href: '/dashboard/guests/new', icon: Users },
                        { id: 'newRoom', label: t(lang, 'إضافة غرفة', 'Add Room'), href: '/dashboard/rooms/new', icon: BedDouble },
                        { id: 'settings', label: t(lang, 'الإعدادات', 'Settings'), href: '/dashboard/settings', icon: Settings },
                    ].map((action) => (
                        <a
                            key={action.id}
                            href={action.href}
                            className="flex flex-col items-center gap-3 p-4 rounded-xl border border-white/10 hover:border-primary-500/50 hover:bg-white/5 transition-all duration-200 group"
                        >
                            <action.icon className="w-8 h-8 text-white/50 group-hover:text-primary-300 transition-colors" />
                            <span className="text-sm font-medium text-white/70 group-hover:text-white">
                                {action.label}
                            </span>
                        </a>
                    ))}
                </div>
                <div className="mt-6 flex items-center gap-2 text-xs text-white/50">
                    <Sparkles className="w-4 h-4" />
                    {t(lang, 'واجهة تشغيل احترافية قابلة للتخصيص حسب احتياجات الفندق.', 'A customizable, professional console tailored to your hotel.')}
                </div>
            </div>


            <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-white">
                        {t(lang, 'الإشعارات الأخيرة', 'Recent Notifications')}
                    </h2>
                    <Bell className="w-5 h-5 text-primary-300" />
                </div>

                {notifications.length === 0 ? (
                    <p className="text-white/60">
                        {t(lang, 'لا توجد إشعارات حاليا.', 'No notifications yet.')}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {notifications.slice(0, 6).map((item, index) => (
                            <div
                                key={`${item.createdAt}-${index}`}
                                className="p-4 rounded-xl bg-white/5 border border-white/10"
                            >
                                <p className="text-sm text-white/80">{item.message}</p>
                                <p className="mt-1 text-xs text-white/40">
                                    {formatDateTime(item.createdAt)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

