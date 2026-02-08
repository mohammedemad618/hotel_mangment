'use client';

import { useEffect, useState } from 'react';
import {
    BedDouble,
    CalendarCheck,
    Users,
    TrendingUp,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Settings,
    ShieldCheck,
    Sparkles,
    Bell,
} from 'lucide-react';
import { useHotelSettings } from '@/app/(dashboard)/layout';

interface DashboardStats {
    totalRooms: number;
    availableRooms: number;
    occupiedRooms: number;
    todayCheckIns: number;
    todayCheckOuts: number;
    pendingBookings: number;
    totalGuests: number;
    monthlyRevenue: number;
}

const defaultStats: DashboardStats = {
    totalRooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    todayCheckIns: 0,
    todayCheckOuts: 0,
    pendingBookings: 0,
    totalGuests: 0,
    monthlyRevenue: 0,
};

export default function DashboardPage() {
    const { settings: hotelSettings, notifications } = useHotelSettings();
    const [stats, setStats] = useState<DashboardStats>(defaultStats);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulated stats for demo
        setStats({
            totalRooms: 50,
            availableRooms: 32,
            occupiedRooms: 18,
            todayCheckIns: 5,
            todayCheckOuts: 3,
            pendingBookings: 8,
            totalGuests: 156,
            monthlyRevenue: 125000,
        });
        setLoading(false);
    }, []);

    const statsCards = [
        {
            title: 'الغرف المتاحة',
            value: stats.availableRooms,
            total: stats.totalRooms,
            icon: BedDouble,
            color: 'bg-success-500',
            trend: '+12%',
            trendUp: true,
            progress: 64,
        },
        {
            title: 'الغرف المشغولة',
            value: stats.occupiedRooms,
            total: stats.totalRooms,
            icon: BedDouble,
            color: 'bg-primary-500',
            trend: '+8%',
            trendUp: true,
            progress: 36,
        },
        {
            title: 'الحجوزات المعلقة',
            value: stats.pendingBookings,
            icon: CalendarCheck,
            color: 'bg-warning-500',
            trend: '-5%',
            trendUp: false,
            progress: 48,
        },
        {
            title: 'إجمالي النزلاء',
            value: stats.totalGuests,
            icon: Users,
            color: 'bg-accent-500',
            trend: '+24%',
            trendUp: true,
            progress: 72,
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
                            لوحة التحكم التنفيذية
                        </h1>
                        <p className="mt-1 text-white/60">
                            نظرة شاملة على أداء الفندق اليوم.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="badge-success">الحالة: نشط</span>
                    <span className="badge-primary">الأمان: مستقر</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {statsCards.map((stat, index) => (
                    <div
                        key={stat.title}
                        className="card p-6 animate-slide-up"
                        style={{ animationDelay: `${index * 100}ms` }}
                    >
                        <div className="flex items-start justify-between">
                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <stat.icon className="w-6 h-6 text-primary-300" />
                            </div>
                            <div className={`flex items-center gap-1 text-sm font-medium ${stat.trendUp ? 'text-success-500' : 'text-danger-500'
                                }`}>
                                {stat.trendUp ? (
                                    <ArrowUpRight className="w-4 h-4" />
                                ) : (
                                    <ArrowDownRight className="w-4 h-4" />
                                )}
                                {stat.trend}
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
                            <div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                                    style={{ width: `${stat.progress}%` }}
                                />
                            </div>
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
                            الإيرادات الشهرية
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
                        <span>زيادة بنسبة 18% مقارنة بالشهر الماضي</span>
                    </div>
                    <div className="mt-6 h-40 rounded-2xl border border-white/5 bg-gradient-to-b from-primary-500/20 via-transparent to-transparent" />
                </div>

                {/* Today's Activity */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-6">
                        نشاط اليوم
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-sm text-white/70">تسجيل الوصول</span>
                            <span className="badge-success">{stats.todayCheckIns} نزيل</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-sm text-white/70">تسجيل المغادرة</span>
                            <span className="badge-warning">{stats.todayCheckOuts} نزيل</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                            <span className="text-sm text-white/70">طلبات خاصة</span>
                            <span className="badge-primary">6</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card p-6">
                <h2 className="text-lg font-semibold text-white mb-6">
                    إجراءات سريعة
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                        { label: 'حجز جديد', href: '/dashboard/bookings/new', icon: CalendarCheck },
                        { label: 'إضافة نزيل', href: '/dashboard/guests/new', icon: Users },
                        { label: 'إضافة غرفة', href: '/dashboard/rooms/new', icon: BedDouble },
                        { label: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
                    ].map((action) => (
                        <a
                            key={action.label}
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
                    واجهة تشغيل احترافية قابلة للتخصيص حسب احتياجات الفندق.
                </div>
            </div>


            <div className="card p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-semibold text-white">
                        الإشعارات الأخيرة
                    </h2>
                    <Bell className="w-5 h-5 text-primary-300" />
                </div>

                {notifications.length === 0 ? (
                    <p className="text-white/60">
                        لا توجد إشعارات حاليا.
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
