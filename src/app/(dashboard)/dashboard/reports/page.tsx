'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    BarChart3,
    CheckCircle2,
    Clock,
    Download,
    RefreshCcw,
    TrendingDown,
    TrendingUp,
    Wallet,
    AlertCircle,
} from 'lucide-react';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';

interface FinanceTrend {
    month: string;
    revenue: number;
    paid: number;
    outstanding: number;
    bookings: number;
}

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

interface TrendsResponse {
    data?: FinanceTrend[];
    error?: string;
}

interface OverviewResponse {
    data?: {
        summary?: FinanceSummary;
    };
    error?: string;
}

const defaultSummary: FinanceSummary = {
    monthRevenue: 0,
    lastMonthRevenue: 0,
    monthPaid: 0,
    outstandingBalance: 0,
    totalBookings: 0,
    paidBookings: 0,
    partialBookings: 0,
    pendingBookings: 0,
    refundedBookings: 0,
};

const statusLabels = {
    paid: { ar: 'مدفوع', en: 'Paid', tone: 'badge-success' },
    partial: { ar: 'جزئي', en: 'Partial', tone: 'badge-warning' },
    pending: { ar: 'معلق', en: 'Pending', tone: 'badge bg-white/10 text-white/60' },
    refunded: { ar: 'مسترد', en: 'Refunded', tone: 'badge-danger' },
} as const;

