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

interface TransactionSummary {
    totalAmount: number;
    totalPaid: number;
    totalOutstanding: number;
    count: number;
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

interface FinanceTransaction {
    bookingId: string;
    bookingNumber: string;
    roomNumber: string;
    guestName: string;
    total: number;
    paidAmount: number;
    remaining: number;
    latestAmount: number;
    method: string;
    date: string;
    status: string;
}

interface FinanceTrend {
    month: string;
    revenue: number;
    paid: number;
    outstanding: number;
    bookings: number;
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

const defaultTransactionSummary: TransactionSummary = {
    totalAmount: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    count: 0,
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
    const [trends, setTrends] = useState<FinanceTrend[]>([]);
    const [trendsLoading, setTrendsLoading] = useState(true);
    const [trendsError, setTrendsError] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
    const [transactionsSummary, setTransactionsSummary] = useState<TransactionSummary>(defaultTransactionSummary);
    const [transactionsLoading, setTransactionsLoading] = useState(true);
    const [transactionsError, setTransactionsError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [totalTransactions, setTotalTransactions] = useState(0);
    const [filters, setFilters] = useState({
        fromDate: '',
        toDate: '',
        status: '',
        method: '',
    });

    useEffect(() => {
        fetchFinance();
    }, []);

    useEffect(() => {
        fetchTrends();
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [filters, page]);

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

    const fetchTrends = async () => {
        setTrendsLoading(true);
        setTrendsError(null);
        try {
            const response = await fetchWithRefresh('/api/finance/trends?months=6');
            const result = await response.json();
            if (!response.ok) {
                setTrendsError(result.error || 'تعذر تحميل التقارير الشهرية');
                return;
            }
            setTrends(result.data || []);
        } catch (err) {
            setTrendsError('حدث خطأ في الاتصال بالخادم');
        } finally {
            setTrendsLoading(false);
        }
    };

    const fetchTransactions = async () => {
        setTransactionsLoading(true);
        setTransactionsError(null);
        try {
            const params = new URLSearchParams();
            if (filters.fromDate) params.set('fromDate', filters.fromDate);
            if (filters.toDate) params.set('toDate', filters.toDate);
            if (filters.status) params.set('status', filters.status);
            if (filters.method) params.set('method', filters.method);
            params.set('page', page.toString());
            params.set('limit', '10');

            const response = await fetchWithRefresh(`/api/finance/transactions?${params}`);
            const result = await response.json();
            if (!response.ok) {
                setTransactionsError(result.error || 'تعذر تحميل حركة المالية');
                return;
            }

            setTransactions(result.data || []);
            setTransactionsSummary(result.summary || defaultTransactionSummary);
            setPages(result.pagination?.pages || 1);
            setTotalTransactions(result.pagination?.total || 0);
        } catch (err) {
            setTransactionsError('حدث خطأ في الاتصال بالخادم');
        } finally {
            setTransactionsLoading(false);
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

    const formatMonthLabel = (monthKey: string) => {
        const [year, month] = monthKey.split('-').map((value) => Number(value));
        if (!year || !month) return monthKey;
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        return new Date(year, month - 1, 1).toLocaleDateString(locale, {
            month: 'short',
            year: '2-digit',
        });
    };

    const maxTrendRevenue = useMemo(() => {
        const values = trends.map((trend) => trend.revenue);
        return Math.max(...values, 1);
    }, [trends]);

    const exportCsv = () => {
        if (transactions.length === 0) return;

        const delimiter = hotelSettings?.language === 'en' ? ',' : ';';
        const headers = [
            'رقم الحجز',
            'النزيل',
            'الغرفة',
            'إجمالي الحجز',
            'المدفوع',
            'المتبقي',
            'آخر دفعة',
            'طريقة الدفع',
            'تاريخ العملية',
            'حالة الدفع',
        ];

        const escapeValue = (value: string | number) => {
            const str = String(value ?? '').replace(/[\r\n]+/g, ' ');
            return `"${str.replace(/"/g, '""')}"`;
        };

        const rows = transactions.map((tx) => [
            escapeValue(tx.bookingNumber),
            escapeValue(tx.guestName),
            escapeValue(tx.roomNumber || '-'),
            escapeValue(formatCurrency(tx.total)),
            escapeValue(formatCurrency(tx.paidAmount)),
            escapeValue(formatCurrency(tx.remaining)),
            escapeValue(formatCurrency(tx.latestAmount)),
            escapeValue(paymentMethodLabels[tx.method] || tx.method),
            escapeValue(formatDateTime(tx.date)),
            escapeValue(paymentStatusLabels[tx.status]?.label || 'معلق'),
        ]);

        const csvContent = [headers, ...rows].map((row) => row.join(delimiter)).join('\n');
        const bom = '\ufeff'; // Ensure Excel displays Arabic correctly
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `finance-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
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
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">???????? ???????</h2>
                        <span className="text-xs text-white/50">??? 6 ????</span>
                    </div>
                    {trendsError && (
                        <div className="p-3 mb-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm">
                            {trendsError}
                        </div>
                    )}
                    {trendsLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="spinner w-8 h-8" />
                        </div>
                    ) : trends.length === 0 ? (
                        <div className="text-center text-white/60 py-8">
                            ?? ???? ?????? ????? ?????? ????????.
                        </div>
                    ) : (
                        <>
                            <div className="flex items-end justify-between gap-4 h-48">
                                {trends.map((trend) => {
                                    const revenueHeight = Math.round((trend.revenue / maxTrendRevenue) * 100);
                                    const paidHeight = Math.round((trend.paid / maxTrendRevenue) * 100);
                                    return (
                                        <div key={trend.month} className="flex flex-col items-center gap-2 flex-1">
                                            <div className="relative w-8 sm:w-10 h-36 bg-white/5 rounded-full overflow-hidden flex items-end">
                                                <div
                                                    className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-primary-500 to-accent-500"
                                                    style={{ height: `${revenueHeight}%` }}
                                                />
                                                <div
                                                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 sm:w-5 bg-success-500/90 rounded-full"
                                                    style={{ height: `${paidHeight}%` }}
                                                />
                                            </div>
                                            <div className="text-xs text-white/60">{formatMonthLabel(trend.month)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 flex items-center gap-6 text-xs text-white/50">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-gradient-to-r from-primary-500 to-accent-500" />
                                    ?????? ?????????
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-success-500" />
                                    ??????? ???????
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">?????? ??????</h2>
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {trends.map((trend) => (
                            <div key={trend.month} className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-white/70">{formatMonthLabel(trend.month)}</span>
                                    <span className="text-xs text-white/50">{trend.bookings} ???</span>
                                </div>
                                <div className="mt-2 text-xs text-white/50">
                                    ?????????: <span className="text-white/80">{formatCurrency(trend.revenue)}</span>
                                </div>
                                <div className="mt-1 text-xs text-white/50">
                                    ??????: <span className="text-white/80">{formatCurrency(trend.paid)}</span>
                                </div>
                                <div className="mt-1 text-xs text-white/50">
                                    ???????: <span className="text-white/80">{formatCurrency(trend.outstanding)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card p-5">
                <div className="flex flex-col xl:flex-row xl:items-end gap-4">
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-white">تصفية الحركة المالية</h2>
                        <p className="text-xs text-white/50 mt-1">
                            يمكنك تحديد الفترة وحالة الدفع وطريقة الدفع لتصفية النتائج.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <input
                            type="date"
                            value={filters.fromDate}
                            onChange={(e) => {
                                setPage(1);
                                setFilters((prev) => ({ ...prev, fromDate: e.target.value }));
                            }}
                            className="input min-w-[150px]"
                        />
                        <input
                            type="date"
                            value={filters.toDate}
                            onChange={(e) => {
                                setPage(1);
                                setFilters((prev) => ({ ...prev, toDate: e.target.value }));
                            }}
                            className="input min-w-[150px]"
                        />
                        <select
                            value={filters.status}
                            onChange={(e) => {
                                setPage(1);
                                setFilters((prev) => ({ ...prev, status: e.target.value }));
                            }}
                            className="input min-w-[150px]"
                        >
                            <option value="">كل حالات الدفع</option>
                            <option value="paid">مدفوع</option>
                            <option value="partial">جزئي</option>
                            <option value="pending">معلق</option>
                            <option value="refunded">مسترد</option>
                        </select>
                        <select
                            value={filters.method}
                            onChange={(e) => {
                                setPage(1);
                                setFilters((prev) => ({ ...prev, method: e.target.value }));
                            }}
                            className="input min-w-[160px]"
                        >
                            <option value="">كل طرق الدفع</option>
                            <option value="cash">نقدي</option>
                            <option value="card">بطاقة</option>
                            <option value="bank_transfer">تحويل بنكي</option>
                            <option value="online">أونلاين</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                setFilters({ fromDate: '', toDate: '', status: '', method: '' });
                                setPage(1);
                            }}
                            className="btn-secondary"
                        >
                            إعادة تعيين
                        </button>
                        <button
                            type="button"
                            onClick={exportCsv}
                            className="btn-primary"
                        >
                            تصدير CSV
                        </button>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                        { label: 'إجمالي الفترة', value: formatCurrency(transactionsSummary.totalAmount), tone: 'text-success-500' },
                        { label: 'المدفوع', value: formatCurrency(transactionsSummary.totalPaid), tone: 'text-primary-300' },
                        { label: 'المتبقي', value: formatCurrency(transactionsSummary.totalOutstanding), tone: 'text-warning-500' },
                        { label: 'عدد الحجوزات', value: transactionsSummary.count, tone: 'text-white' },
                    ].map((item) => (
                        <div key={item.label} className="card p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-white/50">{item.label}</p>
                                <p className={`text-lg font-semibold ${item.tone}`}>{item.value}</p>
                            </div>
                        </div>
                    ))}
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

            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">حركة المدفوعات</h2>
                    <span className="text-xs text-white/50">
                        عرض {transactions.length} من أصل {totalTransactions}
                    </span>
                </div>

                {transactionsError && (
                    <div className="p-3 mb-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm">
                        {transactionsError}
                    </div>
                )}

                {transactionsLoading ? (
                    <div className="flex justify-center py-8">
                        <div className="spinner w-8 h-8" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="text-center text-white/60 py-8">
                        لا توجد عمليات ضمن الفترة المحددة.
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>رقم الحجز</th>
                                    <th>النزيل</th>
                                    <th>الغرفة</th>
                                    <th>الإجمالي</th>
                                    <th>المدفوع</th>
                                    <th>المتبقي</th>
                                    <th>آخر دفعة</th>
                                    <th>طريقة الدفع</th>
                                    <th>التاريخ</th>
                                    <th>الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx) => {
                                    const status = paymentStatusLabels[tx.status] || paymentStatusLabels.pending;
                                    return (
                                        <tr key={tx.bookingId}>
                                            <td className="font-medium text-white">{tx.bookingNumber}</td>
                                            <td className="text-white/70">{tx.guestName}</td>
                                            <td className="text-white/60">{tx.roomNumber || '-'}</td>
                                            <td className="text-success-500">{formatCurrency(tx.total)}</td>
                                            <td className="text-primary-300">{formatCurrency(tx.paidAmount)}</td>
                                            <td className="text-warning-500">{formatCurrency(tx.remaining)}</td>
                                            <td className="text-white/70">{formatCurrency(tx.latestAmount)}</td>
                                            <td className="text-white/60">
                                                {paymentMethodLabels[tx.method] || tx.method}
                                            </td>
                                            <td className="text-white/60">{formatDateTime(tx.date)}</td>
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

                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-white/40">
                        صفحة {page} من {pages}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                            className="btn-secondary text-sm"
                            disabled={page <= 1}
                        >
                            السابق
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.min(prev + 1, pages))}
                            className="btn-secondary text-sm"
                            disabled={page >= pages}
                        >
                            التالي
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
