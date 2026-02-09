'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';
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

const statusConfig: Record<string, { label: { ar: string; en: string }; color: string; icon: any }> = {
    pending: { label: { ar: 'قيد الانتظار', en: 'Pending' }, color: 'badge-warning', icon: Clock },
    confirmed: { label: { ar: 'مؤكد', en: 'Confirmed' }, color: 'badge-primary', icon: CheckCircle },
    checked_in: { label: { ar: 'مسجل الوصول', en: 'Checked in' }, color: 'badge-success', icon: LogIn },
    checked_out: { label: { ar: 'غادر', en: 'Checked out' }, color: 'badge bg-white/10 text-white/60', icon: LogOut },
    cancelled: { label: { ar: 'ملغي', en: 'Cancelled' }, color: 'badge-danger', icon: XCircle },
    no_show: { label: { ar: 'لم يحضر', en: 'No show' }, color: 'badge-danger', icon: AlertCircle },
};

const paymentStatusLabels: Record<string, { label: { ar: string; en: string }; color: string }> = {
    pending: { label: { ar: 'غير مدفوع', en: 'Unpaid' }, color: 'text-warning-500' },
    partial: { label: { ar: 'دفع جزئي', en: 'Partial' }, color: 'text-primary-300' },
    paid: { label: { ar: 'مدفوع', en: 'Paid' }, color: 'text-success-500' },
    refunded: { label: { ar: 'مسترد', en: 'Refunded' }, color: 'text-white/60' },
};

const paymentMethods = [
    { value: 'cash', label: { ar: 'نقدي', en: 'Cash' } },
    { value: 'card', label: { ar: 'بطاقة', en: 'Card' } },
    { value: 'bank_transfer', label: { ar: 'تحويل بنكي', en: 'Bank transfer' } },
    { value: 'online', label: { ar: 'دفع إلكتروني', en: 'Online' } },
] as const;

const bookingSourceLabels: Record<string, { ar: string; en: string }> = {
    direct: { ar: 'مباشر', en: 'Direct' },
    website: { ar: 'الموقع', en: 'Website' },
    phone: { ar: 'هاتف', en: 'Phone' },
    walkin: { ar: 'حجز مباشر', en: 'Walk-in' },
    ota: { ar: 'وكالات', en: 'OTA' },
};

