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

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    available: { label: 'متاحة', color: 'badge-success', icon: Check },
    occupied: { label: 'مشغولة', color: 'badge-primary', icon: BedDouble },
    reserved: { label: 'محجوزة', color: 'badge-warning', icon: CalendarCheck },
    maintenance: { label: 'صيانة', color: 'badge-danger', icon: Wrench },
    cleaning: { label: 'تنظيف', color: 'badge-primary', icon: Sparkles },
    inactive: { label: 'غير نشطة', color: 'badge bg-white/10 text-white/60', icon: XCircle },
};

const typeLabels: Record<string, string> = {
    single: 'مفردة',
    double: 'مزدوجة',
    twin: 'توأم',
    suite: 'جناح',
    deluxe: 'فاخرة',
    presidential: 'رئاسية',
};

const amenitiesList = [
    'تكييف', 'واي فاي', 'تلفزيون', 'ميني بار', 'خزنة', 'بلكونة',
    'جاكوزي', 'مطبخ صغير', 'غرفة معيشة', 'إطلالة بحرية', 'إطلالة حديقة',
];

export default function RoomDetailsPage() {
    const { settings: hotelSettings } = useHotelSettings();
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
        const fetchRoom = async () => {
            try {
                const response = await fetchWithRefresh(`/api/rooms/${id}`);
                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || 'تعذر جلب بيانات الغرفة');
                    return;
                }

                setRoom(data.data);
                applyRoomToForm(data.data);
            } catch (err) {
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };

        fetchRoom();
    }, [id]);

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
                setActionError(result.error || 'تعذر تحديث بيانات الغرفة');
                return;
            }

            setRoom(result.data);
            applyRoomToForm(result.data);
            setIsEditing(false);
            setActionSuccess('تم تحديث بيانات الغرفة بنجاح');
        } catch (err) {
            setActionError('حدث خطأ في الاتصال بالخادم');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async () => {
        if (!room) return;
        const confirmed = window.confirm('هل تريد تعطيل هذه الغرفة؟');
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
                setActionError(result.error || 'تعذر تعطيل الغرفة');
                return;
            }

            setRoom({ ...room, isActive: false });
            setActionSuccess('تم تعطيل الغرفة بنجاح');
        } catch (err) {
            setActionError('حدث خطأ في الاتصال بالخادم');
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
                <p className="text-danger-600">{error || 'تعذر عرض الغرفة'}</p>
                <button onClick={() => router.back()} className="btn-secondary mt-4">
                    رجوع
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-white/10"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white">
                        تفاصيل الغرفة
                    </h1>
                    <p className="mt-1 text-white/60">
                        رقم الغرفة: {room.roomNumber}
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
                    <div className="card p-6">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary-500/15 rounded-xl">
                                    <BedDouble className="w-6 h-6 text-primary-300" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        غرفة {room.roomNumber}
                                    </h2>
                                    <p className="text-sm text-white/50">
                                        الطابق {room.floor} - {typeLabels[room.type] || room.type}
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
                                            إلغاء التعديل
                                        </>
                                    ) : (
                                        <>
                                            <Pencil className="w-4 h-4" />
                                            تعديل البيانات
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {!isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2 text-white/60">
                                    <Hash className="w-4 h-4" />
                                    <span>النوع</span>
                                    <span className="font-medium text-white mr-auto">
                                        {typeLabels[room.type] || room.type}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <DollarSign className="w-4 h-4" />
                                    <span>السعر/ليلة</span>
                                    <span className="font-medium text-primary-300 mr-auto">
                                        {formatCurrency(room.pricePerNight)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <Users className="w-4 h-4" />
                                    <span>السعة</span>
                                    <span className="font-medium text-white mr-auto">
                                        {room.capacity.adults} بالغ
                                        {room.capacity.children > 0 && ` + ${room.capacity.children} طفل`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <BedDouble className="w-4 h-4" />
                                    <span>الحالة</span>
                                    <span className="font-medium text-white mr-auto">
                                        {status.label}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">رقم الغرفة</label>
                                        <input
                                            value={form.roomNumber}
                                            onChange={(e) => setForm((prev) => ({ ...prev, roomNumber: e.target.value }))}
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">الطابق</label>
                                        <input
                                            type="number"
                                            value={form.floor}
                                            onChange={(e) => setForm((prev) => ({ ...prev, floor: Number(e.target.value) }))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">نوع الغرفة</label>
                                        <select
                                            value={form.type}
                                            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                                            className="input"
                                        >
                                            {Object.entries(typeLabels).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">سعر الليلة</label>
                                        <input
                                            type="number"
                                            value={form.pricePerNight}
                                            onChange={(e) => setForm((prev) => ({ ...prev, pricePerNight: Number(e.target.value) }))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/70 mb-2">البالغين</label>
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
                                        <label className="block text-sm font-medium text-white/70 mb-2">الأطفال</label>
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
                                    <label className="block text-sm font-medium text-white/70 mb-2">المرافق</label>
                                    <div className="flex flex-wrap gap-2">
                                        {amenitiesList.map((amenity) => (
                                            <button
                                                key={amenity}
                                                type="button"
                                                onClick={() => toggleAmenity(amenity)}
                                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${form.amenities.includes(amenity)
                                                        ? 'bg-primary-500/80 text-white'
                                                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                                                    }`}
                                            >
                                                {amenity}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">الوصف</label>
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
                                        إلغاء
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
                                                حفظ التعديلات
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card p-6">
                        <h3 className="text-sm font-medium text-white/70 mb-3">المرافق</h3>
                        {room.amenities?.length ? (
                            <div className="flex flex-wrap gap-2">
                                {room.amenities.map((amenity) => (
                                    <span key={amenity} className="badge-primary">
                                        {amenity}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-white/50">لا توجد مرافق مسجلة.</p>
                        )}
                    </div>

                    <div className="card p-6">
                        <h3 className="text-sm font-medium text-white/70 mb-3">الوصف</h3>
                        <p className="text-white/60">
                            {room.description || 'لا يوجد وصف لهذه الغرفة.'}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">ملخص الغرفة</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-white/50">رقم الغرفة</span>
                                <span className="font-medium text-white">{room.roomNumber}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/50">الطابق</span>
                                <span className="font-medium text-white">{room.floor}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/50">السعر</span>
                                <span className="font-medium text-primary-300">{formatCurrency(room.pricePerNight)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/50">الحالة</span>
                                <span className="font-medium text-white">{status.label}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-white/50">النشاط</span>
                                <span className="font-medium text-white">{room.isActive === false ? 'غير نشطة' : 'نشطة'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">الإجراءات</h3>
                        <div className="space-y-3">
                            <button
                                className="btn-secondary w-full"
                                onClick={handleToggleEdit}
                            >
                                <Pencil className="w-4 h-4" />
                                {isEditing ? 'إلغاء التعديل' : 'تعديل الغرفة'}
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
                                {room.isActive === false ? 'الغرفة معطلة' : 'تعطيل الغرفة'}
                            </button>
                        </div>
                    </div>

                    <div className="card p-5">
                        <h3 className="text-sm font-medium text-white/70 mb-4">البيانات الزمنية</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-center gap-2 text-white/60">
                                <Clock className="w-4 h-4" />
                                <span>تاريخ الإنشاء:</span>
                                <span className="font-medium text-white mr-auto">{formatDateTime(room.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-white/60">
                                <Clock className="w-4 h-4" />
                                <span>آخر تحديث:</span>
                                <span className="font-medium text-white mr-auto">{formatDateTime(room.updatedAt)}</span>
                            </div>
                        </div>
                    </div>

                    <Link href="/dashboard/rooms" className="btn-secondary w-full">
                        العودة إلى قائمة الغرف
                    </Link>
                </div>
            </div>
        </div>
    );
}
