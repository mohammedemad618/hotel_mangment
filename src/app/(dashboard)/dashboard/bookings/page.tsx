'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import {
    Plus,
    Search,
    CalendarCheck,
    Eye,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    LogIn,
    LogOut,
    LayoutGrid,
    List,
    ArrowUpDown,
    DollarSign,
    Users,
} from 'lucide-react';

interface Booking {
    _id: string;
    bookingNumber: string;
    roomId: { roomNumber: string; type: string };
    guestId: { firstName: string; lastName: string; phone: string };
    checkInDate: string;
    checkOutDate: string;
    status: string;
    pricing: { total: number };
    payment: { status: string; paidAmount?: number };
    createdAt?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'قيد الانتظار', color: 'badge-warning', icon: Clock },
    confirmed: { label: 'مؤكد', color: 'badge-primary', icon: CheckCircle },
    checked_in: { label: 'مسجل الوصول', color: 'badge-success', icon: LogIn },
    checked_out: { label: 'غادر', color: 'badge bg-white/10 text-white/60', icon: LogOut },
    cancelled: { label: 'ملغي', color: 'badge-danger', icon: XCircle },
    no_show: { label: 'لم يحضر', color: 'badge-danger', icon: AlertCircle },
};

const paymentStatusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: 'غير مدفوع', color: 'text-warning-500' },
    partial: { label: 'دفع جزئي', color: 'text-primary-300' },
    paid: { label: 'مدفوع', color: 'text-success-500' },
    refunded: { label: 'مسترد', color: 'text-white/60' },
};

const sortOptions = [
    { value: 'checkInDate', label: 'تاريخ الوصول' },
    { value: 'checkOutDate', label: 'تاريخ المغادرة' },
    { value: 'total', label: 'قيمة الحجز' },
    { value: 'createdAt', label: 'تاريخ الإنشاء' },
] as const;