export default function BookingDetailsPage() {
    const { settings: hotelSettings, hotelProfile } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
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

    useEffect(() => {
        const fetchBooking = async () => {
            try {
                const response = await fetchWithRefresh(`/api/bookings/${id}`);
                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || t(lang, 'تعذر جلب بيانات الحجز', 'Failed to load booking details'));
                    return;
                }

                setBooking(data.data);
                setNotesDraft(data.data.notes || '');
                setRequestsDraft(data.data.specialRequests || '');
            } catch (err) {
                setError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
            } finally {
                setLoading(false);
            }
        };

        fetchBooking();
    }, [id, lang]);

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
                setActionError(result.error || t(lang, 'تعذر تحديث الحجز', 'Failed to update booking'));
                return;
            }

            setBooking(result.data);
            setActionSuccess(successMessage);
        } catch (err) {
            setActionError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
        } finally {
            setUpdating(false);
        }
    };

    const handleStatusChange = async (status: string, message: string) => {
        await updateBooking({ status }, message);
    };

    const handleCancel = async () => {
        const confirmed = window.confirm(t(lang, 'هل تريد إلغاء هذا الحجز؟', 'Cancel this booking?'));
        if (!confirmed) return;

        await updateBooking(
            { status: 'cancelled', cancellationReason: cancelReason || undefined },
            t(lang, 'تم إلغاء الحجز بنجاح', 'Booking cancelled successfully')
        );
    };

    const handleAddPayment = async () => {
        if (!booking) return;
        const amount = Number(paymentAmount);
        const total = booking.pricing?.total || 0;
        const paid = booking.payment?.paidAmount || 0;
        const remaining = Math.max(total - paid, 0);

        if (!Number.isFinite(amount) || amount <= 0) {
            setActionError(t(lang, 'أدخل مبلغاً صحيحاً', 'Enter a valid amount'));
            return;
        }
        if (amount > remaining) {
            setActionError(t(lang, 'المبلغ أكبر من المتبقي', 'Amount exceeds the remaining balance'));
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
            t(lang, 'تم تسجيل الدفعة بنجاح', 'Payment recorded successfully')
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
            setActionError(t(
                lang,
                'لا يمكن تأكيد الدفع قبل تسوية المبلغ المتبقي',
                'Cannot confirm payment until the remaining balance is settled'
            ));
            return;
        }

        await updateBooking(
            { payment: { status: 'paid', paidAmount: total } },
            t(lang, 'تم تأكيد الدفع بنجاح', 'Payment confirmed successfully')
        );
    };

    const handlePrintReceipt = () => {
        setPrintDate(new Date().toISOString());
        setTimeout(() => window.print(), 50);
    };

    const handleSaveNotes = async () => {
        await updateBooking(
            { notes: notesDraft, specialRequests: requestsDraft },
            t(lang, 'تم تحديث الملاحظات بنجاح', 'Notes updated successfully')
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
                <p className="text-danger-600">{error || t(lang, 'الحجز غير موجود', 'Booking not found')}</p>
                <button onClick={() => router.back()} className="btn-secondary mt-4">
                    {t(lang, 'العودة', 'Back')}
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
    const paymentMethodLabel = paymentMethods.find((method) => method.value === paymentMethodValue)?.label?.[lang]
        || t(lang, 'غير محدد', 'Unknown');
    const guestsSummary = booking.numberOfGuests
        ? t(
            lang,
            `${booking.numberOfGuests.adults} بالغ • ${booking.numberOfGuests.children || 0} طفل`,
            `${booking.numberOfGuests.adults} adults • ${booking.numberOfGuests.children || 0} children`
        )
        : t(lang, 'غير محدد', 'Unknown');
    const formattedAddress = hotelProfile?.address
        ? [hotelProfile.address.street, hotelProfile.address.city, hotelProfile.address.country, hotelProfile.address.postalCode]
            .filter(Boolean)
            .join(lang === 'en' ? ', ' : '، ')
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
                        {t(lang, 'تفاصيل الحجز', 'Booking Details')}
                    </h1>
                    <p className="mt-1 text-white/60">
                        {t(lang, 'رقم الحجز', 'Booking #')}: {booking.bookingNumber}
                    </p>
                </div>
                <span className={status.color}>
                    <StatusIcon className="w-3 h-3 ml-1 inline" />
                    {status.label[lang]}
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
                                        {t(lang, 'من', 'From')} {formatDate(booking.checkInDate)} {t(lang, 'إلى', 'to')} {formatDate(booking.checkOutDate)}
                                    </p>
                                </div>
                            </div>
                            <span className={status.color}>
                                <StatusIcon className="w-3 h-3 ml-1 inline" />
                                {status.label[lang]}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <BedDouble className="w-4 h-4 text-white/40" />
                                <span className="text-white/50">{t(lang, 'الغرفة', 'Room')}</span>
                                <Link
                                    href={`/dashboard/rooms/${booking.roomId?._id}`}
                                    className="font-medium text-primary-300 mr-auto"
                                >
                                    {booking.roomId?.roomNumber}
                                </Link>
                            </div>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-white/40" />
                                <span className="text-white/50">{t(lang, 'النزيل', 'Guest')}</span>
                                <Link
                                    href={`/dashboard/guests/${booking.guestId?._id}`}
                                    className="font-medium text-primary-300 mr-auto"
                                >
                                    {booking.guestId?.firstName} {booking.guestId?.lastName}
                                </Link>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-white/40" />
                                <span className="text-white/50">{t(lang, 'الإجمالي', 'Total')}</span>
                                <span className="font-medium text-success-500 mr-auto">
                                    {formatCurrency(total)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-white/40" />
                                <span className="text-white/50">{t(lang, 'الدفع', 'Payment')}</span>
                                <span className={`mr-auto font-medium ${paymentStatus.color}`}>
                                    {paymentStatus.label[lang]}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">{t(lang, 'عدد الليالي', 'Nights')}</p>
                                <p className="font-semibold text-white">
                                    {t(lang, `${nights} ليلة`, `${nights} nights`)}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">{t(lang, 'المبلغ المدفوع', 'Paid')}</p>
                                <p className="font-semibold text-primary-300">
                                    {formatCurrency(paid)}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">{t(lang, 'المتبقي', 'Remaining')}</p>
                                <p className="font-semibold text-warning-500">
                                    {formatCurrency(remaining)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <CreditCard className="w-5 h-5 text-primary-300" />
                            {t(lang, 'إدارة المدفوعات', 'Payments')}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">{t(lang, 'المجموع الفرعي', 'Subtotal')}</p>
                                <p className="font-semibold text-white">
                                    {formatCurrency(booking.pricing?.subtotal || 0)}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">{t(lang, 'الضرائب', 'Taxes')}</p>
                                <p className="font-semibold text-white">
                                    {formatCurrency(booking.pricing?.taxes || 0)}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">{t(lang, 'الإجمالي', 'Total')}</p>
                                <p className="font-semibold text-success-500">
                                    {formatCurrency(total)}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    {t(lang, 'مبلغ الدفعة', 'Payment amount')}
                                </label>
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
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    {t(lang, 'طريقة الدفع', 'Payment method')}
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
                                    className="input"
                                    disabled={remaining === 0}
                                >
                                    {paymentMethods.map((method) => (
                                        <option key={method.value} value={method.value}>{method.label[lang]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    {t(lang, 'مرجع الدفع', 'Payment reference')}
                                </label>
                                <input
                                    type="text"
                                    value={paymentReference}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                    className="input"
                                    placeholder={t(lang, 'اختياري', 'Optional')}
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
                                        {t(lang, 'تسجيل دفعة', 'Record payment')}
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
                                        {t(lang, 'تأكيد الدفع', 'Confirm payment')}
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
                                {t(lang, 'طباعة وصل قبض', 'Print receipt')}
                            </button>
                        </div>
                    </div>

                    <div className="card p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary-300" />
                            {t(lang, 'الملاحظات والطلبات', 'Notes & Requests')}
                        </h3>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'الطلبات الخاصة', 'Special requests')}</label>
                            <textarea
                                value={requestsDraft}
                                onChange={(e) => setRequestsDraft(e.target.value)}
                                className="input min-h-[90px]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'ملاحظات داخلية', 'Internal notes')}</label>
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
                                        {t(lang, 'حفظ الملاحظات', 'Save notes')}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">{t(lang, 'الإجراءات السريعة', 'Quick actions')}</h3>
                        <div className="space-y-3">
                            <button
                                type="button"
                                className="btn-primary w-full"
                                onClick={() => handleStatusChange('confirmed', t(lang, 'تم تأكيد الحجز', 'Booking confirmed'))}
                                disabled={!canConfirm || updating}
                            >
                                <CheckCircle className="w-4 h-4" />
                                {t(lang, 'تأكيد الحجز', 'Confirm booking')}
                            </button>
                            <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={() => handleStatusChange('checked_in', t(lang, 'تم تسجيل الوصول', 'Checked in'))}
                                disabled={!canCheckIn || updating}
                            >
                                <LogIn className="w-4 h-4" />
                                {t(lang, 'تسجيل الوصول', 'Check-in')}
                            </button>
                            <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={() => handleStatusChange('checked_out', t(lang, 'تم تسجيل المغادرة', 'Checked out'))}
                                disabled={!canCheckOut || updating}
                            >
                                <LogOut className="w-4 h-4" />
                                {t(lang, 'تسجيل المغادرة', 'Check-out')}
                            </button>
                            <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={() => handleStatusChange('no_show', t(lang, 'تم تسجيل حالة لم يحضر', 'Marked as no-show'))}
                                disabled={!canNoShow || updating}
                            >
                                <AlertCircle className="w-4 h-4" />
                                {t(lang, 'لم يحضر', 'No show')}
                            </button>
                        </div>
                    </div>

                    <div className="card p-5 space-y-3">
                        <h3 className="text-sm font-medium text-white/70">{t(lang, 'إلغاء الحجز', 'Cancel booking')}</h3>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="input min-h-[80px]"
                            placeholder={t(lang, 'سبب الإلغاء (اختياري)', 'Cancellation reason (optional)')}
                            disabled={!canCancel}
                        />
                        <button
                            type="button"
                            className="btn-danger w-full"
                            onClick={handleCancel}
                            disabled={!canCancel || updating}
                        >
                            <Ban className="w-4 h-4" />
                            {t(lang, 'إلغاء الحجز', 'Cancel booking')}
                        </button>
                    </div>

                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">{t(lang, 'البيانات الزمنية', 'Dates')}</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2 text-white/60">
                                <Clock className="w-4 h-4" />
                                <span>{t(lang, 'تاريخ الوصول', 'Check-in date')}:</span>
                                <span className="font-medium text-white mr-auto">{formatDateTime(booking.checkInDate)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-white/60">
                                <Clock className="w-4 h-4" />
                                <span>{t(lang, 'تاريخ المغادرة', 'Check-out date')}:</span>
                                <span className="font-medium text-white mr-auto">{formatDateTime(booking.checkOutDate)}</span>
                            </div>
                        </div>
                    </div>

                    <Link href="/dashboard/bookings" className="btn-secondary w-full">
                        {t(lang, 'العودة لقائمة الحجوزات', 'Back to bookings')}
                    </Link>
                </div>
            </div>
            </div>

            <div className="print-only print-area" dir={hotelSettings?.language === 'en' ? 'ltr' : 'rtl'}>
                <div className="receipt-print">
                    <div className="receipt-header">
                        <div className="receipt-brand">
                            {hotelProfile?.logo && (
                                <Image
                                    src={hotelProfile.logo}
                                    alt="Hotel logo"
                                    width={72}
                                    height={72}
                                    unoptimized
                                    className="receipt-logo"
                                />
                            )}
                            <div>
                                <h1 className="receipt-title">{t(lang, 'سند قبض', 'Receipt')}</h1>
                                <p className="receipt-subtitle">{t(lang, 'رقم الوصل', 'Receipt #')}: {booking.bookingNumber}</p>
                                <p className="receipt-muted">{hotelProfile?.name || 'HMS Console'}</p>
                                {formattedAddress && <p className="receipt-muted">{formattedAddress}</p>}
                            </div>
                        </div>
                        <div className="receipt-meta">
                            <div className="receipt-meta-row">
                                <span>{t(lang, 'تاريخ الإصدار', 'Issued on')}</span>
                                <span>{formatDateTime(printDate || new Date().toISOString())}</span>
                            </div>
                            <div className="receipt-meta-row">
                                <span>{t(lang, 'حالة الدفع', 'Payment status')}</span>
                                <span className="receipt-pill">{paymentStatus.label[lang]}</span>
                            </div>
                            <div className="receipt-meta-row">
                                <span>{t(lang, 'طريقة الدفع', 'Payment method')}</span>
                                <span>{paymentMethodLabel}</span>
                            </div>
                            {hotelProfile?.phone && (
                                <div className="receipt-meta-row">
                                    <span>{t(lang, 'هاتف', 'Phone')}</span>
                                    <span>{hotelProfile.phone}</span>
                                </div>
                            )}
                            {hotelProfile?.email && (
                                <div className="receipt-meta-row">
                                    <span>{t(lang, 'البريد', 'Email')}</span>
                                    <span>{hotelProfile.email}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="receipt-section">
                        <h2 className="receipt-section-title">{t(lang, 'تفاصيل الحجز', 'Booking details')}</h2>
                        <div className="receipt-info-grid">
                            <div>
                                <p className="receipt-label">{t(lang, 'النزيل', 'Guest')}</p>
                                <p className="receipt-value">{booking.guestId?.firstName} {booking.guestId?.lastName}</p>
                                <p className="receipt-muted">{booking.guestId?.phone}</p>
                            </div>
                            <div>
                                <p className="receipt-label">{t(lang, 'الغرفة', 'Room')}</p>
                                <p className="receipt-value">{t(lang, 'غرفة', 'Room')} {booking.roomId?.roomNumber}</p>
                                <p className="receipt-muted">{booking.roomId?.type} - {t(lang, 'الطابق', 'Floor')} {booking.roomId?.floor}</p>
                            </div>
                            <div>
                                <p className="receipt-label">{t(lang, 'فترة الإقامة', 'Stay period')}</p>
                                <p className="receipt-value">{formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}</p>
                                <p className="receipt-muted">{t(lang, 'عدد الليالي', 'Nights')}: {nights}</p>
                            </div>
                            <div>
                                <p className="receipt-label">{t(lang, 'عدد النزلاء', 'Guests')}</p>
                                <p className="receipt-value">{guestsSummary}</p>
                                <p className="receipt-muted">
                                    {t(lang, 'مصدر الحجز', 'Source')}: {(booking.source ? bookingSourceLabels[booking.source]?.[lang] : undefined) || t(lang, 'غير محدد', 'Unknown')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="receipt-section">
                        <h2 className="receipt-section-title">{t(lang, 'تفاصيل المبالغ', 'Charges')}</h2>
                        <table className="receipt-table">
                            <thead>
                                <tr>
                                    <th>{t(lang, 'الوصف', 'Description')}</th>
                                    <th>{t(lang, 'التفاصيل', 'Details')}</th>
                                    <th>{t(lang, 'المبلغ', 'Amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>{t(lang, 'الإقامة', 'Stay')}</td>
                                    <td>
                                        {formatCurrency(booking.pricing?.roomRate || 0)} × {booking.pricing?.numberOfNights || nights} {t(lang, 'ليلة', 'nights')}
                                    </td>
                                    <td>{formatCurrency(booking.pricing?.subtotal || 0)}</td>
                                </tr>
                                {booking.pricing?.discount ? (
                                    <tr>
                                        <td>{t(lang, 'خصم', 'Discount')}</td>
                                        <td>—</td>
                                        <td>- {formatCurrency(booking.pricing.discount)}</td>
                                    </tr>
                                ) : null}
                                <tr>
                                    <td>{t(lang, 'الضريبة', 'Tax')}</td>
                                    <td>{hotelSettings?.taxRate ?? 15}%</td>
                                    <td>{formatCurrency(booking.pricing?.taxes || 0)}</td>
                                </tr>
                                <tr className="receipt-total-row">
                                    <td>{t(lang, 'الإجمالي', 'Total')}</td>
                                    <td />
                                    <td>{formatCurrency(total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="receipt-section">
                        <h2 className="receipt-section-title">{t(lang, 'سجل الدفعات', 'Payment history')}</h2>
                        {transactions.length ? (
                            <table className="receipt-table">
                                <thead>
                                    <tr>
                                        <th>{t(lang, 'التاريخ', 'Date')}</th>
                                        <th>{t(lang, 'الطريقة', 'Method')}</th>
                                        <th>{t(lang, 'المرجع', 'Reference')}</th>
                                        <th>{t(lang, 'المبلغ', 'Amount')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((tx, index) => (
                                        <tr key={`${tx.date}-${index}`}>
                                            <td>{formatDateTime(tx.date)}</td>
                                            <td>{paymentMethods.find((method) => method.value === tx.method)?.label?.[lang] || tx.method}</td>
                                            <td>{tx.reference || '—'}</td>
                                            <td>{formatCurrency(tx.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p className="receipt-muted">{t(lang, 'لا توجد دفعات مسجلة حتى الآن.', 'No payments recorded yet.')}</p>
                        )}
                    </div>

                    <div className="receipt-totals">
                        <div>
                            <p className="receipt-label">{t(lang, 'الإجمالي', 'Total')}</p>
                            <p className="receipt-value">{formatCurrency(total)}</p>
                        </div>
                        <div>
                            <p className="receipt-label">{t(lang, 'المدفوع', 'Paid')}</p>
                            <p className="receipt-value">{formatCurrency(paid)}</p>
                        </div>
                        <div>
                            <p className="receipt-label">{t(lang, 'المتبقي', 'Remaining')}</p>
                            <p className="receipt-value">{formatCurrency(remaining)}</p>
                        </div>
                    </div>

                    <div className="receipt-footer">
                        <div>
                            <p className="receipt-label">{t(lang, 'آخر دفعة', 'Latest payment')}</p>
                            <p className="receipt-value">{latestTransaction ? formatDateTime(latestTransaction.date) : '—'}</p>
                        </div>
                        <div>
                            <p className="receipt-label">{t(lang, 'مرجع الدفعة', 'Payment reference')}</p>
                            <p className="receipt-value">{latestTransaction?.reference || '—'}</p>
                        </div>
                    </div>

                    <div className="receipt-signatures">
                        <div>
                            <p>{t(lang, 'توقيع المستلم', 'Recipient signature')}</p>
                            <span />
                        </div>
                        <div>
                            <p>{t(lang, 'توقيع الموظف', 'Staff signature')}</p>
                            <span />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
