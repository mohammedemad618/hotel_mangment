'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    ArrowRight,
    Save,
    Loader2,
    BedDouble,
    DollarSign,
    Users,
    Hash,
    Building2,
} from 'lucide-react';
import { createRoomSchema, CreateRoomInput } from '@/lib/validations';

const roomTypes = [
    { value: 'single', label: 'مفردة', description: 'غرفة بسرير مفرد' },
    { value: 'double', label: 'مزدوجة', description: 'غرفة بسرير مزدوج' },
    { value: 'twin', label: 'توأم', description: 'غرفة بسريرين منفصلين' },
    { value: 'suite', label: 'جناح', description: 'جناح فاخر مع غرفة معيشة' },
    { value: 'deluxe', label: 'فاخرة', description: 'غرفة فاخرة مع إطلالة' },
    { value: 'presidential', label: 'رئاسية', description: 'الجناح الرئاسي' },
];

const amenitiesList = [
    'تكييف', 'واي فاي', 'تلفزيون', 'ميني بار', 'خزنة', 'بلكونة',
    'جاكوزي', 'مطبخ صغير', 'غرفة معيشة', 'إطلالة بحرية', 'إطلالة حديقة',
];

export default function NewRoomPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

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
        formState: { errors, isSubmitting },
    } = useForm<CreateRoomInput>({
        resolver: zodResolver(createRoomSchema),
        defaultValues: {
            capacity: { adults: 2, children: 0 },
        },
    });

    const toggleAmenity = (amenity: string) => {
        setSelectedAmenities((prev) =>
            prev.includes(amenity)
                ? prev.filter((a) => a !== amenity)
                : [...prev, amenity]
        );
    };

    const onSubmit = async (data: CreateRoomInput) => {
        setError(null);

        try {
            const response = await fetchWithRefresh('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...data,
                    amenities: selectedAmenities,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'حدث خطأ أثناء إنشاء الغرفة');
                return;
            }

            router.push('/dashboard/rooms');

        } catch (err) {
            setError('حدث خطأ في الاتصال بالخادم');
        }
    };

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
                        إضافة غرفة جديدة
                    </h1>
                    <p className="mt-1 text-white/60">
                        أدخل بيانات الغرفة الجديدة
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
                <div className="card p-6 space-y-6">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <BedDouble className="w-5 h-5 text-primary-300" />
                        معلومات الغرفة
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Room Number */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                رقم الغرفة *
                            </label>
                            <div className="relative">
                                <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    {...register('roomNumber')}
                                    className="input pr-10"
                                    placeholder="101"
                                />
                            </div>
                            {errors.roomNumber && (
                                <p className="mt-1 text-sm text-danger-500">{errors.roomNumber.message}</p>
                            )}
                        </div>

                        {/* Floor */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                الطابق *
                            </label>
                            <div className="relative">
                                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="number"
                                    {...register('floor', { valueAsNumber: true })}
                                    className="input pr-10"
                                    placeholder="1"
                                    min="0"
                                />
                            </div>
                            {errors.floor && (
                                <p className="mt-1 text-sm text-danger-500">{errors.floor.message}</p>
                            )}
                        </div>

                        {/* Price */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                السعر لليلة (ريال) *
                            </label>
                            <div className="relative">
                                <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
                                <input
                                    type="number"
                                    {...register('pricePerNight', { valueAsNumber: true })}
                                    className="input pr-10"
                                    placeholder="500"
                                    min="0"
                                />
                            </div>
                            {errors.pricePerNight && (
                                <p className="mt-1 text-sm text-danger-500">{errors.pricePerNight.message}</p>
                            )}
                        </div>

                        {/* Capacity */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    البالغين
                                </label>
                                <input
                                    type="number"
                                    {...register('capacity.adults', { valueAsNumber: true })}
                                    className="input"
                                    min="1"
                                    defaultValue={2}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/70 mb-2">
                                    الأطفال
                                </label>
                                <input
                                    type="number"
                                    {...register('capacity.children', { valueAsNumber: true })}
                                    className="input"
                                    min="0"
                                    defaultValue={0}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Room Type */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-3">
                            نوع الغرفة *
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {roomTypes.map((type) => (
                                <label
                                    key={type.value}
                                    className="relative flex cursor-pointer rounded-xl border border-white/10 p-4 focus:outline-none hover:border-primary-500/60 transition-colors"
                                >
                                    <input
                                        type="radio"
                                        {...register('type')}
                                        value={type.value}
                                        className="sr-only"
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium text-white">
                                            {type.label}
                                        </span>
                                        <span className="text-xs text-white/50 mt-1">
                                            {type.description}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                        {errors.type && (
                            <p className="mt-1 text-sm text-danger-500">{errors.type.message}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            الوصف
                        </label>
                        <textarea
                            {...register('description')}
                            className="input min-h-[100px]"
                            placeholder="وصف مختصر للغرفة..."
                        />
                    </div>
                </div>

                {/* Amenities */}
                <div className="card p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">
                        المرافق والخدمات
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {amenitiesList.map((amenity) => (
                            <button
                                key={amenity}
                                type="button"
                                onClick={() => toggleAmenity(amenity)}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedAmenities.includes(amenity)
                                        ? 'bg-primary-500/80 text-white'
                                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                                    }`}
                            >
                                {amenity}
                            </button>
                        ))}
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
                                <span>حفظ الغرفة</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
