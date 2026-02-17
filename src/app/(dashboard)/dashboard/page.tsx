'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
    CheckCircle2,
    ExternalLink,
    AlertCircle,
} from 'lucide-react';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';
import type { HotelNotificationCategory } from '@/core/notifications/catalog';

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
    outstandingBalance: number;
    overduePayments: number;
    occupancyRate: number;
    collectionRate: number;
    directChannelShare: number;
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
    outstandingBalance: 0,
    overduePayments: 0,
    occupancyRate: 0,
    collectionRate: 0,
    directChannelShare: 0,
};

const notificationCategoryLabel: Record<HotelNotificationCategory, { ar: string; en: string }> = {
    booking: { ar: 'الحجوزات', en: 'Bookings' },
    payment: { ar: 'المدفوعات', en: 'Payments' },
    report: { ar: 'التقارير', en: 'Reports' },
    subscription: { ar: 'الاشتراك', en: 'Subscription' },
    system: { ar: 'النظام', en: 'System' },
};

const notificationCategoryTone: Record<HotelNotificationCategory, string> = {
    booking: 'badge-primary',
    payment: 'badge-success',
    report: 'badge-warning',
    subscription: 'badge-danger',
    system: 'badge',
};

type NotificationStatusFilter = 'all' | 'unread' | 'read';
type NotificationCategoryFilter = 'all' | HotelNotificationCategory;

