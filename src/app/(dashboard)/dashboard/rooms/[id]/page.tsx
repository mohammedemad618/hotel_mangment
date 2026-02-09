'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowRight,
    BedDouble,
    Check,
    Wrench,
    Sparkles,
    DollarSign,
    Users,
    Hash,
    CalendarCheck,
    XCircle,
    Clock,
    Loader2,
    Save,
    Pencil,
    Trash2,
    X,
} from 'lucide-react';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';

interface RoomDetail {
    _id: string;
    roomNumber: string;
    floor: number;
    type: string;
    status: string;
    pricePerNight: number;
    capacity: { adults: number; children: number };
    amenities: string[];
    description?: string;
    isActive?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

const statusConfig: Record<string, { label: { ar: string; en: string }; color: string; icon: any }> = {
    available: { label: { ar: 'متاحة', en: 'Available' }, color: 'badge-success', icon: Check },
    occupied: { label: { ar: 'مشغولة', en: 'Occupied' }, color: 'badge-primary', icon: BedDouble },
    reserved: { label: { ar: 'محجوزة', en: 'Reserved' }, color: 'badge-warning', icon: CalendarCheck },
    maintenance: { label: { ar: 'صيانة', en: 'Maintenance' }, color: 'badge-danger', icon: Wrench },
    cleaning: { label: { ar: 'تنظيف', en: 'Cleaning' }, color: 'badge-primary', icon: Sparkles },
    inactive: { label: { ar: 'غير نشطة', en: 'Inactive' }, color: 'badge bg-white/10 text-white/60', icon: XCircle },
};

const typeLabels: Record<string, { ar: string; en: string }> = {
    single: { ar: 'مفردة', en: 'Single' },
    double: { ar: 'مزدوجة', en: 'Double' },
    twin: { ar: 'توأم', en: 'Twin' },
    suite: { ar: 'جناح', en: 'Suite' },
    deluxe: { ar: 'فاخرة', en: 'Deluxe' },
    presidential: { ar: 'رئاسية', en: 'Presidential' },
};

const amenitiesList = [
    { value: 'تكييف', label: { ar: 'تكييف', en: 'AC' } },
    { value: 'واي فاي', label: { ar: 'واي فاي', en: 'Wi-Fi' } },
    { value: 'تلفزيون', label: { ar: 'تلفزيون', en: 'TV' } },
    { value: 'ميني بار', label: { ar: 'ميني بار', en: 'Mini bar' } },
    { value: 'خزنة', label: { ar: 'خزنة', en: 'Safe' } },
    { value: 'بلكونة', label: { ar: 'بلكونة', en: 'Balcony' } },
    { value: 'جاكوزي', label: { ar: 'جاكوزي', en: 'Jacuzzi' } },
    { value: 'مطبخ صغير', label: { ar: 'مطبخ صغير', en: 'Kitchenette' } },
    { value: 'غرفة معيشة', label: { ar: 'غرفة معيشة', en: 'Living room' } },
    { value: 'إطلالة بحرية', label: { ar: 'إطلالة بحرية', en: 'Sea view' } },
    { value: 'إطلالة حديقة', label: { ar: 'إطلالة حديقة', en: 'Garden view' } },
];

export default function RoomDetailsPage() {
    const { settings: hotelSettings } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [room, setRoom] = useState<RoomDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);

    const [form, setForm] = useState({
        roomNumber: '',
        floor: 0,
        type: 'single',
        pricePerNight: 0,
        capacity: { adults: 2, children: 0 },
        amenities: [] as string[],
        description: '',
    });

    const applyRoomToForm = (roomData: RoomDetail) => {
        setForm({
            roomNumber: roomData.roomNumber || '',
            floor: roomData.floor || 0,
            type: roomData.type || 'single',
            pricePerNight: roomData.pricePerNight || 0,
            capacity: {
                adults: roomData.capacity?.adults || 2,
                children: roomData.capacity?.children || 0,
            },
            amenities: roomData.amenities || [],
            description: roomData.description || '',
        });
    };

