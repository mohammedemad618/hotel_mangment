'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import {
    ArrowRight,
    User,
    Phone,
    Mail,
    Globe,
    CreditCard,
    Crown,
    Building2,
    CalendarCheck,
    DollarSign,
    Clock,
    ShieldAlert,
    Save,
    X,
} from 'lucide-react';

interface GuestDetail {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    nationality: string;
    idType: string;
    idNumber: string;
    guestType: string;
    companyName?: string;
    dateOfBirth?: string;
    notes?: string;
    totalStays: number;
    totalSpent: number;
    lastStay?: string;
    createdAt?: string;
    isBlacklisted: boolean;
}

const nationalities = [
    'سعودي', 'إماراتي', 'كويتي', 'بحريني', 'قطري', 'عماني',
    'مصري', 'أردني', 'لبناني', 'سوري', 'عراقي', 'يمني',
    'أمريكي', 'بريطاني', 'فرنسي', 'ألماني', 'أخرى',
];

const idTypes = [
    { value: 'national_id', label: 'هوية وطنية' },
    { value: 'passport', label: 'جواز سفر' },
    { value: 'driver_license', label: 'رخصة قيادة' },
];

const guestTypes = [
    { value: 'individual', label: 'فردي', icon: User },
    { value: 'corporate', label: 'شركات', icon: Building2 },
    { value: 'vip', label: 'VIP', icon: Crown },
];

const guestTypeConfig: Record<string, { label: string; color: string; icon: any }> = {
    individual: { label: 'فردي', color: 'badge-primary', icon: User },
    corporate: { label: 'شركات', color: 'badge bg-accent-500/15 text-accent-300', icon: Building2 },
    vip: { label: 'VIP', color: 'badge bg-warning-500/15 text-warning-500', icon: Crown },
};

const idTypeLabels: Record<string, string> = {
    passport: 'جواز سفر',
    national_id: 'هوية وطنية',
    driver_license: 'رخصة قيادة',
};

