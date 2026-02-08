'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertCircle,
    CheckCircle2,
    Clock,
    RefreshCcw,
} from 'lucide-react';
import { useHotelSettings } from '@/app/(dashboard)/layout';

interface FinanceSummary {
    monthRevenue: number;
    lastMonthRevenue: number;
    monthPaid: number;
    outstandingBalance: number;
    totalBookings: number;
    paidBookings: number;
    partialBookings: number;
    pendingBookings: number;
    refundedBookings: number;
}

interface RecentPayment {
    bookingId: string;
    bookingNumber: string;
    roomNumber: string;
    guestName: string;
    amount: number;
    method: string;
    date: string;
    status: string;
}

interface FinanceData {
    summary: FinanceSummary;
    recentPayments: RecentPayment[];
}

const defaultData: FinanceData = {
    summary: {
        monthRevenue: 0,
        lastMonthRevenue: 0,
        monthPaid: 0,
        outstandingBalance: 0,
        totalBookings: 0,
        paidBookings: 0,
        partialBookings: 0,
        pendingBookings: 0,
        refundedBookings: 0,
    },
    recentPayments: [],
};

const paymentStatusLabels: Record<string, { label: string; badge: string; tone: string }> = {
    paid: { label: 'مدفوع', badge: 'badge-success', tone: 'text-success-500' },
    partial: { label: 'جزئي', badge: 'badge-warning', tone: 'text-warning-500' },
    pending: { label: 'معلق', badge: 'badge bg-white/10 text-white/60', tone: 'text-white/60' },
    refunded: { label: 'مسترد', badge: 'badge-danger', tone: 'text-danger-500' },
};

const paymentMethodLabels: Record<string, string> = {
    cash: 'نقدي',
    card: 'بطاقة',
    bank_transfer: 'تحويل بنكي',
    online: 'أونلاين',
};

