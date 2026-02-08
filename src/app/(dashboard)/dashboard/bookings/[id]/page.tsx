'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import {
    ArrowRight,
    CalendarCheck,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    LogIn,
    LogOut,
    BedDouble,
    User,
    DollarSign,
    Save,
    Loader2,
    CreditCard,
    FileText,
    Ban,
    Printer,
} from 'lucide-react';

interface BookingDetail {
    _id: string;
    bookingNumber: string;
    roomId: { _id: string; roomNumber: string; type: string; floor: number };
    guestId: { _id: string; firstName: string; lastName: string; phone: string; email?: string };
    checkInDate: string;
    checkOutDate: string;
    numberOfGuests?: { adults: number; children: number };
    source?: string;
    status: string;
    pricing: {
        roomRate?: number;
        numberOfNights?: number;
        subtotal: number;
        taxes: number;
        discount?: number;
        total: number;
    };
    payment: {
        status: string;
        paidAmount: number;
        method?: string;
        transactions?: Array<{
            amount: number;
            method: string;
            date: string;
            reference?: string;
        }>;
    };
    notes?: string;
    specialRequests?: string;
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

const paymentMethods = [
    { value: 'cash', label: 'نقدي' },
    { value: 'card', label: 'بطاقة' },
    { value: 'bank_transfer', label: 'تحويل بنكي' },
    { value: 'online', label: 'دفع إلكتروني' },
] as const;

const bookingSourceLabels: Record<string, string> = {
    direct: 'مباشر',
    website: 'الموقع',
    phone: 'هاتف',
    walkin: 'حجز مباشر',
    ota: 'وكالات',
};

export default function BookingDetailsPage() {
    const { settings: hotelSettings, hotelProfile } = useHotelSettings();
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [booking, setBooking] = useState<BookingDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [notesDraft, setNotesDraft] = useState('');
    const [requestsDraft, setRequestsDraft] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'online'>('cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [cancelReason, setCancelReason] = useState('');
    const [printDate, setPrintDate] = useState<string | null>(null);

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
        const fetchBooking = async () => {
            try {
                const response = await fetchWithRefresh(`/api/bookings/${id}`);
                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || 'تعذر جلب بيانات الحجز');
                    return;
                }

                setBooking(data.data);
                setNotesDraft(data.data.notes || '');
                setRequestsDraft(data.data.specialRequests || '');
            } catch (err) {
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };

        fetchBooking();
    }, [id]);

    useEffect(() => {
        if (booking) {
            setNotesDraft(booking.notes || '');
            setRequestsDraft(booking.specialRequests || '');
        }
    }, [booking]);

    const updateBooking = async (payload: Record<string, any>, successMessage: string) => {
        setActionError(null);
        setActionSuccess(null);
        setUpdating(true);
        try {
            const response = await fetchWithRefresh(`/api/bookings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            if (!response.ok) {
                setActionError(result.error || 'تعذر تحديث الحجز');
                return;
            }

            setBooking(result.data);
            setActionSuccess(successMessage);
        } catch (err) {
            setActionError('حدث خطأ في الاتصال بالخادم');
        } finally {
            setUpdating(false);
        }
    };

    const handleStatusChange = async (status: string, message: string) => {
        await updateBooking({ status }, message);
    };

    const handleCancel = async () => {
        const confirmed = window.confirm('هل تريد إلغاء هذا الحجز؟');
        if (!confirmed) return;

        await updateBooking(
            { status: 'cancelled', cancellationReason: cancelReason || undefined },
            'تم إلغاء الحجز بنجاح'
        );
    };

    const handleAddPayment = async () => {
        if (!booking) return;
        const amount = Number(paymentAmount);
        const total = booking.pricing?.total || 0;
        const paid = booking.payment?.paidAmount || 0;
        const remaining = Math.max(total - paid, 0);

        if (!Number.isFinite(amount) || amount <= 0) {
            setActionError('أدخل مبلغاً صحيحاً');
            return;
        }
        if (amount > remaining) {
            setActionError('المبلغ أكبر من المتبقي');
            return;
        }

        await updateBooking(
            {
                payment: {
                    addPayment: {
                        amount,
                        method: paymentMethod,
                        reference: paymentReference || undefined,
                    },
                },
            },
            'تم تسجيل الدفعة بنجاح'
        );

        setPaymentAmount('');
        setPaymentReference('');
    };

    const handleConfirmPayment = async () => {
        if (!booking) return;
        const total = booking.pricing?.total || 0;
        const paid = booking.payment?.paidAmount || 0;
        const remaining = Math.max(total - paid, 0);

        if (remaining > 0) {
            setActionError('لا يمكن تأكيد الدفع قبل تسوية المبلغ المتبقي');
            return;
        }

        await updateBooking(
            { payment: { status: 'paid', paidAmount: total } },
            'تم تأكيد الدفع بنجاح'
        );
    };

    const handlePrintReceipt = () => {
        setPrintDate(new Date().toISOString());
        setTimeout(() => window.print(), 50);
    };

    const handleSaveNotes = async () => {
        await updateBooking(
            { notes: notesDraft, specialRequests: requestsDraft },
            'تم تحديث الملاحظات بنجاح'
        );
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

    const formatDateTime = (dateStr?: string) => {
        if (!dateStr) return '-';
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const timeZone = hotelSettings?.timezone || 'Asia/Riyadh';
        return new Date(dateStr).toLocaleString(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
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

    const nights = useMemo(() => {
        if (!booking) return 0;
        const start = new Date(booking.checkInDate).getTime();
        const end = new Date(booking.checkOutDate).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
        return Math.max(Math.ceil((end - start) / (1000 * 60 * 60 * 24)), 0);
    }, [booking]);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="spinner w-10 h-10" />
            </div>
        );
    }

    if (error || !booking) {
        return (
            <div className="card p-8 text-center">
                <p className="text-danger-600">{error || 'الحجز غير موجود'}</p>
                <button onClick={() => router.back()} className="btn-secondary mt-4">
                    العودة
                </button>
            </div>
        );
    }

    const status = statusConfig[booking.status] || statusConfig.pending;
    const StatusIcon = status.icon;
    const paymentStatus = paymentStatusLabels[booking.payment?.status] || paymentStatusLabels.pending;
    const total = booking.pricing?.total || 0;
    const paid = booking.payment?.paidAmount || 0;
    const remaining = Math.max(total - paid, 0);
    const transactions = booking.payment?.transactions || [];
    const latestTransaction = transactions.length ? transactions[transactions.length - 1] : null;
    const paymentMethodValue = latestTransaction?.method || booking.payment?.method;
    const paymentMethodLabel = paymentMethods.find((method) => method.value === paymentMethodValue)?.label || 'غير محدد';
    const guestsSummary = booking.numberOfGuests
        ? `${booking.numberOfGuests.adults} بالغ • ${booking.numberOfGuests.children || 0} طفل`
        : 'غير محدد';
    const formattedAddress = hotelProfile?.address
        ? [hotelProfile.address.street, hotelProfile.address.city, hotelProfile.address.country, hotelProfile.address.postalCode]
            .filter(Boolean)
            .join('، ')
        : '';

    const canConfirm = booking.status === 'pending';
    const canCheckIn = booking.status === 'confirmed';
    const canCheckOut = booking.status === 'checked_in';
    const canCancel = ['pending', 'confirmed'].includes(booking.status);
    const canNoShow = booking.status === 'confirmed';
    const canConfirmPayment = remaining === 0 && booking.payment?.status !== 'paid';
    const canPrintReceipt = booking.payment?.status === 'paid' || remaining === 0;

    return (
        <>
            <div className="space-y-6 no-print">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-white/10"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">
                        تفاصيل الحجز
                    </h1>
                    <p className="mt-1 text-white/60">
                        رقم الحجز: {booking.bookingNumber}
                    </p>
                </div>
                <span className={status.color}>
                    <StatusIcon className="w-3 h-3 ml-1 inline" />
                    {status.label}
                </span>
            </div>

            {actionError && (
                <div className="p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-600 text-sm">
                    {actionError}
                </div>
            )}

            {actionSuccess && (
                <div className="p-4 bg-success-500/10 border border-success-500/20 rounded-xl text-success-500 text-sm">
                    {actionSuccess}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="card p-6 space-y-6">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary-500/15 rounded-xl">
                                    <CalendarCheck className="w-6 h-6 text-primary-300" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        {booking.bookingNumber}
                                    </h2>
                                    <p className="text-sm text-white/50">
                                        من {formatDate(booking.checkInDate)} إلى {formatDate(booking.checkOutDate)}
                                    </p>
                                </div>
                            </div>
                            <span className={status.color}>
                                <StatusIcon className="w-3 h-3 ml-1 inline" />
                                {status.label}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <BedDouble className="w-4 h-4 text-white/40" />
                                <span className="text-white/50">الغرفة</span>
                                <Link
                                    href={`/dashboard/rooms/${booking.roomId?._id}`}
                                    className="font-medium text-primary-300 mr-auto"
                                >
                                    {booking.roomId?.roomNumber}
                                </Link>
                            </div>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-white/40" />
                                <span className="text-white/50">النزيل</span>
                                <Link
                                    href={`/dashboard/guests/${booking.guestId?._id}`}
                                    className="font-medium text-primary-300 mr-auto"
                                >
                                    {booking.guestId?.firstName} {booking.guestId?.lastName}
                                </Link>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-white/40" />
                                <span className="text-white/50">الإجمالي</span>
                                <span className="font-medium text-success-500 mr-auto">
                                    {formatCurrency(total)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-white/40" />
                                <span className="text-white/50">الدفع</span>
                                <span className={`mr-auto font-medium ${paymentStatus.color}`}>
                                    {paymentStatus.label}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">عدد الليالي</p>
                                <p className="font-semibold text-white">
                                    {nights} ليلة
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">المبلغ المدفوع</p>
                                <p className="font-semibold text-primary-300">
                                    {formatCurrency(paid)}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">المتبقي</p>
                                <p className="font-semibold text-warning-500">
                                    {formatCurrency(remaining)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-primary-300" />
                            إدارة المدفوعات
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">المجموع الفرعي</p>
                                <p className="font-semibold text-white">
                                    {formatCurrency(booking.pricing?.subtotal || 0)}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">الضرائب</p>
                                <p className="font-semibold text-white">
                                    {formatCurrency(booking.pricing?.taxes || 0)}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">الإجمالي</p>
                                <p className="font-semibold text-success-500">
                                    {formatCurrency(total)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">مبلغ الدفعة</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="input"
                                    min="0"
                                    disabled={remaining === 0}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">طريقة الدفع</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                                    className="input"
                                    disabled={remaining === 0}
                                >
                                    {paymentMethods.map((method) => (
                                        <option key={method.value} value={method.value}>{method.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">مرجع الدفع</label>
                                <input
                                    type="text"
                                    value={paymentReference}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                    className="input"
                                    placeholder="اختياري"
                                    disabled={remaining === 0}
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleAddPayment}
                                className="btn-primary"
                                disabled={updating || remaining === 0}
                            >
                                {updating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        تسجيل دفعة
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPayment}
                                className="btn-success"
                                disabled={!canConfirmPayment || updating}
                            >
                                {updating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle className="w-5 h-5" />
                                        تأكيد الدفع
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={handlePrintReceipt}
                                className="btn-secondary"
                                disabled={!canPrintReceipt}
                            >
                                <Printer className="w-5 h-5" />
                                طباعة وصل قبض
                            </button>
                        </div>
                    </div>

                    <div className="card p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary-300" />
                            الملاحظات والطلبات
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">الطلبات الخاصة</label>
                            <textarea
                                value={requestsDraft}
                                onChange={(e) => setRequestsDraft(e.target.value)}
                                className="input min-h-[90px]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">ملاحظات داخلية</label>
                            <textarea
                                value={notesDraft}
                                onChange={(e) => setNotesDraft(e.target.value)}
                                className="input min-h-[90px]"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleSaveNotes}
                                className="btn-secondary"
                                disabled={updating}
                            >
                                {updating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        حفظ الملاحظات
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">الإجراءات السريعة</h3>
                        <div className="space-y-3">
                            <button
                                type="button"
                                className="btn-primary w-full"
                                onClick={() => handleStatusChange('confirmed', 'تم تأكيد الحجز')}
                                disabled={!canConfirm || updating}
                            >
                                <CheckCircle className="w-4 h-4" />
                                تأكيد الحجز
                            </button>
                            <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={() => handleStatusChange('checked_in', 'تم تسجيل الوصول')}
                                disabled={!canCheckIn || updating}
                            >
                                <LogIn className="w-4 h-4" />
                                تسجيل الوصول
                            </button>
                            <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={() => handleStatusChange('checked_out', 'تم تسجيل المغادرة')}
                                disabled={!canCheckOut || updating}
                            >
                                <LogOut className="w-4 h-4" />
                                تسجيل المغادرة
                            </button>
                            <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={() => handleStatusChange('no_show', 'تم تسجيل حالة لم يحضر')}
                                disabled={!canNoShow || updating}
                            >
                                <AlertCircle className="w-4 h-4" />
                                لم يحضر
                            </button>
                        </div>
                    </div>

                    <div className="card p-5 space-y-3">
                        <h3 className="text-sm font-medium text-white/70">إلغاء الحجز</h3>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="input min-h-[80px]"
                            placeholder="سبب الإلغاء (اختياري)"
                            disabled={!canCancel}
                        />
                        <button
                            type="button"
                            className="btn-danger w-full"
                            onClick={handleCancel}
                            disabled={!canCancel || updating}
                        >
                            <Ban className="w-4 h-4" />
                            إلغاء الحجز
                        </button>
                    </div>

                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">البيانات الزمنية</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2 text-white/60">
                                <Clock className="w-4 h-4" />
                                <span>تاريخ الوصول:</span>
                                <span className="font-medium text-white mr-auto">{formatDateTime(booking.checkInDate)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-white/60">
                                <Clock className="w-4 h-4" />
                                <span>تاريخ المغادرة:</span>
                                <span className="font-medium text-white mr-auto">{formatDateTime(booking.checkOutDate)}</span>
                            </div>
                        </div>
                    </div>

                    <Link href="/dashboard/bookings" className="btn-secondary w-full">
                        العودة لقائمة الحجوزات
                    </Link>
                </div>
            </div>
            </div>

            <div className="print-only print-area" dir={hotelSettings?.language === 'en' ? 'ltr' : 'rtl'}>
                <div className="receipt-print">
                    <div className="receipt-header">
                        <div className="receipt-brand">
                            {hotelProfile?.logo && (
                                <img
                                    src={hotelProfile.logo}
                                    alt="شعار الفندق"
                                    className="receipt-logo"
                                />
                            )}
                            <div>
                                <h1 className="receipt-title">سند قبض</h1>
                                <p className="receipt-subtitle">رقم الوصل: {booking.bookingNumber}</p>
                                <p className="receipt-muted">{hotelProfile?.name || 'HMS Console'}</p>
                                {formattedAddress && <p className="receipt-muted">{formattedAddress}</p>}
                            </div>
                        </div>
                        <div className="receipt-meta">
                            <div className="receipt-meta-row">
                                <span>تاريخ الإصدار</span>
                                <span>{formatDateTime(printDate || new Date().toISOString())}</span>
                            </div>
                            <div className="receipt-meta-row">
                                <span>حالة الدفع</span>
                                <span className="receipt-pill">{paymentStatus.label}</span>
                            </div>
                            <div className="receipt-meta-row">
                                <span>طريقة الدفع</span>
                                <span>{paymentMethodLabel}</span>
                            </div>
                            {hotelProfile?.phone && (
                                <div className="receipt-meta-row">
                                    <span>هاتف</span>
                                    <span>{hotelProfile.phone}</span>
                                </div>
                            )}
                            {hotelProfile?.email && (
                                <div className="receipt-meta-row">
                                    <span>البريد</span>
                                    <span>{hotelProfile.email}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="receipt-section">
                        <h2 className="receipt-section-title">تفاصيل الحجز</h2>
                        <div className="receipt-info-grid">
                            <div>
                                <p className="receipt-label">النزيل</p>
                                <p className="receipt-value">{booking.guestId?.firstName} {booking.guestId?.lastName}</p>
                                <p className="receipt-muted">{booking.guestId?.phone}</p>
                            </div>
                            <div>
                                <p className="receipt-label">الغرفة</p>
                                <p className="receipt-value">غرفة {booking.roomId?.roomNumber}</p>
                                <p className="receipt-muted">{booking.roomId?.type} - الطابق {booking.roomId?.floor}</p>
                            </div>
                            <div>
                                <p className="receipt-label">فترة الإقامة</p>
                                <p className="receipt-value">{formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}</p>
                                <p className="receipt-muted">عدد الليالي: {nights}</p>
                            </div>
                            <div>
                                <p className="receipt-label">عدد النزلاء</p>
                                <p className="receipt-value">{guestsSummary}</p>
                                <p className="receipt-muted">
                                    مصدر الحجز: {(booking.source ? bookingSourceLabels[booking.source] : undefined) || 'غير محدد'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="receipt-section">
                        <h2 className="receipt-section-title">تفاصيل المبالغ</h2>
                        <table className="receipt-table">
                            <thead>
                                <tr>
                                    <th>الوصف</th>
                                    <th>التفاصيل</th>
                                    <th>المبلغ</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>الإقامة</td>
                                    <td>
                                        {formatCurrency(booking.pricing?.roomRate || 0)} × {booking.pricing?.numberOfNights || nights} ليلة
                                    </td>
                                    <td>{formatCurrency(booking.pricing?.subtotal || 0)}</td>
                                </tr>
                                {booking.pricing?.discount ? (
                                    <tr>
                                        <td>خصم</td>
                                        <td>—</td>
                                        <td>- {formatCurrency(booking.pricing.discount)}</td>
                                    </tr>
                                ) : null}
                                <tr>
                                    <td>الضريبة</td>
                                    <td>{hotelSettings?.taxRate ?? 15}%</td>
                                    <td>{formatCurrency(booking.pricing?.taxes || 0)}</td>
                                </tr>
                                <tr className="receipt-total-row">
                                    <td>الإجمالي</td>
                                    <td />
                                    <td>{formatCurrency(total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="receipt-section">
                        <h2 className="receipt-section-title">سجل الدفعات</h2>
                        {transactions.length ? (
                            <table className="receipt-table">
                                <thead>
                                    <tr>
                                        <th>التاريخ</th>
                                        <th>الطريقة</th>
                                        <th>المرجع</th>
                                        <th>المبلغ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx, index) => (
                                        <tr key={`${tx.date}-${index}`}>
                                            <td>{formatDateTime(tx.date)}</td>
                                            <td>{paymentMethods.find((method) => method.value === tx.method)?.label || tx.method}</td>
                                            <td>{tx.reference || '—'}</td>
                                            <td>{formatCurrency(tx.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="receipt-muted">لا توجد دفعات مسجلة حتى الآن.</p>
                        )}
                    </div>

                    <div className="receipt-totals">
                        <div>
                            <p className="receipt-label">الإجمالي</p>
                            <p className="receipt-value">{formatCurrency(total)}</p>
                        </div>
                        <div>
                            <p className="receipt-label">المدفوع</p>
                            <p className="receipt-value">{formatCurrency(paid)}</p>
                        </div>
                        <div>
                            <p className="receipt-label">المتبقي</p>
                            <p className="receipt-value">{formatCurrency(remaining)}</p>
                        </div>
                    </div>

                    <div className="receipt-footer">
                        <div>
                            <p className="receipt-label">آخر دفعة</p>
                            <p className="receipt-value">{latestTransaction ? formatDateTime(latestTransaction.date) : '—'}</p>
                        </div>
                        <div>
                            <p className="receipt-label">مرجع الدفعة</p>
                            <p className="receipt-value">{latestTransaction?.reference || '—'}</p>
                        </div>
                    </div>

                    <div className="receipt-signatures">
                        <div>
                            <p>توقيع المستلم</p>
                            <span />
                        </div>
                        <div>
                            <p>توقيع الموظف</p>
                            <span />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
