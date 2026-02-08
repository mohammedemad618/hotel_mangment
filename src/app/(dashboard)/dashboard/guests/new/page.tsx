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
import { createGuestSchema, CreateGuestInput } from '@/lib/validations';

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

export default function NewGuestPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

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
                setError(result.error || 'حدث خطأ أثناء إنشاء النزيل');
                return;
            }

            router.push('/dashboard/guests');

        } catch (err) {
            setError('حدث خطأ في الاتصال بالخادم');
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
                        إضافة نزيل جديد
                    </h1>
                    <p className="mt-1 text-white/60">
                        أدخل بيانات النزيل الجديد
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
                        نوع النزيل
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
                                    {type.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Personal Info */}
                <div className="card p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-primary-300" />
                        المعلومات الشخصية
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                الاسم الأول *
                            </label>
                            <input
                                {...register('firstName')}
                                className="input"
                                placeholder="محمد"
                            />
                            {errors.firstName && (
                                <p className="mt-1 text-sm text-danger-500">{errors.firstName.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                الاسم الأخير *
                            </label>
                            <input
                                {...register('lastName')}
                                className="input"
                                placeholder="العلي"
                            />
                            {errors.lastName && (
                                <p className="mt-1 text-sm text-danger-500">{errors.lastName.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                رقم الهاتف *
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
                                البريد الإلكتروني
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
                                تاريخ الميلاد
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
                                الجنسية *
                            </label>
                            <div className="relative">
                                <Globe className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <select {...register('nationality')} className="input pr-10">
                                    <option value="">اختر الجنسية</option>
                                    {nationalities.map((nat) => (
                                        <option key={nat} value={nat}>{nat}</option>
                                    ))}
                                </select>
                            </div>
                            {errors.nationality && (
                                <p className="mt-1 text-sm text-danger-500">{errors.nationality.message}</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                نوع الهوية *
                            </label>
                            <select {...register('idType')} className="input">
                                {idTypes.map((type) => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                رقم الهوية *
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
                                    اسم الشركة
                                </label>
                                <input
                                    {...register('companyName')}
                                    className="input"
                                    placeholder="شركة ABC"
                                />
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            ملاحظات
                        </label>
                        <textarea
                            {...register('notes')}
                            className="input min-h-[100px]"
                            placeholder="أي ملاحظات إضافية..."
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
                        إلغاء
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
                                <span>حفظ النزيل</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
