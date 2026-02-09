'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowRight,
    Save,
    Loader2,
    User,
    Phone,
    Mail,
    CreditCard,
    Globe,
    Building2,
    CalendarCheck,
    Crown,
} from 'lucide-react';
import { useHotelSettings } from '@/app/(dashboard)/layout';
import { createGuestSchema, CreateGuestInput } from '@/lib/validations';
import { fetchWithRefresh } from '@/lib/fetchWithRefresh';
import { normalizeLanguage, t } from '@/lib/i18n';

const nationalities = [
    { value: 'سعودي', label: { ar: 'سعودي', en: 'Saudi' } },
    { value: 'إماراتي', label: { ar: 'إماراتي', en: 'Emirati' } },
    { value: 'كويتي', label: { ar: 'كويتي', en: 'Kuwaiti' } },
    { value: 'بحريني', label: { ar: 'بحريني', en: 'Bahraini' } },
    { value: 'قطري', label: { ar: 'قطري', en: 'Qatari' } },
    { value: 'عماني', label: { ar: 'عماني', en: 'Omani' } },
    { value: 'مصري', label: { ar: 'مصري', en: 'Egyptian' } },
    { value: 'أردني', label: { ar: 'أردني', en: 'Jordanian' } },
    { value: 'لبناني', label: { ar: 'لبناني', en: 'Lebanese' } },
    { value: 'سوري', label: { ar: 'سوري', en: 'Syrian' } },
    { value: 'عراقي', label: { ar: 'عراقي', en: 'Iraqi' } },
    { value: 'يمني', label: { ar: 'يمني', en: 'Yemeni' } },
    { value: 'أمريكي', label: { ar: 'أمريكي', en: 'American' } },
    { value: 'بريطاني', label: { ar: 'بريطاني', en: 'British' } },
    { value: 'فرنسي', label: { ar: 'فرنسي', en: 'French' } },
    { value: 'ألماني', label: { ar: 'ألماني', en: 'German' } },
    { value: 'أخرى', label: { ar: 'أخرى', en: 'Other' } },
];

const idTypes = [
    { value: 'national_id', label: { ar: 'هوية وطنية', en: 'National ID' } },
    { value: 'passport', label: { ar: 'جواز سفر', en: 'Passport' } },
    { value: 'driver_license', label: { ar: 'رخصة قيادة', en: 'Driver license' } },
];

const guestTypes = [
    { value: 'individual', label: { ar: 'فردي', en: 'Individual' }, icon: User },
    { value: 'corporate', label: { ar: 'شركات', en: 'Corporate' }, icon: Building2 },
    { value: 'vip', label: { ar: 'VIP', en: 'VIP' }, icon: Crown },
];