export default function DashboardPage() {
    const { settings: hotelSettings, notifications, setNotifications } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
    const [stats, setStats] = useState<DashboardStats>(defaultStats);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notificationError, setNotificationError] = useState<string | null>(null);
    const [notificationActionLoading, setNotificationActionLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<NotificationStatusFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<NotificationCategoryFilter>('all');

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetchWithRefresh('/api/dashboard/stats');
            const data = await response.json();

            if (!response.ok) {
                setError(
                    data.error ||
                        t(lang, 'تعذر تحميل بيانات لوحة التحكم', 'Failed to load dashboard data')
                );
                return;
            }

            setStats({ ...defaultStats, ...(data.data || {}) });
        } catch {
            setError(
                t(
                    lang,
                    'حدث خطأ في الاتصال بالخادم',
                    'Network error while contacting the server'
                )
            );
        } finally {
            setLoading(false);
        }
    }, [lang]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const percentOf = (value: number, total: number) =>
        total > 0 ? Math.round((value / total) * 100) : 0;

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
            progress: availableRate,
        },
        {
            id: 'occupiedRooms',
            title: t(lang, 'الغرف المشغولة', 'Occupied Rooms'),
            value: stats.occupiedRooms,
            total: stats.totalRooms,
            icon: BedDouble,
            progress: occupiedRate,
        },
        {
            id: 'pendingBookings',
            title: t(lang, 'الحجوزات المعلقة', 'Pending Bookings'),
            value: stats.pendingBookings,
            icon: CalendarCheck,
            progress: pendingRate,
        },
        {
            id: 'totalGuests',
            title: t(lang, 'إجمالي النزلاء', 'Total Guests'),
            value: stats.totalGuests,
            icon: Users,
            progress: 0,
        },
    ];

    const insightCards = [
        {
            id: 'occupancyRate',
            title: t(lang, 'معدل الإشغال', 'Occupancy Rate'),
            value: `${stats.occupancyRate}%`,
            description: t(lang, 'نسبة الغرف المشغولة من إجمالي الغرف', 'Occupied rooms vs total rooms'),
            tone: 'text-primary-300',
        },
        {
            id: 'collectionRate',
            title: t(lang, 'معدل التحصيل', 'Collection Rate'),
            value: `${stats.collectionRate}%`,
            description: t(lang, 'المدفوع من إيراد الشهر الحالي', 'Paid amount from current month revenue'),
            tone: 'text-success-500',
        },
        {
            id: 'overduePayments',
            title: t(lang, 'مدفوعات متأخرة', 'Overdue Payments'),
            value: String(stats.overduePayments),
            description: t(lang, 'حجوزات تجاوزت تاريخ المغادرة وبها رصيد', 'Bookings past checkout date with unpaid balance'),
            tone: 'text-warning-500',
        },
        {
            id: 'directChannelShare',
            title: t(lang, 'حصة القناة المباشرة', 'Direct Channel Share'),
            value: `${stats.directChannelShare}%`,
            description: t(lang, 'نسبة الحجوزات المباشرة خلال الشهر', 'Direct bookings share this month'),
            tone: 'text-accent-300',
        },
    ];

    const unreadCount = useMemo(
        () => notifications.filter((item) => !item.isRead).length,
        [notifications]
    );

    const filteredNotifications = useMemo(() => {
        return notifications
            .filter((item) => {
                if (statusFilter === 'read' && !item.isRead) return false;
                if (statusFilter === 'unread' && item.isRead) return false;
                if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
                return true;
            })
            .slice(0, 8);
    }, [notifications, statusFilter, categoryFilter]);

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

    const markNotificationAsRead = async (id: string) => {
        setNotificationError(null);
        setNotificationActionLoading(true);
        try {
            const response = await fetchWithRefresh(`/api/notifications/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isRead: true }),
            });

            const payload = await response.json();
            if (!response.ok) {
                setNotificationError(
                    payload.error ||
                        t(
                            lang,
                            'تعذر تحديث حالة الإشعار',
                            'Failed to update notification status'
                        )
                );
                return;
            }

            setNotifications((prev) =>
                prev.map((item) =>
                    item.id === id
                        ? {
                              ...item,
                              isRead: true,
                              readAt: payload?.data?.readAt || new Date().toISOString(),
                          }
                        : item
                )
            );
        } catch {
            setNotificationError(
                t(lang, 'فشل الاتصال بالخادم', 'Network error while contacting the server')
            );
        } finally {
            setNotificationActionLoading(false);
        }
    };

    const markAllAsRead = async () => {
        if (unreadCount === 0) return;

        setNotificationError(null);
        setNotificationActionLoading(true);
        try {
            const response = await fetchWithRefresh('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'mark_all_read' }),
            });
            const payload = await response.json();

            if (!response.ok) {
                setNotificationError(
                    payload.error ||
                        t(lang, 'تعذر تعليم الإشعارات كمقروءة', 'Failed to mark notifications as read')
                );
                return;
            }

            const now = new Date().toISOString();
            setNotifications((prev) =>
                prev.map((item) => ({
                    ...item,
                    isRead: true,
                    readAt: item.readAt || now,
                }))
            );
        } catch {
            setNotificationError(
                t(lang, 'فشل الاتصال بالخادم', 'Network error while contacting the server')
            );
        } finally {
            setNotificationActionLoading(false);
        }
    };

    return (
        <div className="space-y-7">
            <div className="page-hero flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="relative z-10 flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary-500/20 border border-primary-500/30">
                        <ShieldCheck className="w-7 h-7 text-primary-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">
                            {t(lang, 'لوحة التحكم التنفيذية', 'Executive Dashboard')}
                        </h1>
                        <p className="mt-1 text-white/60">
                            {t(
                                lang,
                                'نظرة شاملة على أداء الفندق والحجوزات والمدفوعات.',
                                'A complete snapshot of hotel performance, bookings, and payments.'
                            )}
                        </p>
                    </div>
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <span className="badge-success">{t(lang, 'الحالة: نشط', 'Status: Active')}</span>
                    <span className="badge-primary">
                        {t(lang, 'المراقبة: مفعلة', 'Monitoring: Enabled')}
                    </span>
                </div>
            </div>

            {(error || notificationError) && (
                <div className="space-y-2">
                    {error && (
                        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm">
                            {error}
                        </div>
                    )}
                    {notificationError && (
                        <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm">
                            {notificationError}
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {statsCards.map((stat, index) => (
                    <div
                        key={stat.id}
                        className="stat-card animate-slide-up"
                        style={{ animationDelay: `${index * 80}ms` }}
                    >
                        <div className="stat-icon">
                            <stat.icon className="w-6 h-6 text-primary-300" />
                        </div>
                        <div className="mt-4">
                            <p className="text-sm text-white/60">{stat.title}</p>
                            <p className="text-3xl font-bold text-white mt-1">
                                {stat.value}
                                {stat.total ? (
                                    <span className="text-lg text-white/40 font-normal">/{stat.total}</span>
                                ) : null}
                            </p>
                            {stat.progress ? (
                                <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-6 lg:col-span-2 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-white">
                            {t(lang, 'إيراد الشهر الحالي', 'Current Month Revenue')}
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
                                          `نمو ${Math.round(
                                              ((stats.monthlyRevenue - stats.lastMonthRevenue) /
                                                  stats.lastMonthRevenue) *
                                                  100
                                          )}% مقارنة بالشهر الماضي`,
                                          `Up ${Math.round(
                                              ((stats.monthlyRevenue - stats.lastMonthRevenue) /
                                                  stats.lastMonthRevenue) *
                                                  100
                                          )}% vs last month`
                                      )
                                    : t(
                                          lang,
                                          `تراجع ${Math.round(
                                              ((stats.lastMonthRevenue - stats.monthlyRevenue) /
                                                  stats.lastMonthRevenue) *
                                                  100
                                          )}% مقارنة بالشهر الماضي`,
                                          `Down ${Math.round(
                                              ((stats.lastMonthRevenue - stats.monthlyRevenue) /
                                                  stats.lastMonthRevenue) *
                                                  100
                                          )}% vs last month`
                                      )}
                            </span>
                        ) : (
                            <span>
                                {t(
                                    lang,
                                    'لا توجد بيانات كافية للمقارنة مع الشهر الماضي',
                                    'Not enough data to compare with last month'
                                )}
                            </span>
                        )}
                    </div>
                    <div className="mt-6 h-40 rounded-2xl border border-white/10 bg-gradient-to-b from-primary-500/20 via-accent-500/5 to-transparent" />
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="surface-tile">
                            <p className="text-xs text-white/50">{t(lang, 'الرصيد المستحق', 'Outstanding Balance')}</p>
                            <p className="mt-1 text-warning-500 font-semibold">
                                {formatCurrency(stats.outstandingBalance)}
                            </p>
                        </div>
                        <div className="surface-tile">
                            <p className="text-xs text-white/50">{t(lang, 'مدفوعات متأخرة', 'Overdue Payments')}</p>
                            <p className="mt-1 text-danger-500 font-semibold">{stats.overduePayments}</p>
                        </div>
                    </div>
                </div>

                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-6">
                        {t(lang, 'نشاط اليوم', "Today's Activity")}
                    </h2>
                    <div className="space-y-4">
                        <div className="surface-tile flex items-center justify-between">
                            <span className="text-sm text-white/70">{t(lang, 'تسجيل الوصول', 'Check-ins')}</span>
                            <span className="badge-success">
                                {t(lang, `${stats.todayCheckIns} نزيل`, `${stats.todayCheckIns} guests`)}
                            </span>
                        </div>
                        <div className="surface-tile flex items-center justify-between">
                            <span className="text-sm text-white/70">{t(lang, 'تسجيل المغادرة', 'Check-outs')}</span>
                            <span className="badge-warning">
                                {t(lang, `${stats.todayCheckOuts} نزيل`, `${stats.todayCheckOuts} guests`)}
                            </span>
                        </div>
                        <div className="surface-tile flex items-center justify-between">
                            <span className="text-sm text-white/70">{t(lang, 'طلبات خاصة', 'Special requests')}</span>
                            <span className="badge-primary">{stats.specialRequestsToday}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-white">
                        {t(lang, 'مؤشرات تشغيلية متقدمة', 'Advanced Operational Insights')}
                    </h2>
                    <AlertCircle className="w-5 h-5 text-accent-300" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {insightCards.map((item) => (
                        <div key={item.id} className="surface-tile">
                            <p className="text-xs text-white/50">{item.title}</p>
                            <p className={`text-xl font-bold mt-2 ${item.tone}`}>{item.value}</p>
                            <p className="text-xs text-white/60 mt-2">{item.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-6">
                    {t(lang, 'إجراءات سريعة', 'Quick Actions')}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        {
                            id: 'newBooking',
                            label: t(lang, 'حجز جديد', 'New Booking'),
                            href: '/dashboard/bookings/new',
                            icon: CalendarCheck,
                        },
                        {
                            id: 'newGuest',
                            label: t(lang, 'إضافة نزيل', 'Add Guest'),
                            href: '/dashboard/guests/new',
                            icon: Users,
                        },
                        {
                            id: 'newRoom',
                            label: t(lang, 'إضافة غرفة', 'Add Room'),
                            href: '/dashboard/rooms/new',
                            icon: BedDouble,
                        },
                        {
                            id: 'settings',
                            label: t(lang, 'الإعدادات', 'Settings'),
                            href: '/dashboard/settings',
                            icon: Settings,
                        },
                    ].map((action) => (
                        <a
                            key={action.id}
                            href={action.href}
                            className="flex flex-col items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:border-primary-500/50 hover:bg-white/5 transition-all duration-200 group"
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
                    {t(
                        lang,
                        'واجهة احترافية قابلة للتخصيص حسب احتياجات الفندق مع متابعة تشغيلية يومية.',
                        'A customizable professional console with daily operational visibility.'
                    )}
                </div>
            </div>

            <div className="card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">
                            {t(lang, 'مركز الإشعارات', 'Notification Center')}
                        </h2>
                        <Bell className="w-5 h-5 text-primary-300" />
                        {unreadCount > 0 && (
                            <span className="badge-danger text-xs">{unreadCount}</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={markAllAsRead}
                        disabled={notificationActionLoading || unreadCount === 0}
                        className="btn-secondary text-xs"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        {t(lang, 'تعليم الكل كمقروء', 'Mark all as read')}
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-3 mb-4">
                    <div className="flex gap-2">
                        {([
                            ['all', t(lang, 'الكل', 'All')],
                            ['unread', t(lang, 'غير مقروء', 'Unread')],
                            ['read', t(lang, 'مقروء', 'Read')],
                        ] as Array<[NotificationStatusFilter, string]>).map(([value, label]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setStatusFilter(value)}
                                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                                    statusFilter === value
                                        ? 'bg-primary-500/15 border-primary-500/40 text-white'
                                        : 'border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <select
                        value={categoryFilter}
                        onChange={(event) =>
                            setCategoryFilter(event.target.value as NotificationCategoryFilter)
                        }
                        className="input-compact text-xs lg:max-w-[220px]"
                    >
                        <option value="all">{t(lang, 'كل التصنيفات', 'All categories')}</option>
                        <option value="booking">{t(lang, 'الحجوزات', 'Bookings')}</option>
                        <option value="payment">{t(lang, 'المدفوعات', 'Payments')}</option>
                        <option value="report">{t(lang, 'التقارير', 'Reports')}</option>
                        <option value="subscription">{t(lang, 'الاشتراك', 'Subscription')}</option>
                        <option value="system">{t(lang, 'النظام', 'System')}</option>
                    </select>
                </div>

                {filteredNotifications.length === 0 ? (
                    <p className="text-white/60">
                        {t(lang, 'لا توجد إشعارات ضمن الفلاتر المحددة.', 'No notifications for selected filters.')}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {filteredNotifications.map((item) => (
                            <div key={item.id} className="surface-tile">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`${notificationCategoryTone[item.category]} inline-flex items-center gap-1 text-[11px]`}
                                            >
                                                {notificationCategoryLabel[item.category][lang]}
                                            </span>
                                            {!item.isRead && (
                                                <span className="w-2 h-2 rounded-full bg-primary-400" />
                                            )}
                                        </div>
                                        <p className="text-sm text-white/80">{item.message}</p>
                                        <p className="text-xs text-white/40">
                                            {formatDateTime(item.createdAt)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.actionUrl && (
                                            <a href={item.actionUrl} className="btn-secondary text-xs">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                {t(lang, 'فتح', 'Open')}
                                            </a>
                                        )}
                                        {!item.isRead && (
                                            <button
                                                type="button"
                                                onClick={() => markNotificationAsRead(item.id)}
                                                disabled={notificationActionLoading}
                                                className="btn-secondary text-xs"
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                {t(lang, 'تمت القراءة', 'Mark read')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {loading && (
                <div className="text-xs text-white/50">
                    {t(lang, 'جارِ تحديث بيانات اللوحة...', 'Refreshing dashboard data...')}
                </div>
            )}
        </div>
    );
}