export default function ReportsPage() {
    const { settings: hotelSettings } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
    const [months, setMonths] = useState(6);
    const [trends, setTrends] = useState<FinanceTrend[]>([]);
    const [summary, setSummary] = useState<FinanceSummary>(defaultSummary);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchReports(months);
    }, [months]);

    const fetchReports = async (monthsValue: number) => {
        setLoading(true);
        setError(null);

        try {
            const [trendsResponse, overviewResponse] = await Promise.all([
                fetchWithRefresh(`/api/finance/trends?months=${monthsValue}`),
                fetchWithRefresh('/api/finance/overview'),
            ]);

            const [trendsResult, overviewResult] = await Promise.all([
                trendsResponse.json() as Promise<TrendsResponse>,
                overviewResponse.json() as Promise<OverviewResponse>,
            ]);

            if (!trendsResponse.ok || !overviewResponse.ok) {
                setError(
                    trendsResult.error ||
                    overviewResult.error ||
                    t(lang, 'تعذر تحميل بيانات التقارير', 'Failed to load report data')
                );
                return;
            }

            setTrends(Array.isArray(trendsResult.data) ? trendsResult.data : []);
            setSummary({ ...defaultSummary, ...(overviewResult.data?.summary || {}) });
        } catch (err) {
            setError(
                t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server')
            );
        } finally {
            setLoading(false);
        }
    };

    const refreshReports = async () => {
        await fetchReports(months);
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

    const formatMonthLabel = (monthKey: string) => {
        const [year, month] = monthKey.split('-').map((value) => Number(value));
        if (!year || !month) return monthKey;
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        return new Date(year, month - 1, 1).toLocaleDateString(locale, {
            month: 'short',
            year: '2-digit',
        });
    };

    const periodTotals = useMemo(() => {
        return trends.reduce(
            (acc, trend) => {
                acc.revenue += trend.revenue || 0;
                acc.paid += trend.paid || 0;
                acc.outstanding += trend.outstanding || 0;
                acc.bookings += trend.bookings || 0;
                return acc;
            },
            { revenue: 0, paid: 0, outstanding: 0, bookings: 0 }
        );
    }, [trends]);

    const maxTrendRevenue = useMemo(() => {
        const values = trends.map((trend) => trend.revenue || 0);
        return Math.max(...values, 1);
    }, [trends]);

    const periodCollectionRate = periodTotals.revenue > 0
        ? Math.min(100, Math.round((periodTotals.paid / periodTotals.revenue) * 100))
        : 0;

    const bestMonth = useMemo(() => {
        if (trends.length === 0) return null;
        return trends.reduce((best, current) => (current.revenue > best.revenue ? current : best), trends[0]);
    }, [trends]);

    const weakestMonth = useMemo(() => {
        if (trends.length === 0) return null;
        return trends.reduce((weakest, current) => (current.revenue < weakest.revenue ? current : weakest), trends[0]);
    }, [trends]);

    const monthRevenueTrend = useMemo(() => {
        if (summary.lastMonthRevenue <= 0) return null;
        const diff = summary.monthRevenue - summary.lastMonthRevenue;
        const percent = Math.round((diff / summary.lastMonthRevenue) * 100);
        return {
            isUp: diff >= 0,
            percent: Math.abs(percent),
        };
    }, [summary.monthRevenue, summary.lastMonthRevenue]);

    const exportCsv = () => {
        if (trends.length === 0) return;

        const delimiter = lang === 'en' ? ',' : ';';
        const headers = lang === 'en'
            ? ['Month', 'Bookings', 'Revenue', 'Paid', 'Outstanding', 'Collection rate']
            : ['الشهر', 'الحجوزات', 'الإيرادات', 'المدفوع', 'المستحق', 'نسبة التحصيل'];

        const escapeValue = (value: string | number) => {
            const str = String(value ?? '').replace(/[\r\n]+/g, ' ');
            return `"${str.replace(/"/g, '""')}"`;
        };

        const rows = trends.map((trend) => {
            const rate = trend.revenue > 0 ? Math.round((trend.paid / trend.revenue) * 100) : 0;
            return [
                escapeValue(formatMonthLabel(trend.month)),
                escapeValue(trend.bookings),
                escapeValue(formatCurrency(trend.revenue)),
                escapeValue(formatCurrency(trend.paid)),
                escapeValue(formatCurrency(trend.outstanding)),
                escapeValue(`${rate}%`),
            ];
        });

        const csvContent = [headers, ...rows].map((row) => row.join(delimiter)).join('\n');
        const bom = '\ufeff';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `finance-report-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-7">
            <div className="page-hero flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                <div className="relative z-10 flex items-center gap-3">
                    <div className="stat-icon">
                        <BarChart3 className="w-6 h-6 text-primary-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {t(lang, 'التقارير', 'Reports')}
                        </h1>
                        <p className="text-white/60">
                            {t(lang, 'تحليلات مالية احترافية لاتجاهات الإيرادات والتحصيل.', 'Professional financial insights for revenue and collections trends.')}
                        </p>
                    </div>
                </div>
                <div className="relative z-10 flex flex-wrap items-center gap-2">
                    <select
                        value={months}
                        onChange={(e) => setMonths(Number(e.target.value))}
                        className="input-compact min-w-[148px]"
                    >
                        <option value={3}>{t(lang, 'آخر 3 أشهر', 'Last 3 months')}</option>
                        <option value={6}>{t(lang, 'آخر 6 أشهر', 'Last 6 months')}</option>
                        <option value={12}>{t(lang, 'آخر 12 شهر', 'Last 12 months')}</option>
                        <option value={24}>{t(lang, 'آخر 24 شهر', 'Last 24 months')}</option>
                    </select>
                    <button type="button" onClick={refreshReports} className="btn-secondary">
                        <RefreshCcw className="w-4 h-4" />
                        {t(lang, 'تحديث', 'Refresh')}
                    </button>
                    <button type="button" onClick={exportCsv} className="btn-primary">
                        <Download className="w-4 h-4" />
                        {t(lang, 'تصدير CSV', 'Export CSV')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="stat-card">
                    <p className="text-sm text-white/50">
                        {t(lang, 'إيرادات الفترة', 'Period Revenue')}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-success-500">
                        {formatCurrency(periodTotals.revenue)}
                    </p>
                    {monthRevenueTrend ? (
                        <div className={`mt-2 flex items-center gap-2 text-xs ${monthRevenueTrend.isUp ? 'text-success-400' : 'text-danger-400'}`}>
                            {monthRevenueTrend.isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {t(
                                lang,
                                `${monthRevenueTrend.isUp ? 'تغير إيجابي' : 'تغير سلبي'} ${monthRevenueTrend.percent}% مقارنة بالشهر الماضي`,
                                `${monthRevenueTrend.isUp ? 'Up' : 'Down'} ${monthRevenueTrend.percent}% vs last month`
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
                        {t(lang, 'مدفوعات الفترة', 'Period Paid')}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-primary-300">
                        {formatCurrency(periodTotals.paid)}
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary-500 to-accent-500"
                            style={{ width: `${periodCollectionRate}%` }}
                        />
                    </div>
                    <div className="mt-2 text-xs text-white/40">
                        {t(lang, `نسبة التحصيل ${periodCollectionRate}%`, `Collection rate ${periodCollectionRate}%`)}
                    </div>
                </div>

                <div className="stat-card">
                    <p className="text-sm text-white/50">
                        {t(lang, 'المبالغ المستحقة', 'Outstanding')}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-warning-500">
                        {formatCurrency(periodTotals.outstanding)}
                    </p>
                    <div className="mt-2 text-xs text-white/40">
                        {t(lang, 'إجمالي المتبقي خلال الفترة المختارة.', 'Total remaining balance for the selected period.')}
                    </div>
                </div>

                <div className="stat-card">
                    <p className="text-sm text-white/50">
                        {t(lang, 'إجمالي الحجوزات', 'Total Bookings')}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-white">
                        {periodTotals.bookings}
                    </p>
                    <div className="mt-2 text-xs text-white/40">
                        {t(lang, 'عدد الحجوزات المشمولة في التقرير.', 'Bookings included in this report.')}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">
                            {t(lang, 'اتجاه الإيرادات والتحصيل', 'Revenue & Collection Trend')}
                        </h2>
                        <span className="text-xs text-white/50">
                            {t(lang, `${months} أشهر`, `${months} months`)}
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-14">
                            <div className="spinner w-8 h-8" />
                        </div>
                    ) : trends.length === 0 ? (
                        <div className="text-center text-white/60 py-14">
                            {t(lang, 'لا توجد بيانات للعرض خلال الفترة الحالية.', 'No data to display for this period.')}
                        </div>
                    ) : (
                        <>
                            <div className="h-56 flex items-end justify-between gap-3">
                                {trends.map((trend) => {
                                    const revenueHeight = Math.max(8, Math.round((trend.revenue / maxTrendRevenue) * 100));
                                    const paidHeight = Math.max(8, Math.round((trend.paid / maxTrendRevenue) * 100));

                                    return (
                                        <div key={trend.month} className="flex-1 min-w-0 flex flex-col items-center gap-2">
                                            <div className="w-full max-w-[56px] h-44 rounded-2xl border border-white/10 bg-white/5 px-2 flex items-end gap-1">
                                                <div
                                                    className="w-1/2 rounded-lg bg-gradient-to-t from-primary-500 to-accent-500"
                                                    style={{ height: `${revenueHeight}%` }}
                                                />
                                                <div
                                                    className="w-1/2 rounded-lg bg-success-500/90"
                                                    style={{ height: `${paidHeight}%` }}
                                                />
                                            </div>
                                            <p className="text-[11px] text-white/60 truncate">
                                                {formatMonthLabel(trend.month)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 flex items-center gap-6 text-xs text-white/50">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-gradient-to-r from-primary-500 to-accent-500" />
                                    {t(lang, 'الإيرادات', 'Revenue')}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-success-500" />
                                    {t(lang, 'المدفوع', 'Paid')}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        {t(lang, 'ملخص تحليلي', 'Analytical Summary')}
                    </h2>
                    <div className="space-y-3">
                        <div className="surface-tile">
                            <p className="text-xs text-white/50">{t(lang, 'أفضل شهر', 'Best Month')}</p>
                            <p className="mt-1 text-sm text-white/80">
                                {bestMonth
                                    ? `${formatMonthLabel(bestMonth.month)} • ${formatCurrency(bestMonth.revenue)}`
                                    : t(lang, 'غير متاح', 'N/A')}
                            </p>
                        </div>
                        <div className="surface-tile">
                            <p className="text-xs text-white/50">{t(lang, 'أضعف شهر', 'Weakest Month')}</p>
                            <p className="mt-1 text-sm text-white/80">
                                {weakestMonth
                                    ? `${formatMonthLabel(weakestMonth.month)} • ${formatCurrency(weakestMonth.revenue)}`
                                    : t(lang, 'غير متاح', 'N/A')}
                            </p>
                        </div>
                        <div className="surface-tile">
                            <p className="text-xs text-white/50">{t(lang, 'متوسط الإيراد لكل حجز', 'Average Revenue per Booking')}</p>
                            <p className="mt-1 text-sm text-white/80">
                                {periodTotals.bookings > 0
                                    ? formatCurrency(periodTotals.revenue / periodTotals.bookings)
                                    : t(lang, 'غير متاح', 'N/A')}
                            </p>
                        </div>
                        <div className="surface-tile">
                            <p className="text-xs text-white/50">{t(lang, 'قيمة الذمم الحالية', 'Current Outstanding Balance')}</p>
                            <p className="mt-1 text-sm text-warning-500">
                                {formatCurrency(summary.outstandingBalance)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="card p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">
                            {t(lang, 'تفاصيل الأشهر', 'Monthly Details')}
                        </h2>
                        <Wallet className="w-5 h-5 text-primary-300" />
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="spinner w-8 h-8" />
                        </div>
                    ) : trends.length === 0 ? (
                        <div className="text-center text-white/60 py-10">
                            {t(lang, 'لا توجد تفاصيل متاحة.', 'No details available.')}
                        </div>
                    ) : (
                        <div className="table-container shadow-card">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>{t(lang, 'الشهر', 'Month')}</th>
                                        <th>{t(lang, 'الحجوزات', 'Bookings')}</th>
                                        <th>{t(lang, 'الإيرادات', 'Revenue')}</th>
                                        <th>{t(lang, 'المدفوع', 'Paid')}</th>
                                        <th>{t(lang, 'المستحق', 'Outstanding')}</th>
                                        <th>{t(lang, 'التحصيل', 'Collection')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trends.map((trend) => {
                                        const rate = trend.revenue > 0
                                            ? Math.min(100, Math.round((trend.paid / trend.revenue) * 100))
                                            : 0;
                                        return (
                                            <tr key={trend.month}>
                                                <td className="font-medium text-white">{formatMonthLabel(trend.month)}</td>
                                                <td className="text-white/70">{trend.bookings}</td>
                                                <td className="text-success-500">{formatCurrency(trend.revenue)}</td>
                                                <td className="text-primary-300">{formatCurrency(trend.paid)}</td>
                                                <td className="text-warning-500">{formatCurrency(trend.outstanding)}</td>
                                                <td>
                                                    <span className="badge-primary">{rate}%</span>
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
                            {t(lang, 'حالة المدفوعات', 'Payment Status')}
                        </h2>
                        <AlertCircle className="w-5 h-5 text-warning-500" />
                    </div>

                    <div className="space-y-3">
                        {[
                            { key: 'paid', value: summary.paidBookings, icon: CheckCircle2 },
                            { key: 'partial', value: summary.partialBookings, icon: Wallet },
                            { key: 'pending', value: summary.pendingBookings, icon: Clock },
                            { key: 'refunded', value: summary.refundedBookings, icon: AlertCircle },
                        ].map((item) => {
                            const status = statusLabels[item.key as keyof typeof statusLabels];
                            return (
                                <div key={item.key} className="surface-tile flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <item.icon className="w-4 h-4 text-white/60 shrink-0" />
                                        <span className="text-sm text-white/70 truncate">
                                            {status[lang]}
                                        </span>
                                    </div>
                                    <span className={status.tone}>{item.value}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