export default function GuestDetailsPage() {
    const { settings: hotelSettings } = useHotelSettings();
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const [guest, setGuest] = useState<GuestDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        nationality: '',
        idType: 'national_id',
        idNumber: '',
        guestType: 'individual',
        companyName: '',
        notes: '',
        dateOfBirth: '',
    });
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

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
        const fetchGuest = async () => {
            try {
                const response = await fetchWithRefresh(`/api/guests/${id}`);
                const data = await response.json();

                if (!response.ok) {
                    setError(data.error || 'تعذر جلب بيانات النزيل');
                    return;
                }

                setGuest(data.data);
            } catch (err) {
                setError('حدث خطأ في الاتصال بالخادم');
            } finally {
                setLoading(false);
            }
        };

        fetchGuest();
    }, [id]);

    useEffect(() => {
        if (!guest) return;
        setFormData({
            firstName: guest.firstName || '',
            lastName: guest.lastName || '',
            email: guest.email || '',
            phone: guest.phone || '',
            nationality: guest.nationality || '',
            idType: guest.idType || 'national_id',
            idNumber: guest.idNumber || '',
            guestType: guest.guestType || 'individual',
            companyName: guest.companyName || '',
            notes: guest.notes || '',
            dateOfBirth: guest.dateOfBirth ? new Date(guest.dateOfBirth).toISOString().slice(0, 10) : '',
        });
    }, [guest]);

    const formatCurrency = (amount: number) => {
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const currency = hotelSettings?.currency || 'SAR';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '—';
        const locale = hotelSettings?.language === 'en' ? 'en-US' : 'ar-SA';
        const timeZone = hotelSettings?.timezone || 'Asia/Riyadh';
        return new Date(dateStr).toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone,
        });
    };

    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const resetForm = () => {
        if (!guest) return;
        setFormData({
            firstName: guest.firstName || '',
            lastName: guest.lastName || '',
            email: guest.email || '',
            phone: guest.phone || '',
            nationality: guest.nationality || '',
            idType: guest.idType || 'national_id',
            idNumber: guest.idNumber || '',
            guestType: guest.guestType || 'individual',
            companyName: guest.companyName || '',
            notes: guest.notes || '',
            dateOfBirth: guest.dateOfBirth ? new Date(guest.dateOfBirth).toISOString().slice(0, 10) : '',
        });
    };

    const handleSave = async () => {
        if (!guest) return;
        setSaveError(null);
        setSaveSuccess(null);
        setSaving(true);

        try {
            const payload = {
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim() || '',
                phone: formData.phone.trim(),
                nationality: formData.nationality,
                idType: formData.idType,
                idNumber: formData.idNumber.trim(),
                guestType: formData.guestType,
                companyName: formData.companyName.trim(),
                notes: formData.notes.trim(),
                dateOfBirth: formData.dateOfBirth || undefined,
            };

            const response = await fetchWithRefresh(`/api/guests/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok) {
                setSaveError(data.error || 'تعذر تحديث بيانات النزيل');
                return;
            }

            setGuest(data.data);
            setIsEditing(false);
            setSaveSuccess('تم تحديث بيانات النزيل بنجاح');
        } catch (err) {
            setSaveError('حدث خطأ في الاتصال بالخادم');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="spinner w-10 h-10" />
            </div>
        );
    }

    if (error || !guest) {
        return (
            <div className="card p-8 text-center">
                <p className="text-danger-600">{error || 'النزيل غير موجود'}</p>
                <button onClick={() => router.back()} className="btn-secondary mt-4">
                    العودة
                </button>
            </div>
        );
    }

    const typeInfo = guestTypeConfig[guest.guestType] || guestTypeConfig.individual;
    const TypeIcon = typeInfo.icon;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-white/10"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        تفاصيل النزيل
                    </h1>
                    <p className="mt-1 text-white/60">
                        {guest.firstName} {guest.lastName}
                    </p>
                </div>
            </div>

            {guest.isBlacklisted && (
                <div className="p-4 rounded-2xl border border-danger-500/30 bg-danger-500/10 text-danger-500 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    <span>هذا النزيل مدرج في القائمة السوداء. يرجى توخي الحذر عند التعامل.</span>
                </div>
            )}

            {saveSuccess && !isEditing && (
                <div className="p-4 rounded-2xl border border-success-500/30 bg-success-500/10 text-success-500 text-sm">
                    {saveSuccess}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="card p-6">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary-500/15 rounded-xl">
                                    <User className="w-6 h-6 text-primary-300" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        {guest.firstName} {guest.lastName}
                                    </h2>
                                    <p className="text-sm text-white/50">{guest.nationality}</p>
                                </div>
                            </div>
                            <span className={typeInfo.color}>
                                <TypeIcon className="w-3 h-3 ml-1 inline" />
                                {typeInfo.label}
                            </span>
                        </div>

                        {isEditing ? (
                            <div className="space-y-6">
                                {saveError && (
                                    <div className="p-3 rounded-xl border border-danger-500/30 bg-danger-500/10 text-danger-500 text-sm">
                                        {saveError}
                                    </div>
                                )}
                                {saveSuccess && (
                                    <div className="p-3 rounded-xl border border-success-500/30 bg-success-500/10 text-success-500 text-sm">
                                        {saveSuccess}
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <label className="block text-xs text-white/60 mb-2">الاسم الأول</label>
                                        <input
                                            className="input"
                                            value={formData.firstName}
                                            onChange={(e) => handleChange('firstName', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/60 mb-2">الاسم الأخير</label>
                                        <input
                                            className="input"
                                            value={formData.lastName}
                                            onChange={(e) => handleChange('lastName', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/60 mb-2">رقم الهاتف</label>
                                        <input
                                            className="input"
                                            dir="ltr"
                                            value={formData.phone}
                                            onChange={(e) => handleChange('phone', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/60 mb-2">البريد الإلكتروني</label>
                                        <input
                                            className="input"
                                            dir="ltr"
                                            value={formData.email}
                                            onChange={(e) => handleChange('email', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/60 mb-2">تاريخ الميلاد</label>
                                        <input
                                            className="input"
                                            type="date"
                                            value={formData.dateOfBirth}
                                            onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/60 mb-2">الجنسية</label>
                                        <select
                                            className="input"
                                            value={formData.nationality}
                                            onChange={(e) => handleChange('nationality', e.target.value)}
                                        >
                                            <option value="">اختر الجنسية</option>
                                            {nationalities.map((nat) => (
                                                <option key={nat} value={nat}>{nat}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/60 mb-2">نوع الهوية</label>
                                        <select
                                            className="input"
                                            value={formData.idType}
                                            onChange={(e) => handleChange('idType', e.target.value)}
                                        >
                                            {idTypes.map((type) => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/60 mb-2">رقم الهوية</label>
                                        <input
                                            className="input"
                                            dir="ltr"
                                            value={formData.idNumber}
                                            onChange={(e) => handleChange('idNumber', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-white/60 mb-2">نوع النزيل</label>
                                        <select
                                            className="input"
                                            value={formData.guestType}
                                            onChange={(e) => handleChange('guestType', e.target.value)}
                                        >
                                            {guestTypes.map((type) => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {formData.guestType === 'corporate' && (
                                        <div>
                                            <label className="block text-xs text-white/60 mb-2">اسم الشركة</label>
                                            <input
                                                className="input"
                                                value={formData.companyName}
                                                onChange={(e) => handleChange('companyName', e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-white/60 mb-2">ملاحظات</label>
                                    <textarea
                                        className="input min-h-[120px]"
                                        value={formData.notes}
                                        onChange={(e) => handleChange('notes', e.target.value)}
                                    />
                                </div>
                                <div className="flex flex-wrap justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setSaveError(null);
                                            setSaveSuccess(null);
                                            resetForm();
                                        }}
                                        className="btn-secondary"
                                        disabled={saving}
                                    >
                                        <X className="w-4 h-4" />
                                        إلغاء
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        className="btn-primary"
                                        disabled={saving}
                                    >
                                        <Save className="w-4 h-4" />
                                        حفظ التعديلات
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="flex items-center gap-2 text-white/60">
                                    <Phone className="w-4 h-4" />
                                    <span dir="ltr">{guest.phone}</span>
                                </div>
                                {guest.email && (
                                    <div className="flex items-center gap-2 text-white/60">
                                        <Mail className="w-4 h-4" />
                                        <span dir="ltr">{guest.email}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-white/60">
                                    <Globe className="w-4 h-4" />
                                    <span>{guest.nationality}</span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <CreditCard className="w-4 h-4" />
                                    <span>
                                        {idTypeLabels[guest.idType] || guest.idType} - {guest.idNumber}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <CalendarCheck className="w-4 h-4" />
                                    <span>تاريخ الميلاد: {formatDate(guest.dateOfBirth)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-white/60">
                                    <Clock className="w-4 h-4" />
                                    <span>آخر إقامة: {formatDate(guest.lastStay)}</span>
                                </div>
                            </div>
                        )}

                        {guest.companyName && (
                            <div className="mt-4 text-sm text-white/60">
                                الشركة: <span className="font-medium text-white">{guest.companyName}</span>
                            </div>
                        )}
                    </div>

                    <div className="card p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">ملاحظات النزيل</h3>
                        {isEditing ? (
                            <p className="text-white/60">
                                يمكنك تحديث الملاحظات من نموذج التعديل بالأعلى.
                            </p>
                        ) : (
                            <p className="text-white/60">
                                {guest.notes || 'لا توجد ملاحظات مسجلة لهذا النزيل.'}
                            </p>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="card p-6 space-y-4">
                        <h3 className="text-sm font-medium text-white/70">إحصائيات النزيل</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white/60">
                                    <CalendarCheck className="w-4 h-4" />
                                    <span>عدد الإقامات</span>
                                </div>
                                <span className="font-semibold text-white">{guest.totalStays}</span>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white/60">
                                    <DollarSign className="w-4 h-4" />
                                    <span>إجمالي الإنفاق</span>
                                </div>
                                <span className="font-semibold text-success-500">{formatCurrency(guest.totalSpent)}</span>
                            </div>
                            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white/60">
                                    <Clock className="w-4 h-4" />
                                    <span>آخر إقامة</span>
                                </div>
                                <span className="font-semibold text-white">{formatDate(guest.lastStay)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="card p-6 space-y-3">
                        <h3 className="text-sm font-medium text-white/70">تواصل سريع</h3>
                        <a
                            href={`tel:${guest.phone}`}
                            className="btn-secondary w-full text-sm"
                        >
                            <Phone className="w-4 h-4" />
                            اتصال بالنزيل
                        </a>
                        {guest.email && (
                            <a
                                href={`mailto:${guest.email}`}
                                className="btn-secondary w-full text-sm"
                            >
                                <Mail className="w-4 h-4" />
                                إرسال بريد
                            </a>
                        )}
                        <Link href="/dashboard/guests" className="btn-secondary w-full text-sm">
                            العودة لقائمة النزلاء
                        </Link>
                    </div>

                    <div className="card p-6 space-y-3">
                        <h3 className="text-sm font-medium text-white/70">إدارة البيانات</h3>
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditing(true);
                                setSaveError(null);
                                setSaveSuccess(null);
                                resetForm();
                            }}
                            className="btn-primary w-full text-sm"
                        >
                            <Save className="w-4 h-4" />
                            تعديل بيانات النزيل
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