export default function BookingsPage() {
    const { settings: hotelSettings } = useHotelSettings();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [sortBy, setSortBy] = useState<'checkInDate' | 'checkOutDate' | 'total' | 'createdAt'>('checkInDate');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

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

    useEffect(() => {
        fetchBookings();
    }, [statusFilter, paymentFilter, dateFrom, dateTo]);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            if (paymentFilter) params.set('paymentStatus', paymentFilter);
            if (dateFrom) params.set('fromDate', dateFrom);
            if (dateTo) params.set('toDate', dateTo);

            const response = await fetchWithRefresh(`/api/bookings?${params}`);
            const data = await response.json();

            if (data.success) {
                setBookings(data.data);
            }
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const timeZone = hotelSettings?.timezone || 'Asia/Riyadh';
        return new Date(dateStr).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone,
        });
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

    const calculateNights = (checkIn: string, checkOut: string) => {
        const start = new Date(checkIn).getTime();
        const end = new Date(checkOut).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
        const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return Math.max(diff, 0);
    };

    const stats = useMemo(() => {
        const total = bookings.length;
        const pending = bookings.filter((booking) => booking.status === 'pending').length;
        const confirmed = bookings.filter((booking) => booking.status === 'confirmed').length;
        const checkedIn = bookings.filter((booking) => booking.status === 'checked_in').length;
        const checkedOut = bookings.filter((booking) => booking.status === 'checked_out').length;
        const cancelled = bookings.filter((booking) => booking.status === 'cancelled').length;
        const revenue = bookings
            .filter((booking) => booking.status !== 'cancelled')
            .reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0);

        return { total, pending, confirmed, checkedIn, checkedOut, cancelled, revenue };
    }, [bookings]);

    const filteredBookings = useMemo(() => {
        const query = search.trim().toLowerCase();
        return bookings.filter((booking) => {
            if (paymentFilter && booking.payment?.status !== paymentFilter) return false;

            if (!query) return true;
            const guestName = `${booking.guestId?.firstName || ''} ${booking.guestId?.lastName || ''}`.toLowerCase();
            const roomNumber = booking.roomId?.roomNumber?.toLowerCase() || '';
            return (
                booking.bookingNumber.toLowerCase().includes(query) ||
                guestName.includes(query) ||
                booking.guestId?.phone?.toLowerCase().includes(query) ||
                roomNumber.includes(query)
            );
        });
    }, [bookings, search, paymentFilter]);

    const sortedBookings = useMemo(() => {
        const sorted = [...filteredBookings];
        sorted.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'total') {
                comparison = (a.pricing?.total || 0) - (b.pricing?.total || 0);
            } else if (sortBy === 'checkInDate') {
                comparison = new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime();
            } else if (sortBy === 'checkOutDate') {
                comparison = new Date(a.checkOutDate).getTime() - new Date(b.checkOutDate).getTime();
            } else if (sortBy === 'createdAt') {
                comparison = new Date(a.createdAt || a.checkInDate).getTime() - new Date(b.createdAt || b.checkInDate).getTime();
            }
            return sortDir === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [filteredBookings, sortBy, sortDir]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        إدارة الحجوزات
                    </h1>
                    <p className="mt-1 text-white/60">
                        عرض وإدارة جميع الحجوزات ومتابعة المدفوعات
                    </p>
                </div>
                <Link href="/dashboard/bookings/new" className="btn-primary">
                    <Plus className="w-5 h-5" />
                    <span>حجز جديد</span>
                </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                    { label: 'إجمالي الحجوزات', value: stats.total, icon: CalendarCheck, tone: 'text-primary-300' },
                    { label: 'قيد الانتظار', value: stats.pending, icon: Clock, tone: 'text-warning-500' },
                    { label: 'مؤكدة', value: stats.confirmed, icon: CheckCircle, tone: 'text-primary-300' },
                    { label: 'نزلاء حاليون', value: stats.checkedIn, icon: LogIn, tone: 'text-success-500' },
                    { label: 'مغادرة', value: stats.checkedOut, icon: LogOut, tone: 'text-white/60' },
                    { label: 'إجمالي القيمة', value: formatCurrency(stats.revenue), icon: DollarSign, tone: 'text-success-500' },
                ].map((item) => (
                    <div key={item.label} className="card p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                            <item.icon className={`w-5 h-5 ${item.tone}`} />
                        </div>
                        <div>
                            <p className="text-xs text-white/50">{item.label}</p>
                            <p className="text-lg font-semibold text-white">{item.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card p-4">
                <div className="flex flex-col xl:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                        <input
                            type="text"
                            placeholder="ابحث برقم الحجز أو النزيل أو رقم الغرفة..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input pr-10"
                        />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="input min-w-[150px]"
                        >
                            <option value="">كل الحالات</option>
                            <option value="pending">قيد الانتظار</option>
                            <option value="confirmed">مؤكد</option>
                            <option value="checked_in">مسجل الوصول</option>
                            <option value="checked_out">غادر</option>
                            <option value="cancelled">ملغي</option>
                            <option value="no_show">لم يحضر</option>
                        </select>
                        <select
                            value={paymentFilter}
                            onChange={(e) => setPaymentFilter(e.target.value)}
                            className="input min-w-[150px]"
                        >
                            <option value="">كل المدفوعات</option>
                            <option value="pending">غير مدفوع</option>
                            <option value="partial">دفع جزئي</option>
                            <option value="paid">مدفوع</option>
                            <option value="refunded">مسترد</option>
                        </select>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="input min-w-[150px]"
                        />
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="input min-w-[150px]"
                        />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                            className="input min-w-[150px]"
                        >
                            {sortOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                            className="btn-secondary text-sm"
                        >
                            <ArrowUpDown className="w-4 h-4" />
                            {sortDir === 'asc' ? 'تصاعدي' : 'تنازلي'}
                        </button>
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
                            <button
                                type="button"
                                onClick={() => setViewMode('grid')}
                                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${viewMode === 'grid'
                                        ? 'bg-primary-500/20 text-white'
                                        : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                                شبكة
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${viewMode === 'list'
                                        ? 'bg-primary-500/20 text-white'
                                        : 'text-white/60 hover:text-white'
                                    }`}
                            >
                                <List className="w-4 h-4" />
                                قائمة
                            </button>
                        </div>
                    </div>
                </div>
                <div className="mt-3 text-xs text-white/50">
                    عرض {sortedBookings.length} من أصل {bookings.length} حجز
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="spinner w-10 h-10" />
                </div>
            ) : sortedBookings.length === 0 ? (
                <div className="card p-12 text-center">
                    <CalendarCheck className="w-16 h-16 mx-auto text-white/30" />
                    <p className="mt-4 text-white/60">
                        لا توجد حجوزات{search ? ' تطابق البحث' : ''}.
                    </p>
                    <Link href="/dashboard/bookings/new" className="btn-primary mt-4 inline-flex">
                        <Plus className="w-5 h-5" />
                        <span>إنشاء حجز جديد</span>
                    </Link>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sortedBookings.map((booking, index) => {
                        const status = statusConfig[booking.status] || statusConfig.pending;
                        const StatusIcon = status.icon;
                        const paymentStatus = paymentStatusLabels[booking.payment?.status] || paymentStatusLabels.pending;
                        const nights = calculateNights(booking.checkInDate, booking.checkOutDate);
                        const total = booking.pricing?.total || 0;
                        const paid = booking.payment?.paidAmount || 0;
                        const remaining = Math.max(total - paid, 0);

                        return (
                            <div
                                key={booking._id}
                                className="card p-5 hover:shadow-card-hover transition-shadow animate-slide-up"
                                style={{ animationDelay: `${index * 30}ms` }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <p className="text-xs text-white/40">رقم الحجز</p>
                                        <h3 className="text-lg font-bold text-white">{booking.bookingNumber}</h3>
                                        <p className="text-sm text-white/50">
                                            {booking.guestId?.firstName} {booking.guestId?.lastName}
                                        </p>
                                    </div>
                                    <span className={status.color}>
                                        <StatusIcon className="w-3 h-3 ml-1 inline" />
                                        {status.label}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between text-white/60">
                                        <span>الغرفة</span>
                                        <span className="text-white">{booking.roomId?.roomNumber}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-white/60">
                                        <span>الفترة</span>
                                        <span className="text-white">{formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-white/60">
                                        <span>الليالي</span>
                                        <span className="text-white">{nights} ليلة</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/60">الإجمالي</span>
                                        <span className="text-success-500 font-semibold">{formatCurrency(total)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/60">المتبقي</span>
                                        <span className="text-primary-300 font-semibold">{formatCurrency(remaining)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-white/60">الدفع</span>
                                        <span className={`font-medium ${paymentStatus.color}`}>{paymentStatus.label}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                                    <Link
                                        href={`/dashboard/bookings/${booking._id}`}
                                        className="btn-secondary text-sm"
                                    >
                                        عرض التفاصيل
                                    </Link>
                                    <div className="flex items-center gap-2 text-xs text-white/40">
                                        <Users className="w-4 h-4" />
                                        {booking.guestId?.phone}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>رقم الحجز</th>
                                <th>النزيل</th>
                                <th>الغرفة</th>
                                <th>الوصول</th>
                                <th>المغادرة</th>
                                <th>الليالي</th>
                                <th>المبلغ</th>
                                <th>الدفع</th>
                                <th>الحالة</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedBookings.map((booking, index) => {
                                const status = statusConfig[booking.status] || statusConfig.pending;
                                const StatusIcon = status.icon;
                                const paymentStatus = paymentStatusLabels[booking.payment?.status] || paymentStatusLabels.pending;
                                const nights = calculateNights(booking.checkInDate, booking.checkOutDate);

                                return (
                                    <tr
                                        key={booking._id}
                                        className="animate-slide-up"
                                        style={{ animationDelay: `${index * 30}ms` }}
                                    >
                                        <td className="font-medium text-white">
                                            {booking.bookingNumber}
                                        </td>
                                        <td>
                                            <div>
                                                <p className="font-medium text-white">
                                                    {booking.guestId?.firstName} {booking.guestId?.lastName}
                                                </p>
                                                <p className="text-xs text-white/50">{booking.guestId?.phone}</p>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge-primary">{booking.roomId?.roomNumber}</span>
                                        </td>
                                        <td className="text-white/60">
                                            {formatDate(booking.checkInDate)}
                                        </td>
                                        <td className="text-white/60">
                                            {formatDate(booking.checkOutDate)}
                                        </td>
                                        <td className="text-white/60">{nights} ليلة</td>
                                        <td className="font-medium text-white">
                                            {formatCurrency(booking.pricing?.total || 0)}
                                        </td>
                                        <td>
                                            <span className={`text-sm font-medium ${paymentStatus.color}`}>
                                                {paymentStatus.label}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={status.color}>
                                                <StatusIcon className="w-3 h-3 ml-1 inline" />
                                                {status.label}
                                            </span>
                                        </td>
                                        <td>
                                            <Link
                                                href={`/dashboard/bookings/${booking._id}`}
                                                className="p-2 rounded-lg hover:bg-white/10 inline-flex"
                                            >
                                                <Eye className="w-4 h-4 text-white/60" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