    useEffect(() => {
        const fetchRoom = async () => {
            try {
                const response = await fetchWithRefresh(`/api/rooms/${id}`);
                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || t(lang, 'تعذر جلب بيانات الغرفة', 'Failed to load room details'));
                    return;
                }

                setRoom(data.data);
                applyRoomToForm(data.data);
            } catch (err) {
                setError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
            } finally {
                setLoading(false);
            }
        };

        fetchRoom();
    }, [id, lang]);

    const formatCurrency = (amount: number) => {
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const currency = hotelSettings?.currency || 'SAR';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
        }).format(amount);
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

    const statusKey = room?.isActive === false ? 'inactive' : room?.status || 'available';
    const status = statusConfig[statusKey] || statusConfig.available;
    const StatusIcon = status.icon;

    const toggleAmenity = (amenity: string) => {
        setForm((prev) => ({
            ...prev,
            amenities: prev.amenities.includes(amenity)
                ? prev.amenities.filter((item) => item !== amenity)
                : [...prev.amenities, amenity],
        }));
    };

    const handleSave = async () => {
        if (!room) return;
        setActionError(null);
        setActionSuccess(null);
        setSaving(true);

        try {
            const response = await fetchWithRefresh(`/api/rooms/${room._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roomNumber: form.roomNumber,
                    floor: form.floor,
                    type: form.type,
                    pricePerNight: form.pricePerNight,
                    capacity: form.capacity,
                    amenities: form.amenities,
                    description: form.description,
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                setActionError(result.error || t(lang, 'تعذر تحديث بيانات الغرفة', 'Failed to update room details'));
                return;
            }

            setRoom(result.data);
            applyRoomToForm(result.data);
            setIsEditing(false);
            setActionSuccess(t(lang, 'تم تحديث بيانات الغرفة بنجاح', 'Room updated successfully'));
        } catch (err) {
            setActionError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async () => {
        if (!room) return;
        const confirmed = window.confirm(t(lang, 'هل تريد تعطيل هذه الغرفة؟', 'Deactivate this room?'));
        if (!confirmed) return;

        setActionError(null);
        setActionSuccess(null);
        setDeleting(true);

        try {
            const response = await fetchWithRefresh(`/api/rooms/${room._id}`, {
                method: 'DELETE',
            });

            const result = await response.json();
            if (!response.ok) {
                setActionError(result.error || t(lang, 'تعذر تعطيل الغرفة', 'Failed to deactivate the room'));
                return;
            }

            setRoom({ ...room, isActive: false });
            setActionSuccess(t(lang, 'تم تعطيل الغرفة بنجاح', 'Room deactivated successfully'));
        } catch (err) {
            setActionError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
        } finally {
            setDeleting(false);
        }
    };

    const handleToggleEdit = () => {
        if (isEditing && room) {
            applyRoomToForm(room);
        }
        setIsEditing((prev) => !prev);
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="spinner w-10 h-10" />
            </div>
        );
    }

    if (error || !room) {
        return (
            <div className="card p-8 text-center">
                <p className="text-danger-600">{error || t(lang, 'تعذر عرض الغرفة', 'Room not found')}</p>
                <button onClick={() => router.back()} className="btn-secondary mt-4">
                    {t(lang, 'رجوع', 'Back')}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-7">
            <div className="page-hero flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="relative z-10 p-2 rounded-lg hover:bg-white/10"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
                <div className="relative z-10 flex-1">
                    <h1 className="text-2xl font-bold text-white">
                        {t(lang, 'تفاصيل الغرفة', 'Room Details')}
                    </h1>
                    <p className="mt-1 text-white/60">
                        {t(lang, `رقم الغرفة: ${room.roomNumber}`, `Room #: ${room.roomNumber}`)}
                    </p>
                </div>
                <span className={`${status.color} relative z-10`}>
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
                    <div className="card p-6 relative overflow-hidden">
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-primary-500/0 via-primary-500/70 to-accent-500/0" />
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="stat-icon">
                                    <BedDouble className="w-6 h-6 text-primary-300" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        {t(lang, `غرفة ${room.roomNumber}`, `Room ${room.roomNumber}`)}
                                    </h2>
                                    <p className="text-sm text-white/50">
                                        {t(
                                            lang,
                                            `الطابق ${room.floor} - ${typeLabels[room.type]?.ar || room.type}`,
                                            `Floor ${room.floor} - ${typeLabels[room.type]?.en || room.type}`
                                        )}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleToggleEdit}
                                    className="btn-secondary text-sm"
                                >
                                    {isEditing ? (
                                        <>
                                            <X className="w-4 h-4" />
                                            {t(lang, 'إلغاء التعديل', 'Cancel editing')}
                                        </>
                                    ) : (
                                        <>
                                            <Pencil className="w-4 h-4" />
                                            {t(lang, 'تعديل البيانات', 'Edit details')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {!isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2 text-white/60">
                                    <Hash className="w-4 h-4" />
                                    <span>{t(lang, 'النوع', 'Type')}</span>
                                    <span className="font-medium text-white mr-auto">
                                        {typeLabels[room.type]?.[lang] || room.type}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <DollarSign className="w-4 h-4" />
                                    <span>{t(lang, 'السعر/ليلة', 'Rate/night')}</span>
                                    <span className="font-medium text-primary-300 mr-auto">
                                        {formatCurrency(room.pricePerNight)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <Users className="w-4 h-4" />
                                    <span>{t(lang, 'السعة', 'Capacity')}</span>
                                    <span className="font-medium text-white mr-auto">
                                        {t(
                                            lang,
                                            `${room.capacity.adults} بالغ${room.capacity.children > 0 ? ` + ${room.capacity.children} طفل` : ''}`,
                                            `${room.capacity.adults} ${room.capacity.adults === 1 ? 'adult' : 'adults'}${room.capacity.children > 0 ? ` + ${room.capacity.children} ${room.capacity.children === 1 ? 'child' : 'children'}` : ''}`
                                        )}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <BedDouble className="w-4 h-4" />
                                    <span>{t(lang, 'الحالة', 'Status')}</span>
                                    <span className="font-medium text-white mr-auto">
                                        {status.label[lang]}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'رقم الغرفة', 'Room number')}</label>
                                        <input
                                            value={form.roomNumber}
                                            onChange={(e) => setForm((prev) => ({ ...prev, roomNumber: e.target.value }))}
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'الطابق', 'Floor')}</label>
                                        <input
                                            type="number"
                                            value={form.floor}
                                            onChange={(e) => setForm((prev) => ({ ...prev, floor: Number(e.target.value) }))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'نوع الغرفة', 'Room type')}</label>
                                        <select
                                            value={form.type}
                                            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                                            className="input"
                                        >
                                            {Object.entries(typeLabels).map(([value, label]) => (
                                                <option key={value} value={value}>{label[lang]}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'سعر الليلة', 'Nightly rate')}</label>
                                        <input
                                            type="number"
                                            value={form.pricePerNight}
                                            onChange={(e) => setForm((prev) => ({ ...prev, pricePerNight: Number(e.target.value) }))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'البالغين', 'Adults')}</label>
                                        <input
                                            type="number"
                                            value={form.capacity.adults}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    capacity: { ...prev.capacity, adults: Number(e.target.value) },
                                                }))
                                            }
                                            className="input"
                                            min="1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'الأطفال', 'Children')}</label>
                                        <input
                                            type="number"
                                            value={form.capacity.children}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    capacity: { ...prev.capacity, children: Number(e.target.value) },
                                                }))
                                            }
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'المرافق', 'Amenities')}</label>
                                    <div className="flex flex-wrap gap-2">
                                        {amenitiesList.map((amenity) => (
                                            <button
                                                key={amenity.value}
                                                type="button"
                                                onClick={() => toggleAmenity(amenity.value)}
                                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${form.amenities.includes(amenity.value)
                                                        ? 'bg-primary-500/80 text-white'
                                                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                                                    }`}
                                            >
                                                {amenity.label[lang]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">{t(lang, 'الوصف', 'Description')}</label>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                        className="input min-h-[120px]"
                                    />
                                </div>

                                <div className="flex justify-end gap-3">
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={handleToggleEdit}
                                    >
                                        {t(lang, 'إلغاء', 'Cancel')}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        {saving ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <Save className="w-5 h-5" />
                                                {t(lang, 'حفظ التعديلات', 'Save changes')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card p-6">
                        <h3 className="text-sm font-medium text-white/70 mb-3">{t(lang, 'المرافق', 'Amenities')}</h3>
                        {room.amenities?.length ? (
                            <div className="flex flex-wrap gap-2">
                                {room.amenities.map((amenity) => {
                                    const label = amenitiesList.find((item) => item.value === amenity)?.label[lang] || amenity;
                                    return (
                                        <span key={amenity} className="badge-primary">
                                            {label}
                                        </span>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-white/50">{t(lang, 'لا توجد مرافق مسجلة.', 'No amenities recorded.')}</p>
                        )}
                    </div>

                    <div className="card p-6">
                        <h3 className="text-sm font-medium text-white/70 mb-3">{t(lang, 'الوصف', 'Description')}</h3>
                        <p className="text-white/60">
                            {room.description || t(lang, 'لا يوجد وصف لهذه الغرفة.', 'No description for this room.')}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">{t(lang, 'ملخص الغرفة', 'Room summary')}</h3>
                        <div className="space-y-3 text-sm">
                            <div className="surface-tile flex items-center justify-between">
                                <span className="text-white/50">{t(lang, 'رقم الغرفة', 'Room #')}</span>
                                <span className="font-medium text-white">{room.roomNumber}</span>
                            </div>
                            <div className="surface-tile flex items-center justify-between">
                                <span className="text-white/50">{t(lang, 'الطابق', 'Floor')}</span>
                                <span className="font-medium text-white">{room.floor}</span>
                            </div>
                            <div className="surface-tile flex items-center justify-between">
                                <span className="text-white/50">{t(lang, 'السعر', 'Rate')}</span>
                                <span className="font-medium text-primary-300">{formatCurrency(room.pricePerNight)}</span>
                            </div>
                            <div className="surface-tile flex items-center justify-between">
                                <span className="text-white/50">{t(lang, 'الحالة', 'Status')}</span>
                                <span className="font-medium text-white">{status.label[lang]}</span>
                            </div>
                            <div className="surface-tile flex items-center justify-between">
                                <span className="text-white/50">{t(lang, 'النشاط', 'Activity')}</span>
                                <span className="font-medium text-white">{room.isActive === false ? t(lang, 'غير نشطة', 'Inactive') : t(lang, 'نشطة', 'Active')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">{t(lang, 'الإجراءات', 'Actions')}</h3>
                        <div className="space-y-3">
                            <button
                                className="btn-secondary w-full"
                                onClick={handleToggleEdit}
                            >
                                <Pencil className="w-4 h-4" />
                                {isEditing ? t(lang, 'إلغاء التعديل', 'Cancel editing') : t(lang, 'تعديل الغرفة', 'Edit room')}
                            </button>
                            <button
                                className="btn-danger w-full"
                                onClick={handleDeactivate}
                                disabled={deleting || room.isActive === false}
                            >
                                {deleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                {room.isActive === false ? t(lang, 'الغرفة معطلة', 'Room deactivated') : t(lang, 'تعطيل الغرفة', 'Deactivate room')}
                            </button>
                        </div>
                    </div>

                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">{t(lang, 'البيانات الزمنية', 'Timestamps')}</h3>
                        <div className="space-y-3 text-sm">
                            <div className="surface-tile flex items-center gap-2 text-white/60">
                                <Clock className="w-4 h-4" />
                                <span>{t(lang, 'تاريخ الإنشاء:', 'Created:')}</span>
                                <span className="font-medium text-white mr-auto">{formatDateTime(room.createdAt)}</span>
                            </div>
                            <div className="surface-tile flex items-center gap-2 text-white/60">
                                <Clock className="w-4 h-4" />
                                <span>{t(lang, 'آخر تحديث:', 'Last updated:')}</span>
                                <span className="font-medium text-white mr-auto">{formatDateTime(room.updatedAt)}</span>
                            </div>
                        </div>
                    </div>

                    <Link href="/dashboard/rooms" className="btn-secondary w-full">
                        {t(lang, 'العودة إلى قائمة الغرف', 'Back to rooms')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
