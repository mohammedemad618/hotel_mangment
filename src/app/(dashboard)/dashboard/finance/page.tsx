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
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';

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

const paymentStatusLabels: Record<string, { label: { ar: string; en: string }; badge: string; tone: string }> = {
    paid: { label: { ar: 'مدفوع', en: 'Paid' }, badge: 'badge-success', tone: 'text-success-500' },
    partial: { label: { ar: 'جزئي', en: 'Partial' }, badge: 'badge-warning', tone: 'text-warning-500' },
    pending: { label: { ar: 'معلق', en: 'Pending' }, badge: 'badge bg-white/10 text-white/60', tone: 'text-white/60' },
    refunded: { label: { ar: 'مسترد', en: 'Refunded' }, badge: 'badge-danger', tone: 'text-danger-500' },
};

const paymentMethodLabels: Record<string, { ar: string; en: string }> = {
    cash: { ar: 'نقدي', en: 'Cash' },
    card: { ar: 'بطاقة', en: 'Card' },
    bank_transfer: { ar: 'تحويل بنكي', en: 'Bank transfer' },
    online: { ar: 'أونلاين', en: 'Online' },
};

export default function FinancePage() {
    const { settings: hotelSettings } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
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

    const fetchFinance = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetchWithRefresh('/api/finance/overview');
            const result = await response.json();
            if (!response.ok) {
                setError(result.error || t(lang, 'تعذر تحميل بيانات المالية', 'Failed to load finance data'));
                return;
            }
            setData(result.data);
        } catch (err) {
            setError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
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
                setTrendsError(result.error || t(lang, 'تعذر تحميل التقارير الشهرية', 'Failed to load monthly trends'));
                return;
            }
            setTrends(result.data || []);
        } catch (err) {
            setTrendsError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
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
                setTransactionsError(result.error || t(lang, 'تعذر تحميل حركة المالية', 'Failed to load transactions'));
                return;
            }

            setTransactions(result.data || []);
            setTransactionsSummary(result.summary || defaultTransactionSummary);
            setPages(result.pagination?.pages || 1);
            setTotalTransactions(result.pagination?.total || 0);
        } catch (err) {
            setTransactionsError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
        } finally {
            setTransactionsLoading(false);
        }
    };

    const refreshAll = async () => {
        await Promise.allSettled([fetchFinance(), fetchTrends(), fetchTransactions()]);
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

        const delimiter = lang === 'en' ? ',' : ';';
        const headers = lang === 'en'
            ? [
                'Booking #',
                'Guest',
                'Room',
                'Booking total',
                'Paid',
                'Remaining',
                'Latest payment',
                'Payment method',
                'Transaction date',
                'Payment status',
            ]
            : [
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
            escapeValue(paymentMethodLabels[tx.method]?.[lang] || tx.method),
            escapeValue(formatDateTime(tx.date)),
            escapeValue(paymentStatusLabels[tx.status]?.label?.[lang] || t(lang, 'معلق', 'Pending')),
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
        <div className="space-y-7">
            <div className="page-hero flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="relative z-10 flex items-center gap-3">
                    <div className="stat-icon">
                        <Wallet className="w-6 h-6 text-primary-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {t(lang, 'المالية', 'Finance')}
                        </h1>
                        <p className="text-white/60">
                            {t(lang, 'متابعة الإيرادات والتحصيل وحالة المدفوعات.', 'Track revenue, collections, and payment status.')}
                        </p>
                    </div>
                </div>
                <button onClick={refreshAll} className="btn-secondary relative z-10">
                    <RefreshCcw className="w-4 h-4" />
                    {t(lang, 'تحديث البيانات', 'Refresh')}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="stat-card">
                    <p className="text-sm text-white/50">
                        {t(lang, 'إيرادات هذا الشهر', 'This Month Revenue')}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-success-500">
                        {formatCurrency(data.summary.monthRevenue)}
                    </p>
                    {revenueTrend ? (
                        <div className={`mt-2 flex items-center gap-2 text-xs ${revenueTrend.isUp ? 'text-success-400' : 'text-danger-400'}`}>
                            {revenueTrend.isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {t(
                                lang,
                                `${revenueTrend.isUp ? 'زيادة' : 'انخفاض'} بنسبة ${Math.abs(revenueTrend.percent)}% عن الشهر الماضي`,
                                `${revenueTrend.isUp ? 'Up' : 'Down'} ${Math.abs(revenueTrend.percent)}% vs last month`
                            )}
                        </div>
                    ) : (
                        <div className="mt-2 text-xs text-white/40">
                            {t(lang, 'لا توجد بيانات مقارنة للشهر الماضي', 'No comparison data for last month')}
                        </div>
                    )}
                </div>
                <div className="stat-card">
                    <p className="text-sm text-white/50">
                        {t(lang, 'المدفوعات المستلمة', 'Payments Received')}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-primary-300">
                        {formatCurrency(data.summary.monthPaid)}
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                            style={{ width: `${paidRate}%` }}
                        />
                    </div>
                    <div className="mt-2 text-xs text-white/40">
                        {t(lang, `نسبة التحصيل ${paidRate}%`, `Collection rate ${paidRate}%`)}
                    </div>
                </div>
                <div className="stat-card">
                    <p className="text-sm text-white/50">
                        {t(lang, 'المتبقي للتحصيل', 'Outstanding Balance')}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-warning-500">
                        {formatCurrency(data.summary.outstandingBalance)}
                    </p>
                    <div className="mt-2 text-xs text-white/40">
                        {t(lang, 'بناءً على الحجوزات غير المسددة بالكامل.', 'Based on bookings not fully paid.')}
                    </div>
                </div>
                <div className="stat-card">
                    <p className="text-sm text-white/50">
                        {t(lang, 'إجمالي الحجوزات', 'Total Bookings')}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                        {data.summary.totalBookings}
                    </p>
                    <div className="mt-2 text-xs text-white/40">
                        {t(lang, 'الحجوزات النشطة هذا الموسم.', 'Active bookings this season.')}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-6 lg:col-span-2 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">
                            {t(lang, 'إيرادات الأشهر', 'Monthly Revenue')}
                        </h2>
                        <span className="text-xs text-white/50">
                            {t(lang, 'آخر 6 أشهر', 'Last 6 months')}
                        </span>
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
                            {t(lang, 'لا توجد بيانات لعرضها خلال الفترة المحددة.', 'No data to display for the selected period.')}
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
                                    {t(lang, 'إجمالي الإيرادات', 'Revenue')}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-success-500" />
                                    {t(lang, 'المدفوعات المستلمة', 'Paid')}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        {t(lang, 'تفاصيل الأشهر', 'Monthly Details')}
                    </h2>
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {trends.map((trend) => (
                            <div key={trend.month} className="surface-tile">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-white/70">{formatMonthLabel(trend.month)}</span>
                                    <span className="text-xs text-white/50">
                                        {t(lang, `${trend.bookings} حجز`, `${trend.bookings} bookings`)}
                                    </span>
                                </div>
                                <div className="mt-2 text-xs text-white/50">
                                    {t(lang, 'الإيرادات', 'Revenue')}: <span className="text-white/80">{formatCurrency(trend.revenue)}</span>
                                </div>
                                <div className="mt-1 text-xs text-white/50">
                                    {t(lang, 'المدفوع', 'Paid')}: <span className="text-white/80">{formatCurrency(trend.paid)}</span>
                                </div>
                                <div className="mt-1 text-xs text-white/50">
                                    {t(lang, 'المستحق', 'Outstanding')}: <span className="text-white/80">{formatCurrency(trend.outstanding)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="filter-shell">
                <div className="flex flex-col xl:flex-row xl:items-end gap-4">
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-white">
                            {t(lang, 'تصفية الحركة المالية', 'Filter Transactions')}
                        </h2>
                        <p className="text-xs text-white/50 mt-1">
                            {t(lang, 'يمكنك تحديد الفترة وحالة الدفع وطريقة الدفع لتصفية النتائج.', 'Select a date range, payment status, and method to filter results.')}
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
                            <option value="">{t(lang, 'كل حالات الدفع', 'All payment statuses')}</option>
                            <option value="paid">{paymentStatusLabels.paid.label[lang]}</option>
                            <option value="partial">{paymentStatusLabels.partial.label[lang]}</option>
                            <option value="pending">{paymentStatusLabels.pending.label[lang]}</option>
                            <option value="refunded">{paymentStatusLabels.refunded.label[lang]}</option>
                        </select>
                        <select
                            value={filters.method}
                            onChange={(e) => {
                                setPage(1);
                                setFilters((prev) => ({ ...prev, method: e.target.value }));
                            }}
                            className="input min-w-[160px]"
                        >
                            <option value="">{t(lang, 'كل طرق الدفع', 'All methods')}</option>
                            <option value="cash">{paymentMethodLabels.cash[lang]}</option>
                            <option value="card">{paymentMethodLabels.card[lang]}</option>
                            <option value="bank_transfer">{paymentMethodLabels.bank_transfer[lang]}</option>
                            <option value="online">{paymentMethodLabels.online[lang]}</option>
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                setFilters({ fromDate: '', toDate: '', status: '', method: '' });
                                setPage(1);
                            }}
                            className="btn-secondary"
                        >
                            {t(lang, 'إعادة تعيين', 'Reset')}
                        </button>
                        <button
                            type="button"
                            onClick={exportCsv}
                            className="btn-primary"
                        >
                            {t(lang, 'تصدير CSV', 'Export CSV')}
                        </button>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    {[
                        { id: 'total', label: t(lang, 'إجمالي الفترة', 'Period total'), value: formatCurrency(transactionsSummary.totalAmount), tone: 'text-success-500' },
                        { id: 'paid', label: t(lang, 'المدفوع', 'Paid'), value: formatCurrency(transactionsSummary.totalPaid), tone: 'text-primary-300' },
                        { id: 'outstanding', label: t(lang, 'المتبقي', 'Outstanding'), value: formatCurrency(transactionsSummary.totalOutstanding), tone: 'text-warning-500' },
                        { id: 'count', label: t(lang, 'عدد الحجوزات', 'Bookings'), value: transactionsSummary.count, tone: 'text-white' },
                    ].map((item) => (
                        <div key={item.id} className="surface-tile flex items-center justify-between">
                            <div>
                                <p className="text-xs text-white/50">{item.label}</p>
                                <p className={`text-lg font-semibold ${item.tone}`}>{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-6 lg:col-span-2 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">
                            {t(lang, 'تحليل التحصيل', 'Collections Analysis')}
                        </h2>
                        <DollarSign className="w-5 h-5 text-success-500" />
                    </div>
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="surface-tile">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <CheckCircle2 className="w-4 h-4 text-success-500" />
                                {t(lang, 'المدفوعات المكتملة', 'Completed Payments')}
                            </div>
                            <p className="mt-2 text-xl font-semibold text-white">
                                {data.summary.paidBookings}
                            </p>
                        </div>
                        <div className="surface-tile">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <AlertCircle className="w-4 h-4 text-warning-500" />
                                {t(lang, 'المدفوعات الجزئية', 'Partial Payments')}
                            </div>
                            <p className="mt-2 text-xl font-semibold text-white">
                                {data.summary.partialBookings}
                            </p>
                        </div>
                        <div className="surface-tile">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <Clock className="w-4 h-4 text-primary-300" />
                                {t(lang, 'المدفوعات المعلقة', 'Pending Payments')}
                            </div>
                            <p className="mt-2 text-xl font-semibold text-white">
                                {data.summary.pendingBookings}
                            </p>
                        </div>
                        <div className="surface-tile">
                            <div className="flex items-center gap-2 text-sm text-white/60">
                                <AlertCircle className="w-4 h-4 text-danger-500" />
                                {t(lang, 'المدفوعات المستردة', 'Refunded Payments')}
                            </div>
                            <p className="mt-2 text-xl font-semibold text-white">
                                {data.summary.refundedBookings}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        {t(lang, 'توزيع الحالة', 'Status Breakdown')}
                    </h2>
                    <div className="space-y-3 text-sm">
                        {[
                            { key: 'paid', value: data.summary.paidBookings },
                            { key: 'partial', value: data.summary.partialBookings },
                            { key: 'pending', value: data.summary.pendingBookings },
                            { key: 'refunded', value: data.summary.refundedBookings },
                        ].map((item) => {
                            const status = paymentStatusLabels[item.key];
                            return (
                                <div key={item.key} className="surface-tile flex items-center justify-between">
                                    <span className="text-white/70">{status.label[lang]}</span>
                                    <span className={status.badge}>{item.value}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">
                        {t(lang, 'الدفعات الأخيرة', 'Recent Payments')}
                    </h2>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="spinner w-8 h-8" />
                    </div>
                ) : data.recentPayments.length === 0 ? (
                    <div className="text-center text-white/60 py-8">
                        {t(lang, 'لا توجد دفعات مسجلة حتى الآن.', 'No payments recorded yet.')}
                    </div>
                ) : (
                    <div className="table-container shadow-card">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t(lang, 'رقم الحجز', 'Booking #')}</th>
                                    <th>{t(lang, 'النزيل', 'Guest')}</th>
                                    <th>{t(lang, 'الغرفة', 'Room')}</th>
                                    <th>{t(lang, 'المبلغ', 'Amount')}</th>
                                    <th>{t(lang, 'طريقة الدفع', 'Method')}</th>
                                    <th>{t(lang, 'التاريخ', 'Date')}</th>
                                    <th>{t(lang, 'الحالة', 'Status')}</th>
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
                                                {paymentMethodLabels[payment.method]?.[lang] || payment.method}
                                            </td>
                                            <td className="text-white/60">{formatDateTime(payment.date)}</td>
                                            <td>
                                                <span className={status.badge}>{status.label[lang]}</span>
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
                    <h2 className="text-lg font-semibold text-white">
                        {t(lang, 'حركة المدفوعات', 'Payment Activity')}
                    </h2>
                    <span className="text-xs text-white/50">
                        {t(
                            lang,
                            `عرض ${transactions.length} من أصل ${totalTransactions}`,
                            `Showing ${transactions.length} of ${totalTransactions}`
                        )}
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
                        {t(lang, 'لا توجد عمليات ضمن الفترة المحددة.', 'No transactions in the selected period.')}
                    </div>
                ) : (
                    <div className="table-container shadow-card">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t(lang, 'رقم الحجز', 'Booking #')}</th>
                                    <th>{t(lang, 'النزيل', 'Guest')}</th>
                                    <th>{t(lang, 'الغرفة', 'Room')}</th>
                                    <th>{t(lang, 'الإجمالي', 'Total')}</th>
                                    <th>{t(lang, 'المدفوع', 'Paid')}</th>
                                    <th>{t(lang, 'المتبقي', 'Remaining')}</th>
                                    <th>{t(lang, 'آخر دفعة', 'Latest payment')}</th>
                                    <th>{t(lang, 'طريقة الدفع', 'Method')}</th>
                                    <th>{t(lang, 'التاريخ', 'Date')}</th>
                                    <th>{t(lang, 'الحالة', 'Status')}</th>
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
                                                {paymentMethodLabels[tx.method]?.[lang] || tx.method}
                                            </td>
                                            <td className="text-white/60">{formatDateTime(tx.date)}</td>
                                            <td>
                                                <span className={status.badge}>{status.label[lang]}</span>
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
                        {t(lang, `صفحة ${page} من ${pages}`, `Page ${page} of ${pages}`)}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                            className="btn-secondary text-sm"
                            disabled={page <= 1}
                        >
                            {t(lang, 'السابق', 'Prev')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((prev) => Math.min(prev + 1, pages))}
                            className="btn-secondary text-sm"
                            disabled={page >= pages}
                        >
                            {t(lang, 'التالي', 'Next')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