export default function NewGuestPage() {
    const router = useRouter();
    const { settings: hotelSettings } = useHotelSettings();
    const lang = normalizeLanguage(hotelSettings?.language);
    const [error, setError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<CreateGuestInput>({
        resolver: zodResolver(createGuestSchema),
        defaultValues: {
            guestType: 'individual',
            idType: 'national_id',
        },
    });

    const selectedGuestType = watch('guestType');
    const selectedIdType = watch('idType');

    const onSubmit = async (data: CreateGuestInput) => {
        setError(null);

        try {
            const response = await fetchWithRefresh('/api/guests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || t(lang, 'حدث خطأ أثناء إنشاء النزيل', 'Failed to create the guest'));
                return;
            }

            router.push('/dashboard/guests');

        } catch (err) {
            setError(t(lang, 'حدث خطأ في الاتصال بالخادم', 'Network error while contacting the server'));
        }
    };

    const idPlaceholder = selectedIdType === 'passport'
        ? 'A1234567'
        : selectedIdType === 'driver_license'
            ? 'DL-987654'
            : '1234567890';

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-white/10"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">
                        {t(lang, 'إضافة نزيل جديد', 'Add New Guest')}
                    </h1>
                    <p className="mt-1 text-white/60">
                        {t(lang, 'أدخل بيانات النزيل الجديد', 'Enter the guest details')}
                    </p>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-danger-500/10 border border-danger-500/20 rounded-xl text-danger-500 text-sm animate-slide-down">
                    {error}
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Guest Type */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        {t(lang, 'نوع النزيل', 'Guest Type')}
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                        {guestTypes.map((type) => (
                            <label
                                key={type.value}
                                className={`relative flex flex-col items-center cursor-pointer rounded-xl border-2 p-4 transition-all ${selectedGuestType === type.value
                                        ? 'border-primary-500 bg-primary-500/15'
                                        : 'border-white/10 hover:border-primary-300'
                                    }`}
                            >
                                <input
                                    type="radio"
                                    {...register('guestType')}
                                    value={type.value}
                                    className="sr-only"
                                />
                                <type.icon className={`w-8 h-8 mb-2 ${selectedGuestType === type.value ? 'text-primary-300' : 'text-white/40'
                                    }`} />
                                <span className="font-medium text-white">
                                    {type.label[lang]}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Personal Info */}
                <div className="card p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-primary-300" />
                        {t(lang, 'المعلومات الشخصية', 'Personal Information')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'الاسم الأول *', 'First name *')}
                            </label>
                            <input
                                {...register('firstName')}
                                className="input"
                                placeholder={t(lang, 'محمد', 'Mohammed')}
                            />
                            {errors.firstName && (
                                <p className="mt-1 text-sm text-danger-500">{errors.firstName.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'الاسم الأخير *', 'Last name *')}
                            </label>
                            <input
                                {...register('lastName')}
                                className="input"
                                placeholder={t(lang, 'العلي', 'Al Ali')}
                            />
                            {errors.lastName && (
                                <p className="mt-1 text-sm text-danger-500">{errors.lastName.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'رقم الهاتف *', 'Phone *')}
                            </label>
                            <div className="relative">
                                <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    {...register('phone')}
                                    className="input pr-10"
                                    placeholder="+966 50 123 4567"
                                    dir="ltr"
                                />
                            </div>
                            {errors.phone && (
                                <p className="mt-1 text-sm text-danger-500">{errors.phone.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'البريد الإلكتروني', 'Email')}
                            </label>
                            <div className="relative">
                                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    {...register('email')}
                                    type="email"
                                    className="input pr-10"
                                    placeholder="email@example.com"
                                    dir="ltr"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'تاريخ الميلاد', 'Date of birth')}
                            </label>
                            <div className="relative">
                                <CalendarCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="date"
                                    {...register('dateOfBirth')}
                                    className="input pr-10"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'الجنسية *', 'Nationality *')}
                            </label>
                            <div className="relative">
                                <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <select {...register('nationality')} className="input pr-10">
                                    <option value="">{t(lang, 'اختر الجنسية', 'Select nationality')}</option>
                                    {nationalities.map((nat) => (
                                        <option key={nat.value} value={nat.value}>{nat.label[lang]}</option>
                                    ))}
                                </select>
                            </div>
                            {errors.nationality && (
                                <p className="mt-1 text-sm text-danger-500">{errors.nationality.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'نوع الهوية *', 'ID type *')}
                            </label>
                            <select {...register('idType')} className="input">
                                {idTypes.map((type) => (
                                    <option key={type.value} value={type.value}>{type.label[lang]}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                {t(lang, 'رقم الهوية *', 'ID number *')}
                            </label>
                            <div className="relative">
                                <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    {...register('idNumber')}
                                    className="input pr-10"
                                    placeholder={idPlaceholder}
                                    dir="ltr"
                                />
                            </div>
                            {errors.idNumber && (
                                <p className="mt-1 text-sm text-danger-500">{errors.idNumber.message}</p>
                            )}
                        </div>

                        {selectedGuestType === 'corporate' && (
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    {t(lang, 'اسم الشركة', 'Company name')}
                                </label>
                                <input
                                    {...register('companyName')}
                                    className="input"
                                    placeholder={t(lang, 'شركة ABC', 'Company ABC')}
                                />
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            {t(lang, 'ملاحظات', 'Notes')}
                        </label>
                        <textarea
                            {...register('notes')}
                            className="input min-h-[100px]"
                            placeholder={t(lang, 'أي ملاحظات إضافية...', 'Any additional notes...')}
                        />
                    </div>
                </div>

                {/* Submit */}
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
                        disabled={isSubmitting}
                        className="btn-primary"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                <span>{t(lang, 'حفظ النزيل', 'Save Guest')}</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