export default function FinancePage() {
    const { settings: hotelSettings } = useHotelSettings();
    const [data, setData] = useState<FinanceData>(defaultData);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchFinance();
    }, []);

    const refreshSession = async () => {
        const response = await fetch('/api/auth/refresh', { method: 'POST' });
        return response.ok;
    };

    const fetchWithRefresh = async (input: RequestInfo, init?: RequestInit) => {
        const response = await fetch(input, init);
        if (response.status !== 401) {
            return response;
        }

        const refreshed = await refreshSession();
        if (!refreshed) {
            return response;
        }

        return fetch(input, init);
    };

    const fetchFinance = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetchWithRefresh('/api/finance/overview');
            const result = await response.json();
            if (!response.ok) {
                setError(result.error || 'تعذر تحميل بيانات المالية');
                return;
            }
            setData(result.data);
        } catch (err) {
            setError('حدث خطأ في الاتصال بالخادم');
        } finally {
            setLoading(false);
        }
    };

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

    const revenueTrend = useMemo(() => {
        if (data.summary.lastMonthRevenue <= 0) {
            return null;
        }
        const diff = data.summary.monthRevenue - data.summary.lastMonthRevenue;
        const percent = Math.round((diff / data.summary.lastMonthRevenue) * 100);
        return {
            percent,
            isUp: diff >= 0,
        };
    }, [data.summary.monthRevenue, data.summary.lastMonthRevenue]);

    const paidRate = data.summary.monthRevenue > 0
        ? Math.min(100, Math.round((data.summary.monthPaid / data.summary.monthRevenue) * 100))
        : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-primary-500/20 border border-primary-500/30">
                        <Wallet className="w-6 h-6 text-primary-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">المالية</h1>
                        <p className="text-white/60">
                            متابعة الإيرادات والتحصيل وحالة المدفوعات.
                        </p>
                    </div>
                </div>
                <button onClick={fetchFinance} className="btn-secondary">
                    <RefreshCcw className="w-4 h-4" />
                    تحديث البيانات
                </button>
            </div>

            {error && (
                <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="card p-5">
                    <p className="text-sm text-white/50">إيرادات هذا الشهر</p>
                    <p className="mt-2 text-2xl font-bold text-success-500">
                        {formatCurrency(data.summary.monthRevenue)}
                    </p>
                    {revenueTrend ? (
                        <div className={`mt-2 flex items-center gap-2 text-xs ${revenueTrend.isUp ? 'text-success-400' : 'text-danger-400'}`}>
                            {revenueTrend.isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {revenueTrend.isUp ? 'زيادة' : 'انخفاض'} بنسبة {Math.abs(revenueTrend.percent)}% عن الشهر الماضي
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-white/40">لا توجد بيانات مقارنة للشهر الماضي</div>
                    )}
                </div>
                <div className="card p-5">
                    <p className="text-sm text-white/50">المدفوعات المستلمة</p>
                    <p className="mt-2 text-2xl font-bold text-primary-300">
                        {formatCurrency(data.summary.monthPaid)}
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                            style={{ width: `${paidRate}%` }}
                        />
                    </div>
                    <div className="mt-2 text-xs text-white/40">نسبة التحصيل {paidRate}%</div>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-white/50">المتبقي للتحصيل</p>
                    <p className="mt-2 text-2xl font-bold text-warning-500">
                        {formatCurrency(data.summary.outstandingBalance)}
                    </p>
                    <div className="mt-2 text-xs text-white/40">
                        بناءً على الحجوزات غير المسددة بالكامل.
                    </div>
                </div>
                <div className="card p-5">
                    <p className="text-sm text-white/50">إجمالي الحجوزات</p>
                    <p className="mt-2 text-2xl font-bold text-white">
                        {data.summary.totalBookings}
                    </p>
                    <div className="mt-2 text-xs text-white/40">الحجوزات النشطة هذا الموسم.</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-6 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">تحليل التحصيل</h2>
                        <DollarSign className="w-5 h-5 text-success-500" />
                    </div>
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <CheckCircle2 className="w-4 h-4 text-success-500" />
                                المدفوعات المكتملة
                            </div>
                            <p className="mt-2 text-xl font-semibold text-white">
                                {data.summary.paidBookings}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <AlertCircle className="w-4 h-4 text-warning-500" />
                                المدفوعات الجزئية
                            </div>
                            <p className="mt-2 text-xl font-semibold text-white">
                                {data.summary.partialBookings}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <Clock className="w-4 h-4 text-primary-300" />
                                المدفوعات المعلقة
                            </div>
                            <p className="mt-2 text-xl font-semibold text-white">
                                {data.summary.pendingBookings}
                            </p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <AlertCircle className="w-4 h-4 text-danger-500" />
                                المدفوعات المستردة
                            </div>
                            <p className="mt-2 text-xl font-semibold text-white">
                                {data.summary.refundedBookings}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">توزيع الحالة</h2>
                    <div className="space-y-3 text-sm">
                        {[
                            { key: 'paid', value: data.summary.paidBookings },
                            { key: 'partial', value: data.summary.partialBookings },
                            { key: 'pending', value: data.summary.pendingBookings },
                            { key: 'refunded', value: data.summary.refundedBookings },
                        ].map((item) => {
                            const status = paymentStatusLabels[item.key];
                            return (
                                <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                    <span className="text-white/70">{status.label}</span>
                                    <span className={status.badge}>{item.value}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">الدفعات الأخيرة</h2>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="spinner w-8 h-8" />
                    </div>
                ) : data.recentPayments.length === 0 ? (
                    <div className="text-center text-white/60 py-8">
                        لا توجد دفعات مسجلة حتى الآن.
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>رقم الحجز</th>
                                    <th>النزيل</th>
                                    <th>الغرفة</th>
                                    <th>المبلغ</th>
                                    <th>طريقة الدفع</th>
                                    <th>التاريخ</th>
                                    <th>الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recentPayments.map((payment) => {
                                    const status = paymentStatusLabels[payment.status] || paymentStatusLabels.pending;
                                    return (
                                        <tr key={payment.bookingId}>
                                            <td className="font-medium text-white">{payment.bookingNumber}</td>
                                            <td className="text-white/70">{payment.guestName}</td>
                                            <td className="text-white/60">{payment.roomNumber || '-'}</td>
                                            <td className="text-primary-300">{formatCurrency(payment.amount)}</td>
                                            <td className="text-white/60">
                                                {paymentMethodLabels[payment.method] || payment.method}
                                            </td>
                                            <td className="text-white/60">{formatDateTime(payment.date)}</td>
                                            <td>
                                                <span className={status.badge}>{status.label}</span>
                                            </td>
                                        </tr>
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
