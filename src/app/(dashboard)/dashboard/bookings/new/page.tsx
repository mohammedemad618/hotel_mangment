'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowRight,
    Save,
    Loader2,
    CalendarCheck,
    BedDouble,
    DollarSign,
    Users,
    Search,
    Check,
} from 'lucide-react';
import { createBookingSchema, CreateBookingInput } from '@/lib/validations';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';

interface RoomOption {
    _id: string;
    roomNumber: string;
    type: string;
    pricePerNight: number;
    status: string;
}

interface GuestOption {
    _id: string;
    firstName: string;
    lastName: string;
    phone: string;
}

const roomTypeLabels: Record<string, { ar: string; en: string }> = {
    single: { ar: 'مفردة', en: 'Single' },
    double: { ar: 'مزدوجة', en: 'Double' },
    twin: { ar: 'توأم', en: 'Twin' },
    suite: { ar: 'جناح', en: 'Suite' },
    deluxe: { ar: 'فاخرة', en: 'Deluxe' },
    presidential: { ar: 'رئاسية', en: 'Presidential' },
};

export default function NewBookingPage() {
    const { settings: hotelSettings, setNotifications } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [rooms, setRooms] = useState<RoomOption[]>([]);
    const [guests, setGuests] = useState<GuestOption[]>([]);
    const [loadingOptions, setLoadingOptions] = useState(true);
    const [roomQuery, setRoomQuery] = useState('');
    const [guestQuery, setGuestQuery] = useState('');
    const [roomOpen, setRoomOpen] = useState(false);
    const [guestOpen, setGuestOpen] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<CreateBookingInput>({
        resolver: zodResolver(createBookingSchema),
        defaultValues: {
            numberOfGuests: { adults: 2, children: 0 },
            source: 'direct',
        },
    });

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                const [roomsRes, guestsRes] = await Promise.all([
                    fetchWithRefresh('/api/rooms?status=available&limit=200'),
                    fetchWithRefresh('/api/guests?limit=200'),
                ]);

                const roomsData = await roomsRes.json();
                const guestsData = await guestsRes.json();

                if (roomsData.success) {
                    setRooms(roomsData.data);
                }
                if (guestsData.success) {
                    setGuests(guestsData.data);
                }
            } catch (err) {
                setError(t(lang, 'تعذر تحميل بيانات الغرف أو النزلاء', 'Failed to load rooms or guests'));
            } finally {
                setLoadingOptions(false);
            }
        };

        fetchOptions();
    }, []);

    const selectedRoomId = watch('roomId');
    const selectedGuestId = watch('guestId');
    const checkInDateValue = watch('checkInDate');
    const checkOutDateValue = watch('checkOutDate');

    const selectedRoom = useMemo(
        () => rooms.find((room) => room._id === selectedRoomId),
        [rooms, selectedRoomId]
    );

    const formatCurrency = (amount: number) => {
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const currency = hotelSettings?.currency || 'SAR';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const taxRate = typeof hotelSettings?.taxRate === 'number' ? hotelSettings.taxRate : 15;

    const pricingSummary = useMemo(() => {
        if (!selectedRoom || !checkInDateValue || !checkOutDateValue) {
            return { nights: 0, subtotal: 0, taxes: 0, total: 0, valid: false };
        }

        const start = new Date(checkInDateValue).getTime();
        const end = new Date(checkOutDateValue).getTime();
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
            return { nights: 0, subtotal: 0, taxes: 0, total: 0, valid: false };
        }

        const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const subtotal = selectedRoom.pricePerNight * nights;
        const taxes = subtotal * (taxRate / 100);
        const total = subtotal + taxes;
        return { nights, subtotal, taxes, total, valid: true };
    }, [selectedRoom, checkInDateValue, checkOutDateValue, taxRate]);

    const filteredRooms = rooms.filter((room) =>
        room.roomNumber.toLowerCase().includes(roomQuery.trim().toLowerCase())
    );

    const filteredGuests = guests.filter((guest) => {
        const query = guestQuery.trim().toLowerCase();
        if (!query) return true;
        const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
        return (
            fullName.includes(query) ||
            guest.phone.toLowerCase().includes(query)
        );
    });

    const handleSelectRoom = (room: RoomOption) => {
        const typeLabel = roomTypeLabels[room.type]?.[lang] || room.type;
        setValue('roomId', room._id, { shouldValidate: true });
        setRoomQuery(`${room.roomNumber} - ${typeLabel}`);
        setRoomOpen(false);
    };

    const handleSelectGuest = (guest: GuestOption) => {
        setValue('guestId', guest._id, { shouldValidate: true });
        setGuestQuery(`${guest.firstName} ${guest.lastName} - ${guest.phone}`);
        setGuestOpen(false);
    };

    const onSubmit = async (data: CreateBookingInput) => {
        setError(null);

        try {
            const response = await fetchWithRefresh('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || t(lang, 'حدث خطأ أثناء إنشاء الحجز', 'Failed to create the booking'));
                return;
            }

            if (hotelSettings?.notifications?.newBooking) {
                const guestName = guests.find((guest) => guest._id === data.guestId);
                const roomInfo = rooms.find((room) => room._id === data.roomId);
                const roomNumber = roomInfo?.roomNumber || '';
                const fullName = guestName ? `${guestName.firstName} ${guestName.lastName}`.trim() : '';
                const message = t(
                    lang,
                    `تم إنشاء حجز جديد للغرفة ${roomNumber} باسم ${fullName}.`,
                    `New booking created for room ${roomNumber} under ${fullName}.`
                );
                setNotifications((prev) => [
                    {
                        type: 'booking_new' as const,
                        message,
                        createdAt: new Date().toISOString(),
                    },
                    ...prev,
                ].slice(0, 20));
            }

            router.push('/dashboard/bookings');
        } catch (err) {
            setError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-white/10"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {t(lang, 'إنشاء حجز جديد', 'Create New Booking')}
                    </h1>
                    <p className="mt-1 text-white/60">
                        {t(lang, 'اختر الغرفة والنزيل وحدد فترة الإقامة', 'Select a room and guest, then set the stay dates')}
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm animate-slide-down">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="card p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <CalendarCheck className="w-5 h-5 text-primary-300" />
                        {t(lang, 'تفاصيل الحجز', 'Booking Details')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'الغرفة *', 'Room *')}
                            </label>
                            <input type="hidden" {...register('roomId')} />
                            <div
                                className="relative"
                                onBlur={() => setTimeout(() => setRoomOpen(false), 120)}
                            >
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                <input
                                    type="text"
                                    value={roomQuery}
                                    onChange={(e) => {
                                        setRoomQuery(e.target.value);
                                        setRoomOpen(true);
                                        if (selectedRoomId) {
                                            setValue('roomId', '', { shouldValidate: true });
                                        }
                                    }}
                                    onFocus={() => setRoomOpen(true)}
                                    className="input pr-9 text-sm"
                                    placeholder={t(lang, 'ابحث برقم الغرفة...', 'Search by room number...')}
                                    disabled={loadingOptions}
                                />
                                {roomOpen && (
                                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-[rgba(12,8,24,0.96)] shadow-xl max-h-56 overflow-auto">
                                        {filteredRooms.length === 0 ? (
                                            <div className="px-4 py-3 text-xs text-white/50">
                                                {t(lang, 'لا توجد غرف مطابقة للبحث.', 'No matching rooms found.')}
                                            </div>
                                        ) : (
                                            filteredRooms.slice(0, 8).map((room) => (
                                                <button
                                                    type="button"
                                                    key={room._id}
                                                    onClick={() => handleSelectRoom(room)}
                                                    className="w-full text-right px-4 py-3 text-sm text-white/80 hover:bg-white/5 flex items-center justify-between"
                                                >
                                                    <span>
                                                        {room.roomNumber} - {roomTypeLabels[room.type]?.[lang] || room.type}
                                                    </span>
                                                    {selectedRoomId === room._id && (
                                                        <Check className="w-4 h-4 text-primary-300" />
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                            {errors.roomId && (
                                <p className="mt-1 text-sm text-danger-500">{errors.roomId.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'النزيل *', 'Guest *')}
                            </label>
                            <input type="hidden" {...register('guestId')} />
                            <div
                                className="relative"
                                onBlur={() => setTimeout(() => setGuestOpen(false), 120)}
                            >
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                                <input
                                    type="text"
                                    value={guestQuery}
                                    onChange={(e) => {
                                        setGuestQuery(e.target.value);
                                        setGuestOpen(true);
                                        if (selectedGuestId) {
                                            setValue('guestId', '', { shouldValidate: true });
                                        }
                                    }}
                                    onFocus={() => setGuestOpen(true)}
                                    className="input pr-9 text-sm"
                                    placeholder={t(lang, 'ابحث باسم النزيل أو الهاتف...', 'Search by guest name or phone...')}
                                    disabled={loadingOptions}
                                />
                                {guestOpen && (
                                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-[rgba(12,8,24,0.96)] shadow-xl max-h-56 overflow-auto">
                                        {filteredGuests.length === 0 ? (
                                            <div className="px-4 py-3 text-xs text-white/50">
                                                {t(lang, 'لا يوجد نزلاء مطابقون للبحث.', 'No matching guests found.')}
                                            </div>
                                        ) : (
                                            filteredGuests.slice(0, 8).map((guest) => (
                                                <button
                                                    type="button"
                                                    key={guest._id}
                                                    onClick={() => handleSelectGuest(guest)}
                                                    className="w-full text-right px-4 py-3 text-sm text-white/80 hover:bg-white/5 flex items-center justify-between"
                                                >
                                                    <span>
                                                        {guest.firstName} {guest.lastName} - {guest.phone}
                                                    </span>
                                                    {selectedGuestId === guest._id && (
                                                        <Check className="w-4 h-4 text-primary-300" />
                                                    )}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                            {errors.guestId && (
                                <p className="mt-1 text-sm text-danger-500">{errors.guestId.message}</p>
                            )}
                            <div className="mt-2">
                                <Link href="/dashboard/guests/new" className="text-xs text-primary-300 hover:text-primary-200">
                                    {t(lang, 'إضافة نزيل جديد', 'Add new guest')}
                                </Link>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'تاريخ الوصول *', 'Check-in date *')}
                            </label>
                            <input
                                type="date"
                                {...register('checkInDate')}
                                className="input"
                            />
                            {hotelSettings?.checkInTime && (
                                <p className="mt-1 text-xs text-white/40">
                                    {t(lang, 'وقت تسجيل الوصول:', 'Check-in time:')} {hotelSettings.checkInTime}
                                </p>
                            )}
                            {errors.checkInDate && (
                                <p className="mt-1 text-sm text-danger-500">{errors.checkInDate.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'تاريخ المغادرة *', 'Check-out date *')}
                            </label>
                            <input
                                type="date"
                                {...register('checkOutDate')}
                                className="input"
                            />
                            {hotelSettings?.checkOutTime && (
                                <p className="mt-1 text-xs text-white/40">
                                    {t(lang, 'وقت تسجيل المغادرة:', 'Check-out time:')} {hotelSettings.checkOutTime}
                                </p>
                            )}
                            {errors.checkOutDate && (
                                <p className="mt-1 text-sm text-danger-500">{errors.checkOutDate.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    {t(lang, 'البالغين *', 'Adults *')}
                                </label>
                                <div className="relative">
                                    <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                    <input
                                        type="number"
                                        {...register('numberOfGuests.adults', { valueAsNumber: true })}
                                        className="input pr-10"
                                        min="1"
                                    />
                                </div>
                                {errors.numberOfGuests?.adults && (
                                    <p className="mt-1 text-sm text-danger-500">
                                        {errors.numberOfGuests.adults.message}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    {t(lang, 'الأطفال', 'Children')}
                                </label>
                                <input
                                    type="number"
                                    {...register('numberOfGuests.children', { valueAsNumber: true })}
                                    className="input"
                                    min="0"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'مصدر الحجز', 'Booking source')}
                            </label>
                            <select {...register('source')} className="input">
                                <option value="direct">{t(lang, 'مباشر', 'Direct')}</option>
                                <option value="website">{t(lang, 'الموقع الإلكتروني', 'Website')}</option>
                                <option value="phone">{t(lang, 'الهاتف', 'Phone')}</option>
                                <option value="walkin">{t(lang, 'زيارة مباشرة', 'Walk-in')}</option>
                                <option value="ota">{t(lang, 'وكالات الحجز', 'OTA')}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="card p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-primary-300" />
                        {t(lang, 'ملخص التسعير', 'Pricing Summary')}
                    </h2>
                    {!selectedRoom ? (
                        <p className="text-sm text-white/60">
                            {t(lang, 'اختر غرفة لعرض ملخص التسعير.', 'Select a room to see pricing summary.')}
                        </p>
                    ) : pricingSummary.valid ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">{t(lang, 'سعر الليلة', 'Nightly rate')}</p>
                                <p className="font-semibold text-white">
                                    {formatCurrency(selectedRoom.pricePerNight)}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">{t(lang, 'عدد الليالي', 'Nights')}</p>
                                <p className="font-semibold text-white">
                                    {t(
                                        lang,
                                        `${pricingSummary.nights} ليلة`,
                                        `${pricingSummary.nights} night${pricingSummary.nights === 1 ? '' : 's'}`
                                    )}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">
                                    {t(lang, `الضريبة (${taxRate}%)`, `Tax (${taxRate}%)`)}
                                </p>
                                <p className="font-semibold text-white">
                                    {formatCurrency(pricingSummary.taxes)}
                                </p>
                            </div>
                            <div className="card p-4 bg-white/5">
                                <p className="text-white/50">{t(lang, 'الإجمالي المتوقع', 'Estimated total')}</p>
                                <p className="font-semibold text-success-500">
                                    {formatCurrency(pricingSummary.total)}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-warning-500">
                            {t(lang, 'يرجى التأكد من تواريخ الوصول والمغادرة لاحتساب السعر.', 'Please verify check-in and check-out dates to calculate pricing.')}
                        </p>
                    )}
                </div>

                <div className="card p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <BedDouble className="w-5 h-5 text-primary-300" />
                        {t(lang, 'ملاحظات وطلبات خاصة', 'Notes & Requests')}
                    </h2>

                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            {t(lang, 'الطلبات الخاصة', 'Special requests')}
                        </label>
                        <textarea
                            {...register('specialRequests')}
                            className="input min-h-[90px]"
                            placeholder={t(lang, 'مثال: سرير إضافي، إطلالة بحرية...', 'Example: extra bed, sea view...')}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            {t(lang, 'ملاحظات داخلية', 'Internal notes')}
                        </label>
                        <textarea
                            {...register('notes')}
                            className="input min-h-[90px]"
                            placeholder={t(lang, 'ملاحظات للإدارة أو الاستقبال...', 'Notes for management/front desk...')}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="btn-secondary"
                    >
                        {t(lang, 'إلغاء', 'Cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || loadingOptions}
                        className="btn-primary"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                <span>{t(lang, 'حفظ الحجز', 'Save Booking')}</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
